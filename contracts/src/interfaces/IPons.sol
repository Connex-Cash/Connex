// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The parts of the Pons V2 launch stack on Robinhood Chain that Astrue calls.
/// Signatures match the verified source of PonsV2LaunchFactory
/// (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e) and PonsV2BondingCurve.

struct PonsSocials {
    string twitter;
    string telegram;
    string discord;
    string website;
    string farcaster;
}

struct PonsTokenParams {
    string name;
    string symbol;
    string logo;
    string description;
    PonsSocials socials;
    address creatorFeeRecipient;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    bytes32 expectedEconomics;
    bytes32 salt;
}

/// Mirrors GraduationPhase in the factory: 0 curve, 1 swept, 2 pool, 3 rescued.
struct PonsLaunchedToken {
    address token;
    address curve;
    address deployer;
    address creatorFeeRecipient;
    address pairToken;
    uint256 graduationThreshold;
    uint24 poolFee;
    int24 tickSpacing;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    uint8 phase;
    uint256 sweptQuote;
    uint256 sweptTokens;
    uint256 sweptAt;
    bool exists;
}

interface IPonsFactory {
    function launchToken(PonsTokenParams calldata params, uint256 launchConfigId, address pairToken)
        external
        payable
        returns (address token, address curve);

    function getLaunchedToken(address token) external view returns (PonsLaunchedToken memory);

    function launchFee() external view returns (uint256);

    function memeHook() external view returns (address);
}

interface IPonsCurve {
    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensOut);

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256 quoteOut);

    function graduated() external view returns (bool);

    function readyToGraduate() external view returns (bool);
}

/// Pons' shared claimable-balance ledger (0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e).
/// Curves and the meme hook credit creator fees here; the creator fee recipient claims them.
interface IPonsFeeEscrow {
    function claim() external returns (uint256 amount);
    function claimToken(address token) external returns (uint256 amount);
    function balanceOf(address recipient) external view returns (uint256);
    function balanceOfToken(address recipient, address token) external view returns (uint256);
}

/// Fee sweep on a curve: callable by Pons' sweep operator or the token's creator fee recipient.
interface IPonsCurveFees {
    function sweepFees(uint256 minBuybackTokensOut) external;
}

/// Fee sweep on a graduated pool's meme hook: same callers as the curve sweep.
interface IPonsMemeHook {
    function sweepPoolFees(bytes32 poolId, uint256 minConversionQuoteOut, uint256 minBuybackTokensOut) external;
}
