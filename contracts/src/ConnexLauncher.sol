// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPonsFactory, PonsSocials, PonsTokenParams} from "./interfaces/IPons.sol";

interface ILaunchTreasury {
    function fundLaunch(uint256 amount) external;
}

/// @title ConnexLauncher
/// @notice Creates every CONNEX token on the Pons V2 launch factory.
///
/// What this contract makes checkable on chain:
/// - It never buys. `launch` sends Pons exactly its launch fee and nothing
///   else, so the whole supply starts on the bonding curve.
/// - It can never move a launched token: there is no transfer, approve or
///   withdraw function. Anything that lands here can only be burned, by
///   anyone, through `burnStray`.
/// - Every launch names the CONNEX treasury as its Pons creator fee recipient,
///   with zero creator tax and Pons' buyback route off. The treasury has no
///   function that hands that right to anyone else.
///
/// What it does not cover: the operator is an ordinary wallet, and nothing on
/// chain stops that wallet from buying a token on the open market like anyone
/// else. Its balances are public; the site reads them for every launch.
///
/// No owner, no admin, no upgrade. The operator (the agent's hot wallet) and
/// the minimum gap between launches are fixed in the constructor.
contract ConnexLauncher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    IPonsFactory public immutable factory;
    address public immutable treasury;
    address public immutable operator;
    /// @notice Minimum number of seconds between two launches.
    uint256 public immutable minInterval;

    struct LaunchParams {
        string name;
        string symbol;
        string logo;
        string description;
        string website;
        string twitter;
        /// 0 = ETH, otherwise a pair token Pons has approved (USDG or a Robinhood stock token).
        address pairToken;
        uint256 launchConfigId;
        bytes32 expectedEconomics;
        /// Round number, counted by the agent (rounds start at :00 and :30 UTC).
        uint32 round;
        /// keccak256 of the evidence the agent picked the trend from (post URLs, scores).
        bytes32 sourceHash;
        /// keccak256 of the playbook version in force for this launch.
        bytes32 playbookHash;
    }

    struct Launch {
        address token;
        address curve;
        address pairToken;
        uint40 launchedAt;
        uint32 round;
        bytes32 sourceHash;
        bytes32 playbookHash;
    }

    Launch[] private _launches;
    mapping(address token => uint256 indexPlusOne) private _indexOf;
    uint256 public lastLaunchAt;

    bool private _expectingEth;

    event Launched(
        uint256 indexed index,
        address indexed token,
        address curve,
        address pairToken,
        uint32 round,
        bytes32 sourceHash,
        bytes32 playbookHash,
        uint256 launchFee,
        bool feeFromTreasury
    );
    event StrayBurned(address indexed token, uint256 amount);

    error ZeroAddress();
    error NotOperator();
    error TooSoon(uint256 nextAt);
    error WrongValue(uint256 expected);
    error HoldsTokens(uint256 balance);
    error UnexpectedEth();
    error NothingToBurn();

    constructor(IPonsFactory factory_, address treasury_, address operator_, uint256 minInterval_) {
        if (address(factory_) == address(0) || treasury_ == address(0) || operator_ == address(0)) {
            revert ZeroAddress();
        }
        factory = factory_;
        treasury = treasury_;
        operator = operator_;
        minInterval = minInterval_;
    }

    /// The only ETH this contract takes is the launch fee the treasury sends while a launch is running.
    receive() external payable {
        if (!_expectingEth || msg.sender != treasury) revert UnexpectedEth();
    }

    /// @notice Launches one token on Pons. Operator only.
    /// Send exactly Pons' launch fee to pay it yourself, or no value to have the
    /// treasury's launch budget pay it.
    function launch(LaunchParams calldata p) external payable nonReentrant returns (address token, address curve) {
        if (msg.sender != operator) revert NotOperator();
        uint256 count = _launches.length;
        if (count != 0 && block.timestamp < lastLaunchAt + minInterval) revert TooSoon(lastLaunchAt + minInterval);

        uint256 fee = factory.launchFee();
        bool fromTreasury = msg.value == 0;
        if (fromTreasury) {
            uint256 before = address(this).balance;
            _expectingEth = true;
            ILaunchTreasury(treasury).fundLaunch(fee);
            _expectingEth = false;
            if (address(this).balance - before != fee) revert WrongValue(fee);
        } else if (msg.value != fee) {
            revert WrongValue(fee);
        }

        (token, curve) = factory.launchToken{value: fee}(
            PonsTokenParams({
                name: p.name,
                symbol: p.symbol,
                logo: p.logo,
                description: p.description,
                socials: PonsSocials({twitter: p.twitter, telegram: "", discord: "", website: p.website, farcaster: ""}),
                creatorFeeRecipient: treasury,
                creatorTaxBps: 0,
                buybackEnabled: false,
                expectedEconomics: p.expectedEconomics,
                salt: keccak256(abi.encode(address(this), count))
            }),
            p.launchConfigId,
            p.pairToken
        );

        // The launch put every token on the curve; nothing may have come here.
        uint256 held = IERC20(token).balanceOf(address(this));
        if (held != 0) revert HoldsTokens(held);

        _launches.push(
            Launch({
                token: token,
                curve: curve,
                pairToken: p.pairToken,
                launchedAt: uint40(block.timestamp),
                round: p.round,
                sourceHash: p.sourceHash,
                playbookHash: p.playbookHash
            })
        );
        _indexOf[token] = count + 1;
        lastLaunchAt = block.timestamp;
        emit Launched(count, token, curve, p.pairToken, p.round, p.sourceHash, p.playbookHash, fee, fromTreasury);
    }

    /// @notice Burns any balance of `token` that was sent here. Anyone can call it.
    function burnStray(address token) external nonReentrant returns (uint256 amount) {
        amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) revert NothingToBurn();
        IERC20(token).safeTransfer(BURN, amount);
        emit StrayBurned(token, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function launchAt(uint256 index) external view returns (Launch memory) {
        return _launches[index];
    }

    function isLaunch(address token) public view returns (bool) {
        return _indexOf[token] != 0;
    }

    function indexOf(address token) external view returns (uint256) {
        uint256 i = _indexOf[token];
        require(i != 0, "not a CONNEX launch");
        return i - 1;
    }

    /// @notice Up to `limit` launches from `offset`, oldest first.
    function launchesPage(uint256 offset, uint256 limit) external view returns (Launch[] memory page) {
        uint256 n = _launches.length;
        if (offset >= n) return new Launch[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        page = new Launch[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _launches[i];
        }
    }

    /// @notice Seconds until the next launch is allowed (0 when it is allowed now).
    function nextLaunchIn() external view returns (uint256) {
        if (_launches.length == 0) return 0;
        uint256 at = lastLaunchAt + minInterval;
        return block.timestamp >= at ? 0 : at - block.timestamp;
    }
}
