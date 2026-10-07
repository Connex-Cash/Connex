// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ConnexLauncher} from "../src/ConnexLauncher.sol";
import {ConnexTreasury} from "../src/ConnexTreasury.sol";
import {ConnexBuyback} from "../src/ConnexBuyback.sol";
import {IPonsFactory, IPonsFeeEscrow, IPonsCurve, PonsLaunchedToken} from "../src/interfaces/IPons.sol";
import {IPoolManager} from "../src/interfaces/IPoolManager.sol";
import {ExactInputSingleParams, ISwapRouter02, IWETH} from "../src/interfaces/IUniswapV3.sol";

interface IPonsFactoryFull is IPonsFactory {
    function createGraduatedPool(address token) external returns (uint256 positionId);
    function launchEnabled() external view returns (bool);
    function approvedPairTokens(address token) external view returns (bool);
    function feeEscrow() external view returns (address);
}

interface IWETHDeposit {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

/// Runs against Robinhood Chain mainnet state:
///   forge test --match-path test/Connex.fork.t.sol --fork-url https://robinhood.drpc.org --evm-version cancun
/// Launches real Pons V2 tokens through ConnexLauncher (ETH pair and NVDA pair), trades them,
/// sweeps the creator fees into ConnexTreasury, converts NVDA fees to ETH on Uniswap v3,
/// pays a launch from the budget, graduates a token, and buys back and burns through ConnexBuyback
/// on both the curve and the Uniswap v4 pool.
contract ConnexForkTest is Test {
    IPonsFactoryFull constant PONS = IPonsFactoryFull(0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e);
    IPonsFeeEscrow constant ESCROW = IPonsFeeEscrow(0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e);
    IPoolManager constant POOL_MANAGER = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    ISwapRouter02 constant ROUTER = ISwapRouter02(0xCaf681a66D020601342297493863E78C959E5cb2);
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;

    ConnexTreasury treasury;
    ConnexLauncher launcher;
    address operator = makeAddr("operator");
    address trader = makeAddr("trader");
    address whale = makeAddr("whale");

    function setUp() public {
        if (block.chainid != 4663) return;
        treasury = new ConnexTreasury(
            PONS, ESCROW, ROUTER, IWETH(WETH), operator, 5000, 0.0005 ether, 0.5 ether, 0.05 ether, 1 hours, 7 days
        );
        launcher = new ConnexLauncher(PONS, address(treasury), operator, 10 minutes);
        treasury.wire(address(launcher));
        vm.deal(operator, 1 ether);
        vm.deal(trader, 50 ether);
        vm.deal(whale, 50 ether);
    }

    function _params(string memory name, string memory symbol, address pair)
        internal
        pure
        returns (ConnexLauncher.LaunchParams memory p)
    {
        p.name = name;
        p.symbol = symbol;
        p.description = "fork test";
        p.website = "https://connex.cash";
        p.pairToken = pair;
        p.round = 1;
        p.sourceHash = keccak256("evidence");
        p.playbookHash = keccak256("playbook");
    }

    function _launchSelfPaid(string memory name, address pair) internal returns (address token) {
        uint256 fee = PONS.launchFee();
        vm.prank(operator);
        (token,) = launcher.launch{value: fee}(_params(name, "FORK", pair));
    }

    function test_fork_launchHoldsZeroAndFeesSplit() public {
        if (block.chainid != 4663) return;
        assertTrue(PONS.launchEnabled());
        address token = _launchSelfPaid("Fork Trend", address(0));
        PonsLaunchedToken memory l = PONS.getLaunchedToken(token);
        assertTrue(l.exists);
        assertEq(l.deployer, address(launcher), "the launcher is the Pons deployer");
        assertEq(l.creatorFeeRecipient, address(treasury), "the treasury receives creator fees");
        assertEq(l.creatorTaxBps, 0);
        assertFalse(l.buybackEnabled);
        assertEq(l.pairToken, address(0));
        assertEq(IERC20(token).balanceOf(address(launcher)), 0, "dev holds zero");
        assertEq(IERC20(token).balanceOf(address(treasury)), 0);
        assertEq(IERC20(token).balanceOf(operator), 0);

        // An ordinary buyer after the snipe window.
        vm.warp(vm.getBlockTimestamp() + 10);
        vm.prank(trader);
        IPonsCurve(l.curve).buy{value: 2 ether}(2 ether, 1, trader);

        treasury.sweepCurve(token);
        uint256 got = treasury.buybackReserve() + treasury.launchBudget();
        console.log("creator fee booked from a 2 ETH buy (wei)", got);
        assertGt(got, 0.013 ether, "~70% of the 1% curve fee");
        assertLt(got, 0.0141 ether);
        assertApproxEqAbs(treasury.buybackReserve(), got / 2, 1);
        assertEq(address(treasury).balance, got);

        // The next launch is paid by the budget.
        vm.warp(vm.getBlockTimestamp() + 10 minutes);
        uint256 opBefore = operator.balance;
        vm.prank(operator);
        (address second,) = launcher.launch(_params("Second Trend", "FORK2", address(0)));
        assertTrue(PONS.getLaunchedToken(second).exists);
        assertEq(operator.balance - opBefore, 0.0005 ether, "allowance paid");
        assertEq(treasury.totalLaunchFees(), PONS.launchFee());
    }

    function test_fork_stockPairFeesConvert() public {
        if (block.chainid != 4663) return;
        assertTrue(PONS.approvedPairTokens(NVDA), "Pons accepts NVDA as a pair");
        address token = _launchSelfPaid("Chip Trend", NVDA);
        PonsLaunchedToken memory l = PONS.getLaunchedToken(token);
        assertEq(l.pairToken, NVDA);

        // Get NVDA through Uniswap v3 (WETH/NVDA 0.05%).
        vm.startPrank(trader);
        IWETHDeposit(WETH).deposit{value: 0.2 ether}();
        IWETHDeposit(WETH).approve(address(ROUTER), 0.2 ether);
        uint256 nvdaOut = ROUTER.exactInputSingle(
            ExactInputSingleParams(WETH, NVDA, 500, trader, 0.2 ether, 1, 0)
        );
        assertGt(nvdaOut, 0);
        vm.warp(vm.getBlockTimestamp() + 10);
        IERC20(NVDA).approve(l.curve, nvdaOut);
        IPonsCurve(l.curve).buy(nvdaOut, 1, trader);
        vm.stopPrank();

        treasury.sweepCurve(token);
        uint256 side = treasury.tokenBuyback(NVDA);
        assertGt(side, 0, "NVDA fees booked");
        assertApproxEqAbs(side, treasury.tokenBudget(NVDA), 1);

        vm.prank(operator);
        uint256 ethOut = treasury.convertToken(NVDA, true, side, 500, 1);
        assertGt(ethOut, 0);
        assertEq(treasury.buybackReserve(), ethOut, "the buyback half stays on the buyback side");
        assertEq(treasury.tokenBuyback(NVDA), 0);
        assertEq(IERC20(token).balanceOf(address(launcher)), 0);
    }

    function test_fork_buybackCurveThenPool() public {
        if (block.chainid != 4663) return;
        // A stand-in for $CONNEX: an ETH-paired Pons launch.
        address stand = _launchSelfPaid("Stand In", address(0));
        ConnexBuyback sink = new ConnexBuyback(PONS, POOL_MANAGER, address(treasury), stand);
        treasury.setBuyback(address(sink));

        // Fund the buyback side.
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        require(ok);
        treasury.collect();

        // Curve phase.
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        vm.prank(operator);
        (uint256 spent, uint256 burned) = treasury.executeBuyback(0.05 ether, 1);
        assertEq(spent, 0.05 ether);
        assertGt(burned, 0);
        assertEq(IERC20(stand).balanceOf(sink.BURN()), burned);

        // Graduate: buy the curve out, seed the v4 pool.
        PonsLaunchedToken memory l = PONS.getLaunchedToken(stand);
        vm.prank(whale);
        IPonsCurve(l.curve).buy{value: 8 ether}(8 ether, 1, whale);
        assertEq(PONS.getLaunchedToken(stand).phase, 1);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        vm.prank(operator);
        vm.expectRevert(ConnexBuyback.TradingPaused.selector);
        treasury.executeBuyback(0.01 ether, 1);
        PONS.createGraduatedPool(stand);
        assertEq(PONS.getLaunchedToken(stand).phase, 2);

        uint256 burnBefore = IERC20(stand).balanceOf(sink.BURN());
        vm.prank(operator);
        (spent, burned) = treasury.executeBuyback(0.05 ether, 1);
        assertEq(spent, 0.05 ether);
        assertGt(burned, 0);
        assertEq(IERC20(stand).balanceOf(sink.BURN()) - burnBefore, burned);
        assertEq(IERC20(stand).balanceOf(address(sink)), 0);
        assertEq(address(sink).balance, 0);
        assertEq(address(treasury).balance, treasury.buybackReserve() + treasury.launchBudget());

        // Pool fees on a graduated CONNEX launch: buys leave the fee in the memecoin,
        // which only Pons' operator may convert, so the treasury's own sweep is refused until then.
        try treasury.sweepPool(stand) {
            console.log("pool sweep went through");
        } catch (bytes memory reason) {
            console.log("pool sweep refused (expected while memecoin fees are pending)");
            console.logBytes(reason);
        }
    }
}
