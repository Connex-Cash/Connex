// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ConnexLauncher} from "../src/ConnexLauncher.sol";
import {ConnexTreasury} from "../src/ConnexTreasury.sol";
import {ConnexBuyback} from "../src/ConnexBuyback.sol";
import {IPonsFactory, IPonsFeeEscrow, PonsTokenParams, PonsLaunchedToken} from "../src/interfaces/IPons.sol";
import {IPoolManager} from "../src/interfaces/IPoolManager.sol";
import {ISwapRouter02, IWETH} from "../src/interfaces/IUniswapV3.sol";
import {MockEscrow, MockCurve, MockFactory, MockHook, MockPoolManager, MockSwapRouter, MockToken, MockWETH} from "./Mocks.sol";

contract Handler is Test {
    MockFactory factory;
    ConnexTreasury treasury;
    ConnexLauncher launcher;
    MockToken nvda;
    address operator;
    address trader = makeAddr("trader");
    address[] public tokens;

    constructor(MockFactory f, ConnexTreasury t, ConnexLauncher l, MockToken n, address op) {
        factory = f;
        treasury = t;
        launcher = l;
        nvda = n;
        operator = op;
        vm.deal(trader, 1_000_000 ether);
        vm.deal(address(this), 1_000_000 ether);
    }

    function tokenCount() external view returns (uint256) {
        return tokens.length;
    }

    function gift(uint96 amount) external {
        amount = uint96(bound(amount, 0, 5 ether));
        (bool ok,) = address(treasury).call{value: amount}("");
        require(ok);
    }

    function collect() external {
        treasury.collect();
    }

    function launch(bool paySelf) external {
        vm.warp(vm.getBlockTimestamp() + launcher.minInterval());
        ConnexLauncher.LaunchParams memory p;
        p.name = "Inv";
        p.symbol = "INV";
        uint256 fee = factory.launchFee();
        vm.prank(operator);
        try launcher.launch{value: paySelf ? fee : 0}(p) returns (address token, address) {
            tokens.push(token);
        } catch {}
    }

    function tradeAndSweep(uint256 which, uint96 eth) external {
        if (tokens.length == 0) return;
        address token = tokens[which % tokens.length];
        eth = uint96(bound(eth, 0.001 ether, 3 ether));
        PonsLaunchedToken memory l = factory.getLaunchedToken(token);
        MockCurve c = MockCurve(payable(l.curve));
        if (c.readyToGraduate()) return;
        vm.prank(trader);
        try c.buy{value: eth}(eth, 1, trader) {} catch {}
        treasury.sweepCurve(token);
    }

    function stockFees(uint96 amount) external {
        amount = uint96(bound(amount, 0, 1_000 ether));
        nvda.transfer(address(treasury), amount);
        treasury.collectToken(address(nvda));
    }

    function convert(bool side, uint96 amount) external {
        uint256 avail = side ? treasury.tokenBuyback(address(nvda)) : treasury.tokenBudget(address(nvda));
        if (avail == 0) return;
        amount = uint96(bound(amount, 1, avail));
        vm.prank(operator);
        try treasury.convertToken(address(nvda), side, amount, 500, 1) {} catch {}
    }

    function buyback(uint96 amount, bool asStranger) external {
        if (treasury.buyback() == address(0)) return;
        vm.warp(vm.getBlockTimestamp() + (asStranger ? treasury.fallbackAfter() : treasury.minBuybackInterval()));
        uint256 r = treasury.buybackReserve();
        if (r == 0) return;
        amount = uint96(bound(amount, 1, r < treasury.maxBuybackPerCall() ? r : treasury.maxBuybackPerCall()));
        vm.prank(asStranger ? trader : operator);
        try treasury.executeBuyback(amount, 1) {} catch {}
    }

    function strayToLauncher(uint256 which) external {
        if (tokens.length == 0) return;
        address token = tokens[which % tokens.length];
        uint256 bal = IERC20(token).balanceOf(trader);
        if (bal == 0) return;
        vm.prank(trader);
        IERC20(token).transfer(address(launcher), bal / 2 + 1);
        launcher.burnStray(token);
    }
}

contract ConnexInvariantTest is Test {
    MockEscrow escrow;
    MockFactory factory;
    MockWETH weth;
    MockSwapRouter router;
    MockPoolManager pm;
    ConnexTreasury treasury;
    ConnexLauncher launcher;
    ConnexBuyback sink;
    MockToken nvda;
    Handler handler;
    address operator = makeAddr("operator");
    address connex;

    function setUp() public {
        escrow = new MockEscrow();
        MockHook hook = new MockHook(escrow);
        factory = new MockFactory(escrow, address(hook));
        weth = new MockWETH();
        router = new MockSwapRouter(weth);
        pm = new MockPoolManager();
        vm.deal(address(this), 2_000_000 ether);
        weth.deposit{value: 1_000_000 ether}();
        weth.transfer(address(router), 1_000_000 ether);
        treasury = new ConnexTreasury(
            IPonsFactory(address(factory)),
            IPonsFeeEscrow(address(escrow)),
            ISwapRouter02(address(router)),
            IWETH(address(weth)),
            operator,
            5000,
            0.0005 ether,
            0.5 ether,
            0.05 ether,
            1 hours,
            7 days
        );
        launcher = new ConnexLauncher(IPonsFactory(address(factory)), address(treasury), operator, 10 minutes);
        treasury.wire(address(launcher));
        vm.deal(operator, 1_000 ether);

        PonsTokenParams memory p;
        p.name = "CONNEX";
        p.symbol = "CONNEX";
        p.creatorFeeRecipient = address(0xC0);
        p.salt = keccak256("connex");
        (connex,) = factory.launchToken{value: factory.launchFee()}(p, 0, address(0));
        sink = new ConnexBuyback(IPonsFactory(address(factory)), IPoolManager(address(pm)), address(treasury), connex);
        treasury.setBuyback(address(sink));

        nvda = new MockToken("NVIDIA", "NVDA", address(this), 1);
        handler = new Handler(factory, treasury, launcher, nvda, operator);
        nvda.mint(address(handler), 1e30);
        targetContract(address(handler));
    }

    function invariant_everyWeiIsBooked() public view {
        uint256 bal = address(treasury).balance;
        assertEq(bal, treasury.buybackReserve() + treasury.launchBudget() + treasury.unsplitEth());
    }

    function invariant_splitTotalsAddUp() public view {
        assertEq(treasury.totalEthIn(), treasury.totalToBuyback() + treasury.totalToBudget());
        // Everything that came in is either still held on one side or left through one of three doors.
        assertEq(
            treasury.totalEthIn(),
            treasury.buybackReserve() + treasury.launchBudget() + treasury.totalLaunchFees() + treasury.totalOpsPaid()
                + treasury.totalBoughtBack()
        );
        assertLe(treasury.launchBudget(), treasury.budgetCeiling());
    }

    function invariant_stockSidesMatchBalance() public view {
        assertEq(nvda.balanceOf(address(treasury)), treasury.tokenBuyback(address(nvda)) + treasury.tokenBudget(address(nvda)));
    }

    function invariant_devHoldsZero() public view {
        uint256 n = handler.tokenCount();
        for (uint256 i = 0; i < n; ++i) {
            address t = handler.tokens(i);
            assertEq(IERC20(t).balanceOf(address(launcher)), 0, "launcher holds none");
            assertEq(IERC20(t).balanceOf(address(treasury)), 0, "treasury holds none");
            assertEq(IERC20(t).balanceOf(operator), 0, "operator holds none");
        }
        assertEq(IERC20(connex).balanceOf(address(treasury)), 0);
        assertEq(IERC20(connex).balanceOf(address(sink)), 0);
        assertEq(address(launcher).balance, 0);
        assertEq(address(sink).balance, 0);
    }

    function invariant_burnedMatchesSink() public view {
        assertEq(IERC20(connex).balanceOf(sink.BURN()), treasury.totalBurned());
    }
}
