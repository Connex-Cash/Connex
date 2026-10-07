// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Uniswap SwapRouter02 on Robinhood Chain (0xcaf681a66d020601342297493863e78c959e5cb2).
/// This build's exactInputSingle has no deadline field.
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

interface ISwapRouter02 {
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// Wrapped ETH on Robinhood Chain (0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73).
interface IWETH {
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}
