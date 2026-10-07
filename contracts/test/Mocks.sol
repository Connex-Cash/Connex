// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PonsLaunchedToken, PonsTokenParams} from "../src/interfaces/IPons.sol";
import {IUnlockCallback, PoolKey, SwapParams} from "../src/interfaces/IPoolManager.sol";
import {ExactInputSingleParams} from "../src/interfaces/IUniswapV3.sol";

contract MockToken is ERC20 {
    constructor(string memory n, string memory s, address to, uint256 supply) ERC20(n, s) {
        _mint(to, supply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Stand-in for PonsV2FeeEscrow: credits per recipient, the recipient claims.
contract MockEscrow {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public balanceOfToken;

    function credit(address recipient) external payable {
        balanceOf[recipient] += msg.value;
    }

    function creditToken(address recipient, address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        balanceOfToken[recipient][token] += amount;
    }

    function claim() external returns (uint256 amount) {
        amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "claim");
    }

    function claimToken(address token) external returns (uint256 amount) {
        amount = balanceOfToken[msg.sender][token];
        balanceOfToken[msg.sender][token] = 0;
        IERC20(token).transfer(msg.sender, amount);
    }
}

/// Constant-product ETH curve with a 1% fee, a sell-out allocation and refunds, shaped like PonsV2BondingCurve.
/// Its creator recipient (`deployer`, as Pons names it) may sweep fees: 70% to the creator via the escrow.
contract MockCurve {
    MockToken public token;
    MockEscrow public escrow;
    address public deployer;
    uint256 public quoteReserve = 1.68 ether;
    uint256 public tokenReserve;
    uint256 public reservedTokens;
    bool public graduated;
    uint256 public constant FEE_BPS = 100;
    uint256 public feesHeld;

    error SlippageExceeded(uint256 actual, uint256 minimum);

    function init(MockToken t, uint256 reserved, MockEscrow e, address creator) external {
        token = t;
        tokenReserve = t.balanceOf(address(this));
        reservedTokens = reserved;
        escrow = e;
        deployer = creator;
    }

    function readyToGraduate() public view returns (bool) {
        return !graduated && tokenReserve <= reservedTokens;
    }

    function setGraduated(bool g) external {
        graduated = g;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 out) {
        require(msg.value == quoteIn, "value");
        require(!graduated && !readyToGraduate(), "graduated");
        uint256 spent = quoteIn;
        uint256 fee = (spent * FEE_BPS) / 10_000;
        out = ((spent - fee) * tokenReserve) / (quoteReserve + spent - fee);
        uint256 sellable = tokenReserve - reservedTokens;
        if (out > sellable) {
            out = sellable;
            uint256 net = (out * quoteReserve) / (tokenReserve - out) + 1;
            spent = (net * 10_000) / (10_000 - FEE_BPS) + 1;
            if (spent > quoteIn) spent = quoteIn;
            fee = (spent * FEE_BPS) / 10_000;
        }
        if (spent * minTokensOut > quoteIn * out) revert SlippageExceeded(out, minTokensOut);
        quoteReserve += spent - fee;
        tokenReserve -= out;
        feesHeld += fee;
        token.transfer(recipient, out);
        if (quoteIn > spent) {
            (bool ok,) = msg.sender.call{value: quoteIn - spent}("");
            require(ok, "refund");
        }
    }

    function sweepFees(uint256) external {
        require(msg.sender == deployer, "not creator");
        uint256 f = feesHeld;
        feesHeld = 0;
        uint256 protocol = (f * 3000) / 10_000;
        escrow.credit{value: f - protocol}(deployer);
        (bool ok,) = address(0xBEEF).call{value: protocol}("");
        require(ok, "protocol");
    }

    receive() external payable {}
}

contract MockHook {
    MockEscrow public escrow;
    mapping(bytes32 => address) public creatorOf;
    mapping(bytes32 => uint256) public pendingEth;
    bytes32 public lastSwept;

    constructor(MockEscrow e) {
        escrow = e;
    }

    function register(bytes32 poolId, address creator) external {
        creatorOf[poolId] = creator;
    }

    function addFees(bytes32 poolId) external payable {
        pendingEth[poolId] += msg.value;
    }

    function sweepPoolFees(bytes32 poolId, uint256, uint256) external {
        require(creatorOf[poolId] != address(0), "unknown pool");
        require(msg.sender == creatorOf[poolId], "not creator");
        uint256 f = pendingEth[poolId];
        pendingEth[poolId] = 0;
        lastSwept = poolId;
        if (f != 0) escrow.credit{value: f}(msg.sender);
    }
}

contract MockFactory {
    uint256 public launchFee = 0.0005 ether;
    address public memeHook;
    MockEscrow public escrow;
    mapping(address => PonsLaunchedToken) internal _launched;
    mapping(address => bool) public approvedPairTokens;
    uint256 public reserved = 200_000_000 ether;
    PonsTokenParams internal _last;

    constructor(MockEscrow e, address hook) {
        escrow = e;
        memeHook = hook;
    }

    function setLaunchFee(uint256 f) external {
        launchFee = f;
    }

    function approvePair(address t) external {
        approvedPairTokens[t] = true;
    }

    function setPhase(address token, uint8 phase) external {
        _launched[token].phase = phase;
    }

    function last() external view returns (PonsTokenParams memory) {
        return _last;
    }

    function launchToken(PonsTokenParams calldata p, uint256, address pairToken)
        external
        payable
        returns (address token, address curve)
    {
        require(msg.value == launchFee, "fee");
        require(pairToken == address(0) || approvedPairTokens[pairToken], "pair");
        MockCurve c = new MockCurve{salt: p.salt}();
        MockToken t = new MockToken{salt: p.salt}(p.name, p.symbol, address(c), 1_000_000_000 ether);
        c.init(t, reserved, escrow, p.creatorFeeRecipient);
        token = address(t);
        curve = address(c);
        _last = p;
        _launched[token] = PonsLaunchedToken({
            token: token,
            curve: curve,
            deployer: msg.sender,
            creatorFeeRecipient: p.creatorFeeRecipient,
            pairToken: pairToken,
            graduationThreshold: 4.2 ether,
            poolFee: 0,
            tickSpacing: 200,
            creatorTaxBps: p.creatorTaxBps,
            buybackEnabled: p.buybackEnabled,
            phase: 0,
            sweptQuote: 0,
            sweptTokens: 0,
            sweptAt: 0,
            exists: true
        });
    }

    function getLaunchedToken(address token) external view returns (PonsLaunchedToken memory) {
        return _launched[token];
    }
}

/// Fixed-price pool: `rate` tokens per ETH, 1% fee on the output.
contract MockPoolManager {
    uint256 public rate = 1_000_000;
    uint256 public maxIn = type(uint256).max;
    address private _synced;
    uint256 private _syncedBalance;
    int256 public owedEth;
    int256 public owedToken;
    bool private _unlocked;

    function setRate(uint256 r) external {
        rate = r;
    }

    function setMaxIn(uint256 m) external {
        maxIn = m;
    }

    function unlock(bytes calldata data) external returns (bytes memory result) {
        _unlocked = true;
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        require(owedEth == 0 && owedToken == 0, "unsettled");
        _unlocked = false;
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata) external returns (int256) {
        require(_unlocked, "locked");
        uint256 amountIn = uint256(-params.amountSpecified);
        if (amountIn > maxIn) amountIn = maxIn;
        require(params.zeroForOne, "buy only");
        uint256 out = (amountIn * rate * 99) / 100;
        require(IERC20(key.currency1).balanceOf(address(this)) >= out, "liquidity");
        int128 a0 = -int128(int256(amountIn));
        int128 a1 = int128(int256(out));
        owedEth += a0;
        owedToken += a1;
        return (int256(a0) << 128) | int256(uint256(uint128(a1)));
    }

    function sync(address currency) external {
        _synced = currency;
        _syncedBalance = IERC20(currency).balanceOf(address(this));
    }

    function settle() external payable returns (uint256 paid) {
        paid = msg.value;
        owedEth += int256(paid);
    }

    function take(address currency, address to, uint256 amount) external {
        owedToken -= int256(amount);
        IERC20(currency).transfer(to, amount);
    }

    receive() external payable {}
}

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw");
    }
}

/// Swaps any token for WETH at `rate` WETH-wei per token-wei / 1e18.
contract MockSwapRouter {
    MockWETH public weth;
    uint256 public rate = 1e15; // 0.001 ETH per token

    constructor(MockWETH w) {
        weth = w;
    }

    function setRate(uint256 r) external {
        rate = r;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 out) {
        require(p.tokenOut == address(weth), "weth only");
        IERC20(p.tokenIn).transferFrom(msg.sender, address(this), p.amountIn);
        out = (p.amountIn * rate) / 1e18;
        require(out >= p.amountOutMinimum, "Too little received");
        weth.transfer(p.recipient, out);
    }
}

/// Refuses ETH.
contract EthRefuser {
    receive() external payable {
        revert("no");
    }
}
