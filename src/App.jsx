import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'

// Deployed PopCoin Contract Address on Arbitrum One Mainnet & Sepolia
const DEFAULT_MAINNET_ADDRESS = '0xd068673a424a8d90e9c34ccce03c1854547ddb7f'
const DEFAULT_SEPOLIA_ADDRESS = '0xD068673a424a8d90E9C34CCCE03C1854547DdB7f'

const CHAIN_CONFIGS = {
  '0xa4b1': {
    name: 'Arbitrum One',
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    address: DEFAULT_MAINNET_ADDRESS,
    isTestnet: false
  },
  '0x66eee': {
    name: 'Arbitrum Sepolia',
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    address: DEFAULT_SEPOLIA_ADDRESS,
    isTestnet: true
  }
}

const CONTRACT_ABI = [
  "function mint() external payable",
  "function mint(uint256 quantity) external payable",
  "function balanceOf(address owner) external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function currentTokenId() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function MAX_SUPPLY() external view returns (uint256)",
  "function MINT_PRICE() external view returns (uint256)"
]

function App() {
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [contractAddress, setContractAddress] = useState(DEFAULT_MAINNET_ADDRESS)
  const [tokenInfo, setTokenInfo] = useState({ name: 'PopCoin NFT Collection', symbol: 'PCNFT', minted: 42, total: 1000, price: '0.01' })
  const [balance, setBalance] = useState('0')
  const [mintQuantity, setMintQuantity] = useState(1)

  // Loading & Transaction States
  const [isLoading, setIsLoading] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [mintStatus, setMintStatus] = useState('')
  const [gasEstimate, setGasEstimate] = useState('0.00012')
  const [lastTxHash, setLastTxHash] = useState('')

  // Check if wallet is already connected
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(handleAccountsChanged)
        .catch(console.error)

      window.ethereum.request({ method: 'eth_chainId' })
        .then(handleChainChanged)
        .catch(console.error)

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  // Sync token metadata and balances when chain or account changes
  useEffect(() => {
    if (isConnected && account && chainId) {
      fetchContractData()
    }
  }, [isConnected, account, chainId, contractAddress])

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setIsConnected(false)
      setAccount('')
    } else {
      setAccount(accounts[0])
      setIsConnected(true)
    }
  }

  const handleChainChanged = (newChainId) => {
    setChainId(newChainId)
    if (CHAIN_CONFIGS[newChainId]) {
      setContractAddress(CHAIN_CONFIGS[newChainId].address)
    } else {
      setContractAddress(DEFAULT_MAINNET_ADDRESS)
    }
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or a Web3 compatible browser extension to connect.')
      return
    }
    try {
      setIsLoading(true)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      handleAccountsChanged(accounts)
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      handleChainChanged(currentChainId)
    } catch (err) {
      console.error('Wallet connection failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      })
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          const config = CHAIN_CONFIGS[targetChainId]
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: targetChainId,
              chainName: config.name,
              rpcUrls: [config.rpc],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: [config.explorer]
            }],
          })
        } catch (addError) {
          console.error('Failed to add network:', addError)
        }
      }
    }
  }

  const fetchContractData = async () => {
    setIsLoading(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider)

      const [name, symbol, userBalance] = await Promise.all([
        contract.name().catch(() => 'PopCoin NFT Collection'),
        contract.symbol().catch(() => 'PCNFT'),
        contract.balanceOf(account).catch(() => 0)
      ])

      let mintedCount = 42
      let maxSupply = 1000

      try {
        const total = await contract.totalSupply()
        mintedCount = Number(total)
      } catch (e) {
        try {
          const curr = await contract.currentTokenId()
          mintedCount = Number(curr)
        } catch (err) {}
      }

      setTokenInfo({
        name,
        symbol,
        minted: mintedCount,
        total: maxSupply,
        price: '0.01'
      })
      setBalance(userBalance ? userBalance.toString() : '0')
    } catch (err) {
      console.error('Error fetching contract data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const mintToken = async () => {
    if (!isConnected || !account) {
      connectWallet()
      return
    }

    try {
      setIsMinting(true)
      setMintStatus('Preparing transaction...')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer)

      const mintPriceWei = ethers.parseEther((0.01 * mintQuantity).toString())
      setMintStatus('Please confirm transaction in your wallet...')

      let tx
      try {
        tx = await contract['mint(uint256)'](mintQuantity, { value: mintPriceWei })
      } catch (e) {
        tx = await contract['mint()']({ value: mintPriceWei })
      }

      setMintStatus('Transaction submitted! Awaiting block confirmation...')
      setLastTxHash(tx.hash)

      await tx.wait()
      setMintStatus('SUCCESS')
      fetchContractData()
    } catch (err) {
      console.error('Minting error:', err)
      setMintStatus(err.message ? err.message.slice(0, 100) : 'Transaction rejected or failed.')
    } finally {
      setIsMinting(false)
    }
  }

  const activeConfig = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS['0xa4b1']
  const isSupportedChain = !!CHAIN_CONFIGS[chainId]

  return (
    <div className="app-container">
      {/* Background Animated Glowing Orbs */}
      <div className="ambient-orb orb-1"></div>
      <div className="ambient-orb orb-2"></div>
      <div className="ambient-orb orb-3"></div>

      {/* Navigation Header */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <span className="coin-icon">🪙</span>
          </div>
          <div className="brand-titles">
            <span className="brand-name">PopCoin</span>
            <span className="brand-badge">Arbitrum Web3</span>
          </div>
        </div>

        <div className="nav-actions">
          <a
            href="https://github.com/ismael6499/popcoin-nft-minting-dapp"
            target="_blank"
            rel="noopener noreferrer"
            className="author-badge-link"
          >
            <span className="author-dot"></span> Built by Agustin Acosta
          </a>

          {isConnected ? (
            <button className="btn btn-connected" onClick={() => setAccount('')}>
              <span className="status-indicator"></span>
              {account.slice(0, 6)}...{account.slice(-4)}
            </button>
          ) : (
            <button className="btn btn-primary btn-glow" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Main DApp Hero Section */}
      <main className="main-content">
        <div className="dapp-grid">
          
          {/* Left Column: NFT Visual Showcase Card */}
          <div className="showcase-card">
            <div className="nft-preview-box">
              <div className="nft-badge-top">
                <span className="badge-chip">ERC-721 Standard</span>
                <span className="badge-chip highlight">Arbitrum One</span>
              </div>

              <div className="nft-art-container">
                <div className="coin-3d-ring"></div>
                <div className="coin-emblem">
                  <div className="coin-face">
                    <span className="coin-symbol">⚡</span>
                    <span className="coin-title">POPCOIN</span>
                  </div>
                </div>
              </div>

              <div className="nft-preview-info">
                <h3>PopCoin Genesis NFT</h3>
                <p>Limited Edition 1,000 Utility Tokenized Assets on Arbitrum</p>
                <div className="nft-price-tag">
                  <span>Mint Price</span>
                  <strong>0.01 ETH</strong>
                </div>
              </div>
            </div>

            {/* Contract Properties Grid */}
            <div className="traits-grid">
              <div className="trait-card">
                <span className="trait-label">Standard</span>
                <span className="trait-value">ERC-721 Enumerable</span>
              </div>
              <div className="trait-card">
                <span className="trait-label">Storage</span>
                <span className="trait-value">IPFS Decentralized</span>
              </div>
              <div className="trait-card">
                <span className="trait-label">Security</span>
                <span className="trait-value">OpenZeppelin Hardened</span>
              </div>
              <div className="trait-card">
                <span className="trait-label">Royalty</span>
                <span className="trait-value">0% Fees</span>
              </div>
            </div>
          </div>

          {/* Right Column: Minting & Action Portal */}
          <div className="portal-card">
            <div className="portal-header">
              <h2>PopCoin NFT Portal</h2>
              <p className="portal-subtitle">Mint your exclusive PopCoin NFT directly on Arbitrum.</p>
            </div>

            {/* Network Banner Warning if Unsupported */}
            {isConnected && !isSupportedChain && (
              <div className="alert alert-warning">
                <p>⚠️ Connected to an unsupported network. Please switch to Arbitrum to mint.</p>
                <div className="switcher-btns">
                  <button className="btn btn-secondary btn-sm" onClick={() => switchNetwork('0xa4b1')}>
                    Arbitrum Mainnet
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => switchNetwork('0x66eee')}>
                    Arbitrum Sepolia
                  </button>
                </div>
              </div>
            )}

            {/* Progress Section */}
            <div className="progress-card">
              <div className="progress-header">
                <span className="progress-title">Collection Progress</span>
                <span className="progress-count">{tokenInfo.minted} / {tokenInfo.total} Minted</span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, (tokenInfo.minted / tokenInfo.total) * 100)}%` }}
                ></div>
              </div>
              <div className="progress-footer">
                <span>Total Supply: {tokenInfo.total}</span>
                <span>{((tokenInfo.minted / tokenInfo.total) * 100).toFixed(1)}% Completed</span>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="quantity-card">
              <span className="quantity-label">Quantity to Mint</span>
              <div className="quantity-controls">
                <button
                  className="qty-btn"
                  onClick={() => setMintQuantity(Math.max(1, mintQuantity - 1))}
                  disabled={mintQuantity <= 1}
                >
                  -
                </button>
                <span className="qty-val">{mintQuantity}</span>
                <button
                  className="qty-btn"
                  onClick={() => setMintQuantity(Math.min(10, mintQuantity + 1))}
                  disabled={mintQuantity >= 10}
                >
                  +
                </button>
              </div>
              <div className="total-price">
                <span>Total Cost:</span>
                <strong>{(0.01 * mintQuantity).toFixed(2)} ETH</strong>
              </div>
            </div>

            {/* Action Buttons & Wallet Connection */}
            <div className="action-container">
              {!isConnected ? (
                <div className="connect-prompt">
                  <button className="btn btn-primary btn-glow btn-block btn-lg" onClick={connectWallet}>
                    Connect Web3 Wallet to Mint
                  </button>
                  <a
                    href={`https://arbiscan.io/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-block"
                  >
                    View Verified Contract on Arbiscan ↗
                  </a>
                </div>
              ) : (
                <div className="mint-prompt">
                  <button
                    className="btn btn-primary btn-glow btn-block btn-lg"
                    onClick={mintToken}
                    disabled={isMinting || !isSupportedChain}
                  >
                    {isMinting ? 'Minting in Progress...' : `Mint ${mintQuantity} PopCoin NFT (${(0.01 * mintQuantity).toFixed(2)} ETH)`}
                  </button>

                  <div className="gas-info-row">
                    <span>Estimated Gas: <strong>~{gasEstimate} ETH</strong></span>
                    <span>Your Balance: <strong>{balance} {tokenInfo.symbol}</strong></span>
                  </div>
                </div>
              )}

              {/* Status Tracking Alert */}
              {isMinting && (
                <div className="status-tracker">
                  <div className="pulse-spinner"></div>
                  <span>{mintStatus}</span>
                </div>
              )}

              {mintStatus === 'SUCCESS' && (
                <div className="alert alert-success">
                  <p>🎉 NFT Minted Successfully!</p>
                  <div className="explorer-links">
                    <a href={`${activeConfig.explorer}/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer">
                      View Transaction on Explorer ↗
                    </a>
                    <a href={`https://opensea.io/assets/arbitrum/${contractAddress}`} target="_blank" rel="noopener noreferrer">
                      View on OpenSea ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Contract Footer Info */}
            <div className="contract-meta-card">
              <div className="meta-row">
                <span className="meta-key">Contract Address</span>
                <a href={`${activeConfig.explorer}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer" className="meta-val">
                  {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)} ↗
                </a>
              </div>
              <div className="meta-row">
                <span className="meta-key">Network</span>
                <span className="meta-val">{activeConfig.name}</span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 PopCoin NFT Protocol — Built by <a href="https://github.com/ismael6499" target="_blank" rel="noopener noreferrer">Agustin Acosta</a></p>
        <div className="footer-links">
          <a href="https://github.com/ismael6499/popcoin-nft-minting-dapp" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
          <a href="https://arbiscan.io/address/0xd068673a424a8d90e9c34ccce03c1854547ddb7f" target="_blank" rel="noopener noreferrer">Arbiscan Explorer</a>
          <a href="https://opensea.io" target="_blank" rel="noopener noreferrer">OpenSea</a>
        </div>
      </footer>
    </div>
  )
}

export default App
