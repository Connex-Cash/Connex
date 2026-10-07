// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ConnexLauncher} from "../src/ConnexLauncher.sol";
import {ConnexTreasury} from "../src/ConnexTreasury.sol";
import {ConnexBuyback} from "../src/ConnexBuyback.sol";
import {IPonsFactory, IPonsFeeEscrow, PonsTokenParams, PonsLaunchedToken} from "../src/interfaces/IPons.sol";
import {IPoolManager, PoolKey} from "../src/interfaces/IPoolManager.sol";
import {ISwapRouter02, IWETH} from "../src/interfaces/IUniswapV3.sol";
import {
    MockEscrow,
    MockCurve,
    MockFactory,
    MockHook,
    MockPoolManager,
    MockSwapRouter,
    MockToken,
    MockWETH,
    EthRefuser
} from "./Mocks.sol";

contract ConnexBase is Test {
    MockEscrow escrow;
    MockHook hook;
    MockFactory factory;
    MockWETH weth;
    MockSwapRouter router;
    MockPoolManager pm;
    ConnexTreasury treasury;
    ConnexLauncher launcher;

    address operator = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant SHARE = 5000;
    uint256 constant OPS = 0.0005 ether;
    uint256 constant CEILING = 0.5 ether;
    uint256 constant MAX_BUY = 0.05 ether;
    uint256 constant BUY_GAP = 1 hours;
    uint256 constant FALLBACK = 7 days;
    uint256 constant LAUNCH_GAP = 10 minutes;

    function setUp() public virtual {
        escrow = new MockEscrow();
        hook = new MockHook(escrow);
        factory = new MockFactory(escrow, address(hook));
        weth = new MockWETH();
        router = new MockSwapRouter(weth);
        pm = new MockPoolManager();
        treasury = _treasury(SHARE);
        launcher = new ConnexLauncher(IPonsFactory(address(factory)), address(treasury), operator, LAUNCH_GAP);
        treasury.wire(address(launcher));
        vm.deal(operator, 10 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(address(this), 100 ether);
        // The router pays WETH out of its own float.
        vm.deal(address(router), 0);
        weth.deposit{value: 50 ether}();
        weth.transfer(address(router), 50 ether);
    }

    function _treasury(uint256 share) internal returns (ConnexTreasury) {
        return new ConnexTreasury(
            IPonsFactory(address(factory)),
            IPonsFeeEscrow(address(escrow)),
            ISwapRouter02(address(router)),
            IWETH(address(weth)),
            operator,
            share,
            OPS,
            CEILING,
            MAX_BUY,
            BUY_GAP,
            FALLBACK
        );
    }

    function _params(string memory name, address pair) internal pure returns (ConnexLauncher.LaunchParams memory p) {
        p.name = name;
        p.symbol = "TKN";
        p.logo = "ipfs://logo";
        p.description = "a trend";
        p.website = "https://connex.cash";
        p.twitter = "https://x.com/someone/status/1";
        p.pairToken = pair;
        p.round = 7;
        p.sourceHash = keccak256("evidence");
        p.playbookHash = keccak256("playbook v1");
    }

    function _launchPaid(string memory name) internal returns (address token) {
        uint256 fee = factory.launchFee();
        vm.prank(operator);
        (token,) = launcher.launch{value: fee}(_params(name, address(0)));
    }

    function _gift(uint256 amount) internal {
        (bool ok,) = address(treasury).call{value: amount}("");
        require(ok);
    }

    function _trade(address token, uint256 eth) internal {
        PonsLaunchedToken memory l = factory.getLaunchedToken(token);
        vm.prank(alice);
        MockCurve(payable(l.curve)).buy{value: eth}(eth, 1, alice);
    }

    function _accounted() internal view returns (bool) {
        return address(treasury).balance == treasury.buybackReserve() + treasury.launchBudget() + treasury.unsplitEth();
    }
}

contract LauncherTest is ConnexBase {
    function test_constructorRefusesZeroAddresses() public {
        vm.expectRevert(ConnexLauncher.ZeroAddress.selector);
        new ConnexLauncher(IPonsFactory(address(0)), address(treasury), operator, 0);
        vm.expectRevert(ConnexLauncher.ZeroAddress.selector);
        new ConnexLauncher(IPonsFactory(address(factory)), address(0), operator, 0);
        vm.expectRevert(ConnexLauncher.ZeroAddress.selector);
        new ConnexLauncher(IPonsFactory(address(factory)), address(treasury), address(0), 0);
    }

    function test_onlyOperatorLaunches() public {
        uint256 fee = factory.launchFee();
        vm.prank(alice);
        vm.expectRevert(ConnexLauncher.NotOperator.selector);
        launcher.launch{value: fee}(_params("A", address(0)));
    }

    function test_launchSetsTreasuryAsCreatorAndHoldsNothing() public {
        address token = _launchPaid("Alpha");
        PonsTokenParams memory p = factory.last();
        assertEq(p.creatorFeeRecipient, address(treasury), "fees go to the treasury");
        assertEq(p.creatorTaxBps, 0, "no extra creator tax");
        assertFalse(p.buybackEnabled, "Pons buyback route off");
        assertEq(IERC20(token).balanceOf(address(launcher)), 0, "launcher holds zero");
        assertEq(IERC20(token).balanceOf(address(treasury)), 0, "treasury holds zero");
        assertEq(IERC20(token).balanceOf(operator), 0, "operator holds zero");
        PonsLaunchedToken memory l = factory.getLaunchedToken(token);
        assertEq(IERC20(token).balanceOf(l.curve), 1_000_000_000 ether, "whole supply on the curve");
        assertTrue(launcher.isLaunch(token));
        assertEq(launcher.launchCount(), 1);
        ConnexLauncher.Launch memory rec = launcher.launchAt(0);
        assertEq(rec.token, token);
        assertEq(rec.round, 7);
        assertEq(rec.sourceHash, keccak256("evidence"));
        assertEq(rec.playbookHash, keccak256("playbook v1"));
        assertEq(launcher.indexOf(token), 0);
        assertEq(address(launcher).balance, 0);
    }

    function test_launchEmitsEvent() public {
        uint256 fee = factory.launchFee();
        vm.expectEmit(true, false, false, false, address(launcher));
        emit ConnexLauncher.Launched(0, address(0), address(0), address(0), 0, 0, 0, 0, false);
        vm.prank(operator);
        launcher.launch{value: fee}(_params("A", address(0)));
    }

    function test_wrongValueReverts() public {
        uint256 fee = factory.launchFee();
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ConnexLauncher.WrongValue.selector, fee));
        launcher.launch{value: 1}(_params("A", address(0)));
    }

    function test_minIntervalBetweenLaunches() public {
        _launchPaid("A");
        uint256 fee = factory.launchFee();
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ConnexLauncher.TooSoon.selector, vm.getBlockTimestamp() + LAUNCH_GAP));
        launcher.launch{value: fee}(_params("B", address(0)));
        assertEq(launcher.nextLaunchIn(), LAUNCH_GAP);
        vm.warp(vm.getBlockTimestamp() + LAUNCH_GAP);
        assertEq(launcher.nextLaunchIn(), 0);
        _launchPaid("B");
        assertEq(launcher.launchCount(), 2);
    }

    function test_treasuryPaysLaunchFeeAndOpsAllowance() public {
        _gift(0.01 ether);
        treasury.collect();
        assertEq(treasury.launchBudget(), 0.005 ether);
        uint256 opBefore = operator.balance;
        vm.prank(operator);
        launcher.launch(_params("Funded", address(0)));
        assertEq(treasury.launchBudget(), 0.005 ether - 0.0005 ether - OPS);
        assertEq(operator.balance - opBefore, OPS, "operator got the allowance");
        assertEq(treasury.totalLaunchFees(), 0.0005 ether);
        assertEq(treasury.totalOpsPaid(), OPS);
        assertEq(address(launcher).balance, 0);
    }

    function test_treasuryLaunchSplitsUnbookedFeesFirst() public {
        _gift(0.002 ether); // not collected yet
        vm.prank(operator);
        launcher.launch(_params("Fresh", address(0)));
        // 0.001 to the budget, 0.0005 fee, then 0.0005 allowance fits exactly.
        assertEq(treasury.launchBudget(), 0);
        assertEq(treasury.buybackReserve(), 0.001 ether);
    }

    function test_allowanceSkippedWhenBudgetShort() public {
        _gift(0.0012 ether);
        treasury.collect(); // budget 0.0006
        uint256 opBefore = operator.balance;
        vm.prank(operator);
        launcher.launch(_params("Thin", address(0)));
        assertEq(operator.balance, opBefore, "no allowance");
        assertEq(treasury.launchBudget(), 0.0001 ether);
    }

    function test_emptyBudgetReverts() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ConnexTreasury.InsufficientBudget.selector, 0.0005 ether, 0));
        launcher.launch(_params("Broke", address(0)));
    }

    function test_stockPairPassesThrough() public {
        MockToken nvda = new MockToken("NVIDIA", "NVDA", address(this), 1e24);
        factory.approvePair(address(nvda));
        uint256 fee = factory.launchFee();
        vm.prank(operator);
        (address token,) = launcher.launch{value: fee}(_params("Chip", address(nvda)));
        assertEq(factory.getLaunchedToken(token).pairToken, address(nvda));
        assertEq(launcher.launchAt(0).pairToken, address(nvda));
    }

    function test_burnStrayAnyone() public {
        address token = _launchPaid("Stray");
        _trade(token, 1 ether);
        uint256 bal = IERC20(token).balanceOf(alice);
        vm.prank(alice);
        IERC20(token).transfer(address(launcher), bal);
        vm.prank(bob);
        assertEq(launcher.burnStray(token), bal);
        assertEq(IERC20(token).balanceOf(address(launcher)), 0);
        assertEq(IERC20(token).balanceOf(launcher.BURN()), bal);
        vm.expectRevert(ConnexLauncher.NothingToBurn.selector);
        launcher.burnStray(token);
    }

    function test_refusesStrayEth() public {
        (bool ok,) = address(launcher).call{value: 1}("");
        assertFalse(ok);
    }

    function test_launchesPage() public {
        _launchPaid("A");
        vm.warp(vm.getBlockTimestamp() + LAUNCH_GAP);
        _launchPaid("B");
        vm.warp(vm.getBlockTimestamp() + LAUNCH_GAP);
        _launchPaid("C");
        ConnexLauncher.Launch[] memory page = launcher.launchesPage(1, 5);
        assertEq(page.length, 2);
        assertEq(page[0].token, launcher.launchAt(1).token);
        assertEq(launcher.launchesPage(9, 5).length, 0);
    }
}

contract TreasuryTest is ConnexBase {
    function test_constructorChecks() public {
        vm.expectRevert(ConnexTreasury.BadParams.selector);
        _treasury(10_001);
        vm.expectRevert(ConnexTreasury.ZeroAddress.selector);
        new ConnexTreasury(
            IPonsFactory(address(factory)),
            IPonsFeeEscrow(address(escrow)),
            ISwapRouter02(address(router)),
            IWETH(address(weth)),
            address(0),
            SHARE,
            OPS,
            CEILING,
            MAX_BUY,
            BUY_GAP,
            FALLBACK
        );
        vm.expectRevert(ConnexTreasury.BadParams.selector);
        new ConnexTreasury(
            IPonsFactory(address(factory)),
            IPonsFeeEscrow(address(escrow)),
            ISwapRouter02(address(router)),
            IWETH(address(weth)),
            operator,
            SHARE,
            OPS,
            CEILING,
            MAX_BUY,
            2 days,
            1 days
        );
    }

    function test_wireOnceByDeployer() public {
        ConnexTreasury t = _treasury(SHARE);
        ConnexLauncher l = new ConnexLauncher(IPonsFactory(address(factory)), address(t), operator, 0);
        vm.prank(alice);
        vm.expectRevert(ConnexTreasury.NotDeployer.selector);
        t.wire(address(l));
        // A launcher pointing at another treasury is refused.
        vm.expectRevert(ConnexTreasury.BadLauncher.selector);
        t.wire(address(launcher));
        t.wire(address(l));
        vm.expectRevert(ConnexTreasury.AlreadySet.selector);
        t.wire(address(l));
    }

    function test_collectSplitsFiftyFifty() public {
        address token = _launchPaid("Fees");
        _trade(token, 2 ether); // 0.02 fee, 0.014 to the creator
        treasury.sweepCurve(token);
        assertEq(treasury.buybackReserve(), 0.007 ether);
        assertEq(treasury.launchBudget(), 0.007 ether);
        assertEq(address(treasury).balance, 0.014 ether);
        assertEq(treasury.totalEthIn(), 0.014 ether);
        assertTrue(_accounted());
    }

    function test_oddWeiGoesToBudget() public {
        _gift(3);
        treasury.collect();
        assertEq(treasury.buybackReserve(), 1);
        assertEq(treasury.launchBudget(), 2);
    }

    function test_ceilingRollsOverToBuyback() public {
        _gift(2 ether);
        treasury.collect();
        assertEq(treasury.launchBudget(), CEILING);
        assertEq(treasury.buybackReserve(), 1.5 ether);
        assertEq(treasury.totalRolledOver(), 0.5 ether);
        _gift(1 ether);
        treasury.collect();
        assertEq(treasury.launchBudget(), CEILING);
        assertEq(treasury.buybackReserve(), 2.5 ether);
    }

    function test_collectIsIdempotent() public {
        _gift(1 ether);
        assertEq(treasury.collect(), 1 ether);
        assertEq(treasury.collect(), 0);
    }

    function test_sweepCurveRefusesForeignTokens() public {
        MockToken other = new MockToken("X", "X", address(this), 1);
        vm.expectRevert(ConnexTreasury.UnknownToken.selector);
        treasury.sweepCurve(address(other));
    }

    function test_sweepPoolUsesTheRightPoolId() public {
        address token = _launchPaid("Grad");
        factory.setPhase(token, 2);
        bytes32 id = keccak256(abi.encode(PoolKey(address(0), token, 0, 200, address(hook))));
        hook.register(id, address(treasury));
        hook.addFees{value: 0.1 ether}(id);
        treasury.sweepPool(token);
        assertEq(hook.lastSwept(), id);
        assertEq(treasury.buybackReserve(), 0.05 ether);
    }

    function test_sweepPoolSortsTokenPairs() public {
        MockToken nvda = new MockToken("NVIDIA", "NVDA", address(this), 1e24);
        factory.approvePair(address(nvda));
        uint256 fee = factory.launchFee();
        vm.prank(operator);
        (address token,) = launcher.launch{value: fee}(_params("Chip", address(nvda)));
        (address c0, address c1) = address(nvda) < token ? (address(nvda), token) : (token, address(nvda));
        bytes32 id = keccak256(abi.encode(PoolKey(c0, c1, 0, 200, address(hook))));
        hook.register(id, address(treasury));
        treasury.sweepPool(token);
        assertEq(hook.lastSwept(), id);
    }

    function test_tokenFeesSplitPerToken() public {
        MockToken nvda = new MockToken("NVIDIA", "NVDA", address(this), 1e24);
        nvda.approve(address(escrow), type(uint256).max);
        escrow.creditToken(address(treasury), address(nvda), 101);
        treasury.collectToken(address(nvda));
        assertEq(treasury.tokenBuyback(address(nvda)), 50);
        assertEq(treasury.tokenBudget(address(nvda)), 51);
        // Tokens sent directly are split on the next collect too.
        nvda.transfer(address(treasury), 10);
        treasury.collectToken(address(nvda));
        assertEq(treasury.tokenBuyback(address(nvda)) + treasury.tokenBudget(address(nvda)), 111);
    }

    function test_collectTokenRefusesLaunchTokens() public {
        address token = _launchPaid("Mine");
        vm.expectRevert(ConnexTreasury.NotPairToken.selector);
        treasury.collectToken(token);
    }

    function test_convertTokenKeepsItsSide() public {
        MockToken nvda = new MockToken("NVIDIA", "NVDA", address(this), 1e24);
        nvda.transfer(address(treasury), 100 ether);
        treasury.collectToken(address(nvda));
        vm.prank(alice);
        vm.expectRevert(ConnexTreasury.NotOperator.selector);
        treasury.convertToken(address(nvda), true, 10 ether, 500, 1);
        vm.prank(operator);
        vm.expectRevert(ConnexTreasury.NoMinimumOut.selector);
        treasury.convertToken(address(nvda), true, 10 ether, 500, 0);
        vm.prank(operator);
        uint256 out = treasury.convertToken(address(nvda), true, 10 ether, 500, 0.01 ether);
        assertEq(out, 0.01 ether);
        assertEq(treasury.buybackReserve(), 0.01 ether);
        assertEq(treasury.launchBudget(), 0);
        assertEq(treasury.tokenBuyback(address(nvda)), 40 ether);
        vm.prank(operator);
        treasury.convertToken(address(nvda), false, 50 ether, 500, 1);
        assertEq(treasury.launchBudget(), 0.05 ether);
        assertEq(treasury.tokenBudget(address(nvda)), 0);
        assertEq(treasury.unsplitEth(), 0, "conversions are booked in place");
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ConnexTreasury.TooMuch.selector, 1, 0));
        treasury.convertToken(address(nvda), false, 1, 500, 1);
    }

    function test_fundLaunchOnlyLauncher() public {
        vm.expectRevert(ConnexTreasury.NotLauncher.selector);
        treasury.fundLaunch(0.0005 ether);
    }

    function test_burnStrayOnlyLaunchTokens() public {
        MockToken other = new MockToken("X", "X", address(treasury), 5);
        vm.expectRevert(ConnexTreasury.UnknownToken.selector);
        treasury.burnStray(address(other));
        address token = _launchPaid("Stray");
        _trade(token, 1 ether);
        uint256 bal = IERC20(token).balanceOf(alice);
        vm.prank(alice);
        IERC20(token).transfer(address(treasury), bal);
        treasury.burnStray(token);
        assertEq(IERC20(token).balanceOf(address(treasury)), 0);
    }

    function test_refuserOperatorCannotBlockWithoutAllowance() public {
        // An operator that refuses ETH makes funded launches revert; launches it pays itself still work.
        EthRefuser r = new EthRefuser();
        ConnexTreasury t = new ConnexTreasury(
            IPonsFactory(address(factory)),
            IPonsFeeEscrow(address(escrow)),
            ISwapRouter02(address(router)),
            IWETH(address(weth)),
            address(r),
            SHARE,
            OPS,
            CEILING,
            MAX_BUY,
            BUY_GAP,
            FALLBACK
        );
        ConnexLauncher l = new ConnexLauncher(IPonsFactory(address(factory)), address(t), address(r), 0);
        t.wire(address(l));
        (bool ok,) = address(t).call{value: 1 ether}("");
        require(ok);
        vm.prank(address(r));
        vm.expectRevert(ConnexTreasury.PaymentFailed.selector);
        l.launch(_params("A", address(0)));
    }
}

contract BuybackTest is ConnexBase {
    ConnexBuyback sink;
    address connex;

    function setUp() public override {
        super.setUp();
        // $CONNEX itself: an ETH-paired Pons launch by someone else.
        PonsTokenParams memory p;
        p.name = "CONNEX";
        p.symbol = "CONNEX";
        p.creatorFeeRecipient = bob;
        p.salt = keccak256("connex");
        uint256 fee = factory.launchFee();
        vm.prank(bob);
        (connex,) = factory.launchToken{value: fee}(p, 0, address(0));
        sink = new ConnexBuyback(
            IPonsFactory(address(factory)), IPoolManager(address(pm)), address(treasury), connex
        );
    }

    function test_constructorWantsEthPonsLaunch() public {
        MockToken stray = new MockToken("X", "X", address(this), 1);
        vm.expectRevert(ConnexBuyback.NotPonsEthLaunch.selector);
        new ConnexBuyback(IPonsFactory(address(factory)), IPoolManager(address(pm)), address(treasury), address(stray));
    }

    function test_reserveWaitsUntilBuybackIsSet() public {
        _gift(1 ether);
        treasury.collect();
        vm.prank(operator);
        vm.expectRevert(ConnexTreasury.NotSet.selector);
        treasury.executeBuyback(0.01 ether, 1);
        assertEq(treasury.buybackReserve(), 0.5 ether, "saved for the first buyback");
    }

    function test_setBuybackOnce() public {
        vm.prank(alice);
        vm.expectRevert(ConnexTreasury.NotDeployer.selector);
        treasury.setBuyback(address(sink));
        ConnexBuyback other =
            new ConnexBuyback(IPonsFactory(address(factory)), IPoolManager(address(pm)), address(0xdead), connex);
        vm.expectRevert(ConnexTreasury.BadBuyback.selector);
        treasury.setBuyback(address(other));
        treasury.setBuyback(address(sink));
        vm.expectRevert(ConnexTreasury.AlreadySet.selector);
        treasury.setBuyback(address(sink));
    }

    function test_operatorBuysOnCurveAndBurns() public {
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(operator);
        (uint256 spent, uint256 burned) = treasury.executeBuyback(MAX_BUY, 1);
        assertEq(spent, MAX_BUY);
        assertGt(burned, 0);
        assertEq(IERC20(connex).balanceOf(sink.BURN()), burned);
        assertEq(IERC20(connex).balanceOf(address(sink)), 0);
        assertEq(IERC20(connex).balanceOf(address(treasury)), 0);
        assertEq(treasury.buybackReserve(), 0.5 ether - MAX_BUY);
        assertEq(treasury.totalBurned(), burned);
        assertTrue(_accounted());
    }

    function test_limits() public {
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(ConnexTreasury.TooSoon.selector, vm.getBlockTimestamp() + BUY_GAP));
        treasury.executeBuyback(0.01 ether, 1);
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.expectRevert(abi.encodeWithSelector(ConnexTreasury.TooMuch.selector, MAX_BUY + 1, MAX_BUY));
        treasury.executeBuyback(MAX_BUY + 1, 1);
        vm.expectRevert(ConnexTreasury.NoMinimumOut.selector);
        treasury.executeBuyback(0.01 ether, 0);
        vm.expectRevert(ConnexTreasury.ZeroAmount.selector);
        treasury.executeBuyback(0, 1);
        treasury.executeBuyback(0.01 ether, 1);
        vm.expectRevert(abi.encodeWithSelector(ConnexTreasury.TooSoon.selector, vm.getBlockTimestamp() + BUY_GAP));
        treasury.executeBuyback(0.01 ether, 1);
        vm.stopPrank();
    }

    function test_slippageReverts() public {
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(operator);
        vm.expectRevert();
        treasury.executeBuyback(0.01 ether, type(uint128).max);
        assertEq(treasury.buybackReserve(), 0.5 ether, "nothing moved");
    }

    function test_fallbackOpensAfterSilence() public {
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(alice);
        vm.expectRevert(ConnexTreasury.NotOperator.selector);
        treasury.executeBuyback(0.01 ether, 1);
        assertEq(treasury.buybackOpensIn(alice), FALLBACK - BUY_GAP);
        vm.warp(vm.getBlockTimestamp() + FALLBACK);
        vm.prank(alice);
        (, uint256 burned) = treasury.executeBuyback(0.01 ether, 1);
        assertGt(burned, 0);
        // The operator's buyback resets the clock for everyone else.
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(operator);
        treasury.executeBuyback(0.01 ether, 1);
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(alice);
        vm.expectRevert(ConnexTreasury.NotOperator.selector);
        treasury.executeBuyback(0.01 ether, 1);
    }

    function test_partialCurveFillRefundsToReserve() public {
        // Shrink the sellable part of $CONNEX's curve so a buy fills only partly.
        PonsLaunchedToken memory l = factory.getLaunchedToken(connex);
        MockCurve c = MockCurve(payable(l.curve));
        vm.prank(alice);
        c.buy{value: 6.77 ether}(6.77 ether, 1, alice);
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        uint256 reserve = treasury.buybackReserve();
        vm.prank(operator);
        (uint256 spent, uint256 burned) = treasury.executeBuyback(MAX_BUY, 1);
        assertGt(burned, 0);
        assertEq(treasury.buybackReserve(), reserve - spent, "unspent ETH came back to the reserve");
        assertTrue(_accounted());
    }

    function test_poolPathBurns() public {
        factory.setPhase(connex, 2);
        MockToken(connex).mint(address(pm), 1e30);
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(operator);
        (uint256 spent, uint256 burned) = treasury.executeBuyback(0.02 ether, 1);
        assertEq(spent, 0.02 ether);
        assertEq(burned, (0.02 ether * 1_000_000 * 99) / 100);
        assertEq(IERC20(connex).balanceOf(sink.BURN()), burned);
    }

    function test_poolPartialFillRefunds() public {
        factory.setPhase(connex, 2);
        MockToken(connex).mint(address(pm), 1e30);
        pm.setMaxIn(0.004 ether);
        _gift(1 ether);
        treasury.collect();
        treasury.setBuyback(address(sink));
        vm.warp(vm.getBlockTimestamp() + BUY_GAP);
        vm.prank(operator);
        (uint256 spent,) = treasury.executeBuyback(0.02 ether, 1);
        assertEq(spent, 0.004 ether);
        assertEq(treasury.buybackReserve(), 0.5 ether - 0.004 ether);
    }

    function test_sinkOnlyTreasury() public {
        vm.prank(alice);
        vm.expectRevert(ConnexBuyback.NotTreasury.selector);
        sink.buyAndBurn{value: 1 ether}(1);
    }

    function test_strayConnexBurnable() public {
        treasury.setBuyback(address(sink));
        PonsLaunchedToken memory l = factory.getLaunchedToken(connex);
        vm.prank(alice);
        MockCurve(payable(l.curve)).buy{value: 1 ether}(1 ether, 1, address(treasury));
        uint256 bal = IERC20(connex).balanceOf(address(treasury));
        treasury.burnStray(connex);
        assertEq(IERC20(connex).balanceOf(sink.BURN()), bal);
    }
}

contract SplitFuzzTest is ConnexBase {
    function testFuzz_splitAddsUp(uint96 a, uint96 b, uint16 share) public {
        share = uint16(bound(share, 0, 10_000));
        a = uint96(bound(a, 0, 20 ether));
        b = uint96(bound(b, 0, 20 ether));
        ConnexTreasury t = _treasury(share);
        (bool ok,) = address(t).call{value: a}("");
        require(ok);
        t.collect();
        (ok,) = address(t).call{value: b}("");
        require(ok);
        t.collect();
        assertEq(t.buybackReserve() + t.launchBudget(), uint256(a) + b);
        assertEq(t.totalEthIn(), uint256(a) + b);
        assertEq(t.totalToBuyback() + t.totalToBudget(), uint256(a) + b);
        assertLe(t.launchBudget(), CEILING);
        // Before the ceiling binds, the buyback side gets exactly its share (rounded down) of each split.
        uint256 expected = (uint256(a) * share) / 10_000 + (uint256(b) * share) / 10_000;
        assertGe(t.buybackReserve(), expected);
    }

    function testFuzz_launchesNeverOverdraw(uint8 n, uint64 gift) public {
        n = uint8(bound(n, 1, 20));
        _gift(gift);
        uint256 fee = factory.launchFee();
        for (uint256 i = 0; i < n; ++i) {
            uint256 before = address(treasury).balance;
            uint256 opBefore = operator.balance;
            vm.prank(operator);
            try launcher.launch(_params("F", address(0))) {
                uint256 paidOps = operator.balance - opBefore;
                assertEq(before - address(treasury).balance, fee + paidOps, "only the fee and the allowance leave");
                assertTrue(paidOps == 0 || paidOps == OPS);
            } catch {
                assertEq(address(treasury).balance, before, "a refused launch moves nothing");
            }
            assertEq(address(launcher).balance, 0);
            vm.warp(vm.getBlockTimestamp() + LAUNCH_GAP);
            assertTrue(_accounted());
        }
    }
}
