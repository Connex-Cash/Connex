// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Uniswap v4 PoolManager surface (0x8366a39CC670B4001A1121B8F6A443A643e40951 on Robinhood Chain).

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

interface IPoolManager {
    function unlock(bytes calldata data) external returns (bytes memory);

    /// @return swapDelta packed BalanceDelta: amount0 in the upper 128 bits, amount1 in the lower 128 bits.
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external returns (int256 swapDelta);

    function sync(address currency) external;

    function settle() external payable returns (uint256 paid);

    function take(address currency, address to, uint256 amount) external;
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}
