import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'

// Deployed PopCoin Contract Address on Arbitrum One Mainnet & Sepolia
const DEFAULT_MAINNET_ADDRESS = '0xd068673a424a8d90e9c34ccce03c1854547ddb7f'
const DEFAULT_SEPOLIA_ADDRESS = '0xD068673a424a8d90E9C34CCCE03C1854547DdB7f'

const CHAIN_CONFIGS = {
  '0x66eee': {
    name: 'Arbitrum Sepolia',
    shortName: 'Sepolia (Dev Testnet)',
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    address: DEFAULT_SEPOLIA_ADDRESS,
    isTestnet: true,
    colorClass: 'net-dev'
  },
  '0xa4b1': {
    name: 'Arbitrum Mainnet',
    shortName: 'Mainnet (Prod)',
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    address: DEFAULT_MAINNET_ADDRESS,
    isTestnet: false,
    colorClass: 'net-prod'
  }
}

const CONTRACT_ABI = [
  "function mint() external payable",
  "function balanceOf(address owner) external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function currentTokenId() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)"
]

function App() {
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState('0x66eee') // Default to Arbitrum Sepolia Dev Testnet
  const [isConnected, setIsConnected] = useState(false)
  const [contractAddress, setContractAddress] = useState(DEFAULT_SEPOLIA_ADDRESS)
  const [tokenInfo, setTokenInfo] = useState({ name: 'PopCoin NFT Collection', symbol: 'POP', minted: 1, total: 100, price: '0.01' })
  const [balance, setBalance] = useState('0')

  // Loading & Transaction States
  const [isLoading, setIsLoading] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [mintStatus, setMintStatus] = useState('')
  const [gasEstimate, setGasEstimate] = useState('0.00012')
  const [lastTxHash, setLastTxHash] = useState('')

  // Fetch real on-chain contract data on initial mount
  useEffect(() => {
    fetchContractDataPublic()

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

  // Sync token metadata when chain or contract address changes
  useEffect(() => {
    fetchContractDataPublic()
  }, [chainId, contractAddress, account])

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
      setContractAddress(DEFAULT_SEPOLIA_ADDRESS)
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
    if (!window.ethereum) {
      handleChainChanged(targetChainId)
      return
    }
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
      } else {
        handleChainChanged(targetChainId)
      }
    }
  }

  // Fetch real on-chain data directly via public RPC (works even without connected wallet)
  const fetchContractDataPublic = async () => {
    try {
      const activeRpc = (CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS['0x66eee']).rpc
      const provider = new ethers.JsonRpcProvider(activeRpc)
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider)

      const [name, symbol, currentTokenIdRaw, maxSupplyRaw] = await Promise.all([
        contract.name().catch(() => 'PopCoin NFT Collection'),
        contract.symbol().catch(() => 'POP'),
        contract.currentTokenId().catch(() => 1n),
        contract.totalSupply().catch(() => 100n)
      ])

      const mintedCount = Number(currentTokenIdRaw)
      const maxSupply = Number(maxSupplyRaw)

      setTokenInfo({
        name,
        symbol,
        minted: mintedCount,
        total: maxSupply,
        price: '0.01'
      })

      // If user account is connected, fetch user balance
      if (account && window.ethereum) {
        const web3Provider = new ethers.BrowserProvider(window.ethereum)
        const userContract = new ethers.Contract(contractAddress, CONTRACT_ABI, web3Provider)
        const userBalance = await userContract.balanceOf(account).catch(() => 0n)
        setBalance(userBalance.toString())
      }
    } catch (err) {
      console.error('Error fetching public contract data:', err)
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

      const mintPriceWei = ethers.parseEther('0.01')
      setMintStatus('Please confirm 0.01 ETH transaction in your wallet...')

      const tx = await contract.mint({ value: mintPriceWei })

      setMintStatus('Transaction submitted to Arbitrum! Awaiting confirmation...')
      setLastTxHash(tx.hash)

      await tx.wait()
      setMintStatus('SUCCESS')
      fetchContractDataPublic()
    } catch (err) {
      console.error('Minting error:', err)
      setMintStatus(err.message ? err.message.slice(0, 110) : 'Transaction rejected or failed.')
    } finally {
      setIsMinting(false)
    }
  }

  const activeConfig = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS['0x66eee']
  const isSupportedChain = !!CHAIN_CONFIGS[chainId]

  return (
    <div className="app-container">
      {/* Background Animated Ambient Mesh */}
      <div className="ambient-mesh mesh-1"></div>
      <div className="ambient-mesh mesh-2"></div>

      {/* Navigation Header */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <span className="coin-icon">⚡</span>
          </div>
          <div className="brand-titles">
            <span className="brand-name">PopCoin</span>
            <span className="brand-badge">Arbitrum Web3 Engine</span>
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
                <span className={`badge-chip ${activeConfig.isTestnet ? 'dev-chip' : 'prod-chip'}`}>
                  {activeConfig.name}
                </span>
              </div>

              <div className="nft-art-container">
                <div className="coin-glow-ring"></div>
                <div className="coin-emblem">
                  <div className="coin-face">
                    <span className="coin-symbol">⚡</span>
                    <span className="coin-title">POPCOIN</span>
                  </div>
                </div>
              </div>

              <div className="nft-preview-info">
                <h3>PopCoin Genesis NFT</h3>
                <p>Limited Edition 100 Utility Tokenized Assets on Arbitrum</p>
                <div className="nft-price-tag">
                  <span>Mint Price (Single Mint)</span>
                  <strong>0.01 ETH</strong>
                </div>
              </div>
            </div>

            {/* Contract Properties Grid */}
            <div className="traits-grid">
              <div className="trait-card">
                <span className="trait-label">Standard</span>
                <span className="trait-value">ERC-721 Standard</span>
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
              <p className="portal-subtitle">Mint your exclusive PopCoin NFT risk-free on Arbitrum Sepolia Dev Testnet.</p>
            </div>

            {/* Network Banner Warning if Unsupported */}
            {isConnected && !isSupportedChain && (
              <div className="alert alert-warning">
                <p>⚠️ Connected to an unsupported network. Please switch to Arbitrum Sepolia Dev Testnet.</p>
                <div className="switcher-btns">
                  <button className="btn btn-secondary btn-sm" onClick={() => switchNetwork('0x66eee')}>
                    Switch to Arbitrum Sepolia (Dev Testnet)
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => switchNetwork('0xa4b1')}>
                    Switch to Arbitrum Mainnet (Prod)
                  </button>
                </div>
              </div>
            )}

            {/* Collection Progress Bar */}
            <div className="progress-card">
              <div className="progress-header">
                <span className="progress-title">Collection Progress ({activeConfig.name})</span>
                <span className="progress-count">{tokenInfo.minted} / {tokenInfo.total} Minted</span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, (tokenInfo.minted / tokenInfo.total) * 100)}%` }}
                ></div>
              </div>
              <div className="progress-footer">
                <span>Max Supply Limit: {tokenInfo.total}</span>
                <span>{((tokenInfo.minted / tokenInfo.total) * 100).toFixed(1)}% Minted</span>
              </div>
            </div>

            {/* Single Mint Information Box */}
            <div className="mint-info-box">
              <div className="info-row">
                <span className="info-key">Mint Quantity:</span>
                <span className="info-val"><strong>1 PopCoin NFT</strong> per Tx</span>
              </div>
              <div className="info-row">
                <span className="info-key">Mint Price:</span>
                <span className="info-val highlight"><strong>0.01 ETH</strong> (Sepolia Test ETH)</span>
              </div>
            </div>

            {/* Action Buttons & Wallet Connection */}
            <div className="action-container">
              {!isConnected ? (
                <div className="connect-prompt">
                  <button className="btn btn-primary btn-glow btn-block btn-lg" onClick={connectWallet}>
                    Connect Web3 Wallet to Mint (Sepolia Dev)
                  </button>
                  <div className="prompt-links-row">
                    <a
                      href="https://faucet.quicknode.com/drip-pools/arbitrum-sepolia"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                    >
                      Get Free Sepolia ETH 🚰
                    </a>
                    <a
                      href={`${activeConfig.explorer}/address/${contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                    >
                      Contract on Explorer ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mint-prompt">
                  <button
                    className="btn btn-primary btn-glow btn-block btn-lg"
                    onClick={mintToken}
                    disabled={isMinting || !isSupportedChain}
                  >
                    {isMinting ? 'Minting in Progress...' : 'Mint 1 PopCoin NFT (0.01 Sepolia ETH)'}
                  </button>

                  <div className="gas-info-row">
                    <span>Est. Gas: <strong>~{gasEstimate} ETH</strong></span>
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
                  <p>🎉 NFT Minted Successfully on Sepolia Testnet!</p>
                  <div className="explorer-links">
                    <a href={`${activeConfig.explorer}/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer">
                      View Transaction on Sepolia Explorer ↗
                    </a>
                    <a href={`https://opensea.io/assets/arbitrum-sepolia/${contractAddress}`} target="_blank" rel="noopener noreferrer">
                      View Collection on OpenSea ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Contract Footer Meta Info */}
            <div className="contract-meta-card">
              <div className="meta-row">
                <span className="meta-key">Contract Address:</span>
                <a href={`${activeConfig.explorer}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer" className="meta-val">
                  {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)} ↗
                </a>
              </div>
              <div className="meta-row">
                <span className="meta-key">Active Environment:</span>
                <div className="meta-switch-box">
                  <span className={`meta-val ${activeConfig.isTestnet ? 'text-dev' : 'text-prod'}`}>
                    {activeConfig.shortName}
                  </span>
                  <button
                    className="btn-switch-bottom"
                    onClick={() => switchNetwork(chainId === '0x66eee' ? '0xa4b1' : '0x66eee')}
                  >
                    Switch to {chainId === '0x66eee' ? 'Mainnet Prod ⚡' : 'Sepolia Dev Testnet 🛠️'}
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Mode Indicator Bar at Bottom */}
      <div className={`env-banner ${activeConfig.isTestnet ? 'banner-dev' : 'banner-prod'}`}>
        <div className="banner-content">
          {activeConfig.isTestnet ? (
            <>
              <span>🛠️ <strong>DEV TESTNET MODE:</strong> You are on Arbitrum Sepolia. Mint risk-free with test ETH!</span>
              <a
                href="https://faucet.quicknode.com/drip-pools/arbitrum-sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="faucet-btn"
              >
                Get Free Sepolia ETH (Faucet) 🚰
              </a>
              <button className="banner-switch-link" onClick={() => switchNetwork('0xa4b1')}>
                Switch Network to Mainnet Prod ⚡
              </button>
            </>
          ) : (
            <>
              <span>🚀 <strong>PROD MAINNET MODE:</strong> Connected to Arbitrum One Mainnet. Live contract deployment.</span>
              <button className="banner-switch-link" onClick={() => switchNetwork('0x66eee')}>
                Switch Network to Sepolia Dev 🛠️
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 PopCoin NFT Protocol — Built by <a href="https://github.com/ismael6499" target="_blank" rel="noopener noreferrer">Agustin Acosta</a></p>
        <div className="footer-links">
          <a href="https://github.com/ismael6499/popcoin-nft-minting-dapp" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
          <a href="https://sepolia.arbiscan.io/address/0xD068673a424a8d90E9C34CCCE03C1854547DdB7f" target="_blank" rel="noopener noreferrer">Sepolia Explorer</a>
          <a href="https://faucet.quicknode.com/drip-pools/arbitrum-sepolia" target="_blank" rel="noopener noreferrer">Testnet Faucet</a>
        </div>
      </footer>
    </div>
  )
}

export default App
