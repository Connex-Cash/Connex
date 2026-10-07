// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPonsFactory, IPonsCurve, PonsLaunchedToken} from "./interfaces/IPons.sol";
import {IPoolManager, IUnlockCallback, PoolKey, SwapParams} from "./interfaces/IPoolManager.sol";

/// @title ConnexBuyback
/// @notice Buys $CONNEX with ETH from the CONNEX treasury and burns every token
/// it buys. Deployed once $CONNEX exists, then named in the treasury with
/// `setBuyback` (once).
///
/// $CONNEX is expected to be a Pons V2 launch paired with ETH: the buy runs on
/// its bonding curve before graduation and in its Uniswap v4 pool after it.
/// Bought tokens go straight to the burn address; this contract never holds
/// them. Unspent ETH (a curve that sold out mid-buy) goes back to the treasury.
///
/// No owner, no admin. Only the treasury may call `buyAndBurn`.
contract ConnexBuyback is ReentrancyGuard, IUnlockCallback {
    using SafeERC20 for IERC20;

    address public constant BURN = 0x000000000000000000000000000000000000dEaD;
    uint160 private constant MIN_SQRT_PRICE_PLUS_ONE = 4295128740;
    uint8 private constant PHASE_CURVE = 0;
    uint8 private constant PHASE_POOL = 2;

    IPonsFactory public immutable factory;
    IPoolManager public immutable poolManager;
    address public immutable treasury;
    address public immutable token;

    bool private _expectingEth;

    event Burned(uint256 ethSpent, uint256 tokensBurned, bool viaPool);

    error ZeroAddress();
    error NotPonsEthLaunch();
    error NotTreasury();
    error NotPoolManager();
    error NoMinimumOut();
    error TradingPaused();
    error Slippage(uint256 out, uint256 minimum);
    error UnexpectedEth();
    error PaymentFailed();

    constructor(IPonsFactory factory_, IPoolManager poolManager_, address treasury_, address token_) {
        if (
            address(factory_) == address(0) || address(poolManager_) == address(0) || treasury_ == address(0)
                || token_ == address(0)
        ) revert ZeroAddress();
        PonsLaunchedToken memory l = factory_.getLaunchedToken(token_);
        if (!l.exists || l.pairToken != address(0)) revert NotPonsEthLaunch();
        factory = factory_;
        poolManager = poolManager_;
        treasury = treasury_;
        token = token_;
    }

    /// Refunds from the curve while a buy is running; nothing else.
    receive() external payable {
        if (!_expectingEth) revert UnexpectedEth();
    }

    /// @notice Buys $CONNEX with all attached ETH (or as much as the venue fills) and burns it.
    function buyAndBurn(uint256 minTokensOut) external payable nonReentrant returns (uint256 spent, uint256 burned) {
        if (msg.sender != treasury) revert NotTreasury();
        if (minTokensOut == 0) revert NoMinimumOut();
        uint256 ethIn = msg.value;
        PonsLaunchedToken memory l = factory.getLaunchedToken(token);
        uint256 burnBefore = IERC20(token).balanceOf(BURN);
        bool viaPool;

        _expectingEth = true;
        if (l.phase == PHASE_CURVE && !IPonsCurve(l.curve).graduated() && !IPonsCurve(l.curve).readyToGraduate()) {
            uint256 balanceBefore = address(this).balance - ethIn;
            IPonsCurve(l.curve).buy{value: ethIn}(ethIn, minTokensOut, BURN);
            spent = ethIn - (address(this).balance - balanceBefore);
        } else if (l.phase == PHASE_POOL) {
            viaPool = true;
            PoolKey memory key = PoolKey({
                currency0: address(0),
                currency1: token,
                fee: l.poolFee,
                tickSpacing: l.tickSpacing,
                hooks: factory.memeHook()
            });
            (, spent) = abi.decode(poolManager.unlock(abi.encode(key, ethIn)), (uint256, uint256));
        } else {
            revert TradingPaused();
        }
        _expectingEth = false;

        burned = IERC20(token).balanceOf(BURN) - burnBefore;
        // Same price bound the curve applies: at least minTokensOut per ethIn, pro rata on a partial fill.
        if (burned == 0 || spent * minTokensOut > ethIn * burned) revert Slippage(burned, minTokensOut);
        emit Burned(spent, burned, viaPool);

        uint256 refund = ethIn - spent;
        if (refund != 0) {
            (bool ok,) = payable(treasury).call{value: refund}("");
            if (!ok) revert PaymentFailed();
        }
    }

    /// @dev Exact-input ETH -> $CONNEX swap in the v4 pool; output taken straight to the burn address.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, uint256 amountIn) = abi.decode(data, (PoolKey, uint256));
        int256 delta = poolManager.swap(
            key, SwapParams({zeroForOne: true, amountSpecified: -int256(amountIn), sqrtPriceLimitX96: MIN_SQRT_PRICE_PLUS_ONE}), ""
        );
        int128 amount0 = int128(delta >> 128);
        int128 amount1 = int128(delta);
        uint256 paid = uint256(uint128(-amount0));
        uint256 out = uint256(uint128(amount1));
        poolManager.settle{value: paid}();
        poolManager.take(key.currency1, BURN, out);
        return abi.encode(out, paid);
    }
}
