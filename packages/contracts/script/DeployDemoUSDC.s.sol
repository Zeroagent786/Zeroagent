// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DemoUSDC} from "../src/DemoUSDC.sol";
import {TaskEscrow} from "../src/TaskEscrow.sol";

/// @notice Deploys the testnet-only DemoUSDC, sets the faucet as minter and allow-lists it in TaskEscrow.
/// @dev The broadcaster (PRIVATE_KEY) must be the escrow arbiter.
contract DeployDemoUSDCScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address faucet = vm.envAddress("FAUCET_ADDRESS");
        TaskEscrow escrow = TaskEscrow(vm.envAddress("ESCROW_ADDRESS"));

        vm.startBroadcast(pk);
        DemoUSDC token = new DemoUSDC();
        token.setMinter(faucet);
        escrow.setTokenAllowed(address(token), true);
        vm.stopBroadcast();

        console2.log("DEMO_USDC", address(token));
        console2.log("BLOCK", block.number);
    }
}
