// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title PopCoin NFT Collection
/// @author Agustin Acosta
/// @notice Implementation of the PopCoin NFT collection.
/// @dev Inherits standard ERC721 from OpenZeppelin, optimized with custom errors.
contract PopCoinNFTCollection is ERC721 {
    using Strings for uint256;

    // ═══════════════════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice The ID that will be assigned to the next minted NFT.
    uint256 public currentTokenId;

    /// @notice The maximum amount of NFTs that can be minted.
    uint256 public immutable totalSupply;

    /// @notice The base metadata URI for tokenURI concatenation.
    string public baseUri;

    // ═══════════════════════════════════════════════════════════════════════
    // CUSTOM ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Thrown when the total supply has been reached and no more NFTs can be minted.
    error SoldOut();

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a new NFT is minted.
    event MintNFT(address indexed userAddress, uint256 indexed tokenId);

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Initializes the collection with a name, symbol, total supply, and base URI.
    /// @param _name The name of the NFT collection.
    /// @param _symbol The symbol of the NFT collection.
    /// @param _totalSupply The maximum limit of mintable tokens.
    /// @param _baseUri The base URI for metadata.
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        string memory _baseUri
    ) ERC721(_name, _symbol) {
        totalSupply = _totalSupply;
        baseUri = _baseUri;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WRITE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Mints a new PopCoin NFT to the caller.
    /// @dev Increases currentTokenId by 1. Reverts if sold out.
    function mint() external {
        if (currentTokenId >= totalSupply) {
            revert SoldOut();
        }
        address userAddress = msg.sender;
        uint256 tokenId = currentTokenId;

        _safeMint(userAddress, tokenId);
        currentTokenId++;

        emit MintNFT(userAddress, tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Returns the token URI containing metadata for a given token ID.
    /// @param tokenId The ID of the query token.
    /// @return The complete token metadata URI.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string.concat(baseURI, tokenId.toString(), ".json") : "";
    }

    /// @dev Internal override to return the base metadata URI.
    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }
}
