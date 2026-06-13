// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {PopCoinNFTCollection} from "../contracts/PopCoinNFTCollection.sol";

/// @title DeployPopCoin
/// @author Agustin Acosta
/// @notice Deployment script for PopCoinNFTCollection.
contract DeployPopCoin is Script {
    function run() external returns (address) {
        // Load deployer private key from environment or default to 0 for local runs
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        string memory name = "PopCoin NFT Collection";
        string memory symbol = "POP";
        uint256 totalSupply = 100;
        string memory baseUri = "ipfs://bafybeieyvfd4dmfob3o5466joando37trerrzxnrluvsau4tixuz72h4tm/metadata/";

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        PopCoinNFTCollection nft = new PopCoinNFTCollection(name, symbol, totalSupply, baseUri);

        vm.stopBroadcast();
        return address(nft);
    }
}
