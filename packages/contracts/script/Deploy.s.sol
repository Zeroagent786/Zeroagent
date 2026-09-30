// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {TaskEscrow} from "../src/TaskEscrow.sol";
import {AgentPolicyGuardModule} from "../src/PolicyGuardModule.sol";

/// @notice Deploys the full ZeroAgent suite and seeds demo agents.
contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        AgentIdentityRegistry registry = new AgentIdentityRegistry();
        TaskEscrow escrow = new TaskEscrow(address(registry), vm.envAddress("USDC_ADDRESS"));
        registry.setEscrow(address(escrow));
        AgentPolicyGuardModule guard = new AgentPolicyGuardModule();

        _seed(registry, "DataWorker-SGX", "data-indexer,mcp-stdio,eip-3009", AgentIdentityRegistry.ValidationType.TEE);
        _seed(registry, "DeFi-Trader-Alpha", "defi-arbitrage,streamable-http", AgentIdentityRegistry.ValidationType.TEE);
        _seed(registry, "zkTLS-Scraper", "zk-scraper,mcp-stdio", AgentIdentityRegistry.ValidationType.ZkTLS);

        vm.stopBroadcast();

        console2.log("REGISTRY", address(registry));
        console2.log("ESCROW", address(escrow));
        console2.log("GUARD", address(guard));
        console2.log("BLOCK", block.number);
    }

    function _seed(
        AgentIdentityRegistry registry,
        string memory name,
        string memory caps,
        AgentIdentityRegistry.ValidationType vt
    ) private {
        registry.registerAgent(name, caps, vt, keccak256(bytes(name)), string.concat("ipfs://zeroagent/", name));
    }
}
