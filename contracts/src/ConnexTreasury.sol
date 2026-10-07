// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    IPonsFactory,
    IPonsFeeEscrow,
    IPonsCurveFees,
    IPonsMemeHook,
    PonsLaunchedToken
} from "./interfaces/IPons.sol";
import {PoolKey} from "./interfaces/IPoolManager.sol";
import {ExactInputSingleParams, ISwapRouter02, IWETH} from "./interfaces/IUniswapV3.sol";

interface ILauncherView {
    function treasury() external view returns (address);
    function isLaunch(address token) external view returns (bool);
}

interface IBuybackSink {
    function treasury() external view returns (address);
    function token() external view returns (address);
    function buyAndBurn(uint256 minTokensOut) external payable returns (uint256 spent, uint256 burned);
}

/// @title ConnexTreasury
/// @notice Pons creator fee recipient of every CONNEX launch, and the only
/// place those fees go. Every fee that arrives is split by a share fixed in
/// the constructor:
///   - the buyback side (50% by default) buys $CONNEX on the market and burns it;
///     until $CONNEX exists it is saved here and cannot be spent on anything else;
///   - the launch side pays the next launches: Pons' launch fee plus a fixed
///     per-launch allowance to the operator for gas and the agent's tools.
///     Whatever the launch side holds above a fixed ceiling rolls over to the
///     buyback side.
///
/// Fees paid in a stock token or USDG (launches paired with them) are split
/// the same way per token and can be swapped to ETH by the operator through
/// Uniswap's SwapRouter02, each side staying on its own side.
///
/// No owner, no admin, no upgrade, no fee setter, no way to withdraw to an
/// arbitrary address. Two one-shot wiring steps, both callable once by the
/// deployer: `wire(launcher)` (the launcher needs this address and this
/// contract needs the launcher's) and `setBuyback(sink)` (the sink needs
/// $CONNEX, which does not exist when this contract is deployed).
///
/// Buybacks are an operated step: a buy from a permissionless call can be
/// sandwiched for most of its value, and Pons' curve and pool have no price
/// oracle to check against. The operator buys in amounts of at most
/// `maxBuybackPerCall`, no more often than `minBuybackInterval`, with a
/// minimum output it quotes off chain. If the operator stops for
/// `fallbackAfter`, anyone may run the same bounded buyback so the saved ETH
/// can never be stranded.
contract ConnexTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    IPonsFactory public immutable factory;
    IPonsFeeEscrow public immutable escrow;
    ISwapRouter02 public immutable swapRouter;
    IWETH public immutable weth;
    address public immutable operator;
    address public immutable deployer;

    /// @notice Share of every fee that goes to the buyback side, in basis points.
    uint256 public immutable buybackShareBps;
    /// @notice Paid to the operator from the launch side for each launch (gas and tools).
    uint256 public immutable opsAllowance;
    /// @notice Most the launch side may hold; any excess rolls over to the buyback side.
    uint256 public immutable budgetCeiling;
    /// @notice Largest single buyback.
    uint256 public immutable maxBuybackPerCall;
    /// @notice Minimum seconds between two buybacks.
    uint256 public immutable minBuybackInterval;
    /// @notice Seconds without an operator buyback after which anyone may run one.
    uint256 public immutable fallbackAfter;

    address public launcher;
    address public buyback;

    /// @notice ETH saved for buying back $CONNEX.
    uint256 public buybackReserve;
    /// @notice ETH that pays for the next launches.
    uint256 public launchBudget;
    /// @notice Non-ETH fees (stock tokens, USDG), per token and side.
    mapping(address token => uint256) public tokenBuyback;
    mapping(address token => uint256) public tokenBudget;

    uint256 public lastBuybackAt;

    /// Running totals, for the site and for anyone checking the split.
    uint256 public totalEthIn;
    uint256 public totalToBuyback;
    uint256 public totalToBudget;
    uint256 public totalRolledOver;
    uint256 public totalLaunchFees;
    uint256 public totalOpsPaid;
    uint256 public totalBoughtBack;
    uint256 public totalBurned;

    event Wired(address indexed launcher);
    event BuybackSet(address indexed buyback, address indexed token);
    event EthSplit(uint256 amount, uint256 toBuyback, uint256 toBudget, uint256 rolledOver);
    event TokenSplit(address indexed token, uint256 amount, uint256 toBuyback, uint256 toBudget);
    event LaunchFunded(uint256 launchFee, uint256 opsPaid);
    event BuybackExecuted(address indexed caller, uint256 ethSpent, uint256 tokensBurned, bool fallbackMode);
    event TokenConverted(address indexed token, bool buybackSide, uint256 amountIn, uint256 ethOut);
    event CurveSwept(address indexed token);
    event PoolSwept(address indexed token);
    event StrayBurned(address indexed token, uint256 amount);

    error ZeroAddress();
    error BadParams();
    error NotDeployer();
    error AlreadySet();
    error BadLauncher();
    error BadBuyback();
    error NotLauncher();
    error NotOperator();
    error NotSet();
    error UnknownToken();
    error InsufficientBudget(uint256 needed, uint256 available);
    error TooMuch(uint256 amount, uint256 limit);
    error TooSoon(uint256 nextAt);
    error NoMinimumOut();
    error ZeroAmount();
    error NotPairToken();
    error PaymentFailed();
    error BadSink();

    constructor(
        IPonsFactory factory_,
        IPonsFeeEscrow escrow_,
        ISwapRouter02 swapRouter_,
        IWETH weth_,
        address operator_,
        uint256 buybackShareBps_,
        uint256 opsAllowance_,
        uint256 budgetCeiling_,
        uint256 maxBuybackPerCall_,
        uint256 minBuybackInterval_,
        uint256 fallbackAfter_
    ) {
        if (
            address(factory_) == address(0) || address(escrow_) == address(0) || address(swapRouter_) == address(0)
                || address(weth_) == address(0) || operator_ == address(0)
        ) revert ZeroAddress();
        if (buybackShareBps_ > BPS || budgetCeiling_ == 0 || maxBuybackPerCall_ == 0) revert BadParams();
        if (fallbackAfter_ < minBuybackInterval_) revert BadParams();
        factory = factory_;
        escrow = escrow_;
        swapRouter = swapRouter_;
        weth = weth_;
        operator = operator_;
        deployer = msg.sender;
        buybackShareBps = buybackShareBps_;
        opsAllowance = opsAllowance_;
        budgetCeiling = budgetCeiling_;
        maxBuybackPerCall = maxBuybackPerCall_;
        minBuybackInterval = minBuybackInterval_;
        fallbackAfter = fallbackAfter_;
    }

    /// ETH from the fee escrow, WETH unwraps, buyback refunds or anyone else.
    /// It is split on the next `collect` (refunds and unwraps are booked in place).
    receive() external payable {}

    // ------------------------------------------------------------------
    // One-shot wiring
    // ------------------------------------------------------------------

    function wire(address launcher_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (launcher != address(0)) revert AlreadySet();
        if (launcher_.code.length == 0 || ILauncherView(launcher_).treasury() != address(this)) revert BadLauncher();
        launcher = launcher_;
        emit Wired(launcher_);
    }

    function setBuyback(address sink) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (buyback != address(0)) revert AlreadySet();
        if (sink.code.length == 0 || IBuybackSink(sink).treasury() != address(this)) revert BadBuyback();
        buyback = sink;
        lastBuybackAt = block.timestamp;
        emit BuybackSet(sink, IBuybackSink(sink).token());
    }

    // ------------------------------------------------------------------
    // Fee intake (anyone can call)
    // ------------------------------------------------------------------

    /// @notice Claims the ETH Pons holds for this treasury and splits every unbooked wei.
    function collect() external nonReentrant returns (uint256 split) {
        split = _collect();
    }

    /// @notice Claims a non-ETH fee token Pons holds for this treasury and splits it.
    function collectToken(address token) external nonReentrant returns (uint256 split) {
        split = _collectToken(token);
    }

    /// @notice Sweeps a CONNEX launch's bonding-curve fees into the escrow, then collects them.
    function sweepCurve(address token) external nonReentrant returns (uint256 split) {
        PonsLaunchedToken memory l = _launch(token);
        // Pons' buyback route is off for every CONNEX launch, so the minimum is never used; it must be non-zero.
        IPonsCurveFees(l.curve).sweepFees(1);
        emit CurveSwept(token);
        split = l.pairToken == address(0) ? _collect() : _collectToken(l.pairToken);
    }

    /// @notice Sweeps a graduated CONNEX launch's pool fees into the escrow, then collects them.
    /// Reverts while the pool holds fees in the memecoin itself: only Pons' operator may convert those.
    function sweepPool(address token) external nonReentrant returns (uint256 split) {
        PonsLaunchedToken memory l = _launch(token);
        (address c0, address c1) = l.pairToken < token ? (l.pairToken, token) : (token, l.pairToken);
        bytes32 poolId = keccak256(
            abi.encode(PoolKey({currency0: c0, currency1: c1, fee: l.poolFee, tickSpacing: l.tickSpacing, hooks: factory.memeHook()}))
        );
        IPonsMemeHook(factory.memeHook()).sweepPoolFees(poolId, 0, 0);
        emit PoolSwept(token);
        split = l.pairToken == address(0) ? _collect() : _collectToken(l.pairToken);
    }

    // ------------------------------------------------------------------
    // Launch side
    // ------------------------------------------------------------------

    /// @notice Pays Pons' launch fee to the launcher and the per-launch allowance to the operator.
    /// The allowance is skipped when the budget cannot cover it after the fee.
    function fundLaunch(uint256 amount) external nonReentrant {
        if (msg.sender != launcher) revert NotLauncher();
        if (amount != factory.launchFee()) revert BadParams();
        // Fees that arrived since the last collect count toward this launch.
        _splitEth();
        if (amount > launchBudget) revert InsufficientBudget(amount, launchBudget);
        launchBudget -= amount;
        uint256 ops = launchBudget >= opsAllowance ? opsAllowance : 0;
        launchBudget -= ops;
        totalLaunchFees += amount;
        totalOpsPaid += ops;
        emit LaunchFunded(amount, ops);
        _send(msg.sender, amount);
        if (ops != 0) _send(operator, ops);
    }

    // ------------------------------------------------------------------
    // Buyback side
    // ------------------------------------------------------------------

    /// @notice Buys $CONNEX with `amount` of the buyback reserve and burns it.
    /// Operator at any time (within the interval); anyone after `fallbackAfter` of operator silence.
    function executeBuyback(uint256 amount, uint256 minTokensOut)
        external
        nonReentrant
        returns (uint256 spent, uint256 burned)
    {
        address sink = buyback;
        if (sink == address(0)) revert NotSet();
        if (amount == 0) revert ZeroAmount();
        if (minTokensOut == 0) revert NoMinimumOut();
        if (amount > maxBuybackPerCall) revert TooMuch(amount, maxBuybackPerCall);
        if (amount > buybackReserve) revert TooMuch(amount, buybackReserve);
        bool fallbackMode = msg.sender != operator;
        if (fallbackMode && block.timestamp < lastBuybackAt + fallbackAfter) revert NotOperator();
        if (block.timestamp < lastBuybackAt + minBuybackInterval) revert TooSoon(lastBuybackAt + minBuybackInterval);

        buybackReserve -= amount;
        uint256 before = address(this).balance;
        (spent, burned) = IBuybackSink(sink).buyAndBurn{value: amount}(minTokensOut);
        // What the sink did not spend came back to this contract; it returns to the reserve, not to the split.
        uint256 refunded = address(this).balance + amount - before;
        if (refunded + spent != amount) revert BadSink();
        buybackReserve += refunded;
        lastBuybackAt = block.timestamp;
        totalBoughtBack += spent;
        totalBurned += burned;
        emit BuybackExecuted(msg.sender, spent, burned, fallbackMode);
    }

    // ------------------------------------------------------------------
    // Non-ETH fees
    // ------------------------------------------------------------------

    /// @notice Swaps `amountIn` of a fee token from one side to ETH on Uniswap v3 and books the ETH on that same side.
    function convertToken(address token, bool buybackSide, uint256 amountIn, uint24 poolFee, uint256 minEthOut)
        external
        nonReentrant
        returns (uint256 ethOut)
    {
        if (msg.sender != operator) revert NotOperator();
        if (amountIn == 0) revert ZeroAmount();
        if (minEthOut == 0) revert NoMinimumOut();
        if (token == address(weth) || _isBurnable(token)) revert NotPairToken();
        if (buybackSide) {
            if (amountIn > tokenBuyback[token]) revert TooMuch(amountIn, tokenBuyback[token]);
            tokenBuyback[token] -= amountIn;
        } else {
            if (amountIn > tokenBudget[token]) revert TooMuch(amountIn, tokenBudget[token]);
            tokenBudget[token] -= amountIn;
        }

        IERC20 t = IERC20(token);
        uint256 tokenBefore = t.balanceOf(address(this));
        uint256 wethBefore = weth.balanceOf(address(this));
        t.forceApprove(address(swapRouter), amountIn);
        swapRouter.exactInputSingle(
            ExactInputSingleParams({
                tokenIn: token,
                tokenOut: address(weth),
                fee: poolFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minEthOut,
                sqrtPriceLimitX96: 0
            })
        );
        t.forceApprove(address(swapRouter), 0);
        if (tokenBefore - t.balanceOf(address(this)) != amountIn) revert BadParams();
        uint256 wethOut = weth.balanceOf(address(this)) - wethBefore;
        if (wethOut < minEthOut) revert TooMuch(minEthOut, wethOut);

        uint256 ethBefore = address(this).balance;
        weth.withdraw(wethOut);
        ethOut = address(this).balance - ethBefore;
        if (buybackSide) {
            buybackReserve += ethOut;
            totalToBuyback += ethOut;
        } else {
            _addToBudget(ethOut);
        }
        totalEthIn += ethOut;
        emit TokenConverted(token, buybackSide, amountIn, ethOut);
    }

    /// @notice Burns any CONNEX launch token or $CONNEX that was sent here. Anyone can call it.
    function burnStray(address token) external nonReentrant returns (uint256 amount) {
        if (!_isBurnable(token)) revert UnknownToken();
        amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(BURN, amount);
        emit StrayBurned(token, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice ETH that arrived and has not been split yet.
    function unsplitEth() external view returns (uint256) {
        return address(this).balance - buybackReserve - launchBudget;
    }

    /// @notice Seconds until the next buyback is allowed for `caller`.
    function buybackOpensIn(address caller) external view returns (uint256) {
        uint256 at = lastBuybackAt + (caller == operator ? minBuybackInterval : fallbackAfter);
        return block.timestamp >= at ? 0 : at - block.timestamp;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _launch(address token) private view returns (PonsLaunchedToken memory l) {
        address L = launcher;
        if (L == address(0)) revert NotSet();
        if (!ILauncherView(L).isLaunch(token)) revert UnknownToken();
        l = factory.getLaunchedToken(token);
    }

    function _isBurnable(address token) private view returns (bool) {
        address L = launcher;
        if (L != address(0) && ILauncherView(L).isLaunch(token)) return true;
        address sink = buyback;
        return sink != address(0) && IBuybackSink(sink).token() == token;
    }

    function _collect() private returns (uint256) {
        if (escrow.balanceOf(address(this)) != 0) escrow.claim();
        return _splitEth();
    }

    function _collectToken(address token) private returns (uint256) {
        if (token == address(0)) revert ZeroAddress();
        if (_isBurnable(token)) revert NotPairToken();
        if (escrow.balanceOfToken(address(this), token) != 0) escrow.claimToken(token);
        return _splitToken(token);
    }

    function _splitEth() private returns (uint256 amount) {
        amount = address(this).balance - buybackReserve - launchBudget;
        if (amount == 0) return 0;
        uint256 toBuyback = (amount * buybackShareBps) / BPS;
        uint256 toBudget = amount - toBuyback;
        buybackReserve += toBuyback;
        totalToBuyback += toBuyback;
        totalEthIn += amount;
        uint256 rolled = _addToBudget(toBudget);
        emit EthSplit(amount, toBuyback, toBudget - rolled, rolled);
    }

    /// Adds to the launch side up to the ceiling; the rest goes to the buyback side.
    function _addToBudget(uint256 amount) private returns (uint256 rolled) {
        uint256 room = launchBudget >= budgetCeiling ? 0 : budgetCeiling - launchBudget;
        uint256 kept = amount > room ? room : amount;
        rolled = amount - kept;
        launchBudget += kept;
        totalToBudget += kept;
        if (rolled != 0) {
            buybackReserve += rolled;
            totalRolledOver += rolled;
            totalToBuyback += rolled;
        }
    }

    function _splitToken(address token) private returns (uint256 amount) {
        amount = IERC20(token).balanceOf(address(this)) - tokenBuyback[token] - tokenBudget[token];
        if (amount == 0) return 0;
        uint256 toBuyback = (amount * buybackShareBps) / BPS;
        uint256 toBudget = amount - toBuyback;
        tokenBuyback[token] += toBuyback;
        tokenBudget[token] += toBudget;
        emit TokenSplit(token, amount, toBuyback, toBudget);
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }
}
