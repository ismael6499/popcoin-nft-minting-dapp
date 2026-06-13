// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PopCoinNFTCollection} from "../contracts/PopCoinNFTCollection.sol";

/// @title PopCoinNFTCollectionTest
/// @author Agustin Acosta
/// @notice Unit tests for PopCoinNFTCollection.
contract PopCoinNFTCollectionTest is Test {
    PopCoinNFTCollection nft;

    string constant NAME = "PopCoin NFT Collection";
    string constant SYMBOL = "POP";
    uint256 constant TOTAL_SUPPLY = 3;
    string constant BASE_URI = "https://api.popcoin.io/metadata/";

    address ALICE = makeAddr("alice");
    address BOB = makeAddr("bob");

    // Declare OpenZeppelin's ERC721 nonexistent token error for validation
    error ERC721NonexistentToken(uint256 tokenId);

    function setUp() public {
        nft = new PopCoinNFTCollection(NAME, SYMBOL, TOTAL_SUPPLY, BASE_URI);
    }

    function test_InitialState() public view {
        assertEq(nft.name(), NAME);
        assertEq(nft.symbol(), SYMBOL);
        assertEq(nft.totalSupply(), TOTAL_SUPPLY);
        assertEq(nft.currentTokenId(), 0);
    }

    function test_Mint_Success() public {
        vm.prank(ALICE);
        nft.mint();

        assertEq(nft.balanceOf(ALICE), 1);
        assertEq(nft.ownerOf(0), ALICE);
        assertEq(nft.currentTokenId(), 1);
    }

    function test_Mint_MultipleSuccess() public {
        vm.prank(ALICE);
        nft.mint();

        vm.prank(BOB);
        nft.mint();

        assertEq(nft.balanceOf(ALICE), 1);
        assertEq(nft.balanceOf(BOB), 1);
        assertEq(nft.ownerOf(0), ALICE);
        assertEq(nft.ownerOf(1), BOB);
        assertEq(nft.currentTokenId(), 2);
    }

    function test_RevertWhen_SoldOut() public {
        // Mint up to the total supply limit
        vm.prank(ALICE);
        nft.mint();

        vm.prank(BOB);
        nft.mint();

        vm.prank(ALICE);
        nft.mint();

        assertEq(nft.currentTokenId(), TOTAL_SUPPLY);

        // Next mint should fail since we are sold out
        vm.prank(BOB);
        vm.expectRevert(PopCoinNFTCollection.SoldOut.selector);
        nft.mint();
    }

    function test_TokenURI() public {
        vm.prank(ALICE);
        nft.mint();

        string memory expectedUri = string.concat(BASE_URI, "0.json");
        assertEq(nft.tokenURI(0), expectedUri);
    }

    function test_RevertWhen_TokenURINonExistent() public {
        // Verify custom error from OpenZeppelin reverts correctly
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 99));
        nft.tokenURI(99);
    }
}
