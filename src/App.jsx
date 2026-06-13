import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'

// Deployed PopCoin Contract Address on Arbitrum One Mainnet
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
    address: DEFAULT_SEPOLIA_ADDRESS || '0x0000000000000000000000000000000000000000',
    isTestnet: true
  }
}

const CONTRACT_ABI = [
  "function mint() external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function currentTokenId() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)"
]

function App() {
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [contractAddress, setContractAddress] = useState(DEFAULT_MAINNET_ADDRESS)
  const [tokenInfo, setTokenInfo] = useState({ name: 'PopCoin NFT Collection', symbol: 'POP', minted: 0, total: 100 })
  const [balance, setBalance] = useState(0)

  // Loading & Transaction States
  const [isLoading, setIsLoading] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [mintStatus, setMintStatus] = useState('')
  const [gasEstimate, setGasEstimate] = useState('')
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
    // Update active contract address based on selected chain
    if (CHAIN_CONFIGS[newChainId]) {
      setContractAddress(CHAIN_CONFIGS[newChainId].address)
    } else {
      setContractAddress(DEFAULT_MAINNET_ADDRESS)
    }
  }

  // Fetch token name, symbol, total supply, current minted count, and user balance
  const fetchContractData = async () => {
    setIsLoading(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider)

      // Parallel reads to optimize page load times
      const [name, symbol, minted, total, userBalance] = await Promise.all([
        contract.name().catch(() => 'PopCoin NFT Collection'),
        contract.symbol().catch(() => 'POP'),
        contract.currentTokenId().catch(() => 0n),
        contract.totalSupply().catch(() => 10000n),
        contract.balanceOf(account).catch(() => 0n)
      ])

      setTokenInfo({
        name,
        symbol,
        minted: Number(minted),
        total: Number(total)
      })
      setBalance(Number(userBalance))

      // Perform initial gas estimation for UI feedback
      estimateGasLimit(contract)
    } catch (error) {
      console.error('Failed to load contract data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Estimate gas limit before sending transaction
  const estimateGasLimit = async (contractInstance) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractWithSigner = contractInstance.connect(signer)

      const gasEst = await contractWithSigner.mint.estimateGas()
      const feeData = await provider.getFeeData()

      // Calculate estimated gas cost in ETH
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('0.1', 'gwei')
      const totalCostWei = gasEst * gasPrice
      const totalCostEth = ethers.formatEther(totalCostWei)

      setGasEstimate(Number(totalCostEth).toFixed(6))
    } catch (error) {
      console.warn('Gas estimation failed:', error)
      setGasEstimate('Unknown')
    }
  }

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install the browser extension.')
      return
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      handleAccountsChanged(accounts)
      const chain = await window.ethereum.request({ method: 'eth_chainId' })
      handleChainChanged(chain)
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  // Switch chain to Arbitrum One or Arbitrum Sepolia
  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      })
    } catch (switchError) {
      // Add the network to MetaMask if it hasn't been added yet
      if (switchError.code === 4902) {
        const config = CHAIN_CONFIGS[targetChainId]
        if (!config) return
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: targetChainId,
              chainName: config.name,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [config.rpc],
              blockExplorerUrls: [config.explorer]
            }]
          })
        } catch (addError) {
          console.error('Failed to add chain:', addError)
        }
      }
    }
  }

  // Execute safe NFT Mint
  const mintToken = async () => {
    if (!isConnected || !account) return

    // Check if network is supported
    if (!CHAIN_CONFIGS[chainId]) {
      alert('Please switch to a supported Arbitrum network.')
      return
    }

    setIsMinting(true)
    setLastTxHash('')

    try {
      setMintStatus('1. Estimating transaction parameters...')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer)

      setMintStatus('2. Please approve signature in MetaMask...')
      const tx = await contract.mint()

      setMintStatus('3. Broadcasting transaction to network...')
      setLastTxHash(tx.hash)

      setMintStatus('4. Waiting for block confirmation...')
      await tx.wait()

      setMintStatus('SUCCESS')
      // Update balance and token supply after successful mint
      fetchContractData()
    } catch (error) {
      console.error('Minting transaction failed:', error)
      setMintStatus('FAILED')
      if (error.code === 'ACTION_REJECTED') {
        alert('Transaction signature was rejected by user.')
      } else {
        alert('Transaction failed. Make sure you have sufficient ETH for gas.')
      }
    } finally {
      setIsMinting(false)
    }
  }

  const activeConfig = CHAIN_CONFIGS[chainId]
  const isSupportedChain = !!activeConfig

  return (
    <div className="card">
      <div className="header">
        <h1>PopCoin Portal</h1>
        <p className="subtitle">ERC-721 NFT Minting Interface — Arbitrum</p>
      </div>

      <div className="divider"></div>

      {!isConnected ? (
        <div className="connect-section">
          <p className="description">Connect your Web3 browser wallet to mint and view your PopCoin NFTs.</p>
          <button id="btn-connect-wallet" className="btn btn-primary btn-glow" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="dapp-section">
          {/* Wallet & Connection Status */}
          <div className="status-grid">
            <div className="status-card">
              <span className="status-label">Wallet Address</span>
              <span className="status-val">{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
            <div className="status-card">
              <span className="status-label">Network</span>
              <span className={`status-val ${isSupportedChain ? 'connected' : 'unsupported'}`}>
                <span className="dot"></span>
                {isSupportedChain ? activeConfig.name : 'Unsupported'}
              </span>
            </div>
          </div>

          {/* Network Switcher Warning */}
          {!isSupportedChain ? (
            <div className="alert alert-warning">
              <p>You are connected to an unsupported network. Please switch to Arbitrum to interact.</p>
              <div className="switcher-btns">
                <button id="btn-switch-mainnet" className="btn btn-secondary" onClick={() => switchNetwork('0xa4b1')}>
                  Arbitrum Mainnet
                </button>
                <button id="btn-switch-sepolia" className="btn btn-secondary" onClick={() => switchNetwork('0x66eee')}>
                  Arbitrum Sepolia
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Token Info & Progress */}
              <div className="info-card">
                <h2>{tokenInfo.name} ({tokenInfo.symbol})</h2>
                <div className="progress-container">
                  <div className="progress-labels">
                    <span>Minted: {tokenInfo.minted} / {tokenInfo.total}</span>
                    <span>{((tokenInfo.minted / tokenInfo.total) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(tokenInfo.minted / tokenInfo.total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="balance-row">
                  <span>Your balance: <strong>{balance} {tokenInfo.symbol}</strong></span>
                  {activeConfig.isTestnet && (
                    <a
                      href="https://faucet.quicknode.com/drip-pools/arbitrum-sepolia"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="faucet-link"
                    >
                      Get test ETH (Faucet)
                    </a>
                  )}
                </div>
              </div>

              {/* Mint Action Card */}
              <div className="action-card">
                {contractAddress === '0x0000000000000000000000000000000000000000' ? (
                  <div className="alert alert-info">
                    <p>Contract is not yet deployed on {activeConfig.name}. Use the deployment script to deploy it first.</p>
                  </div>
                ) : (
                  <>
                    {tokenInfo.minted >= tokenInfo.total ? (
                      <div className="alert alert-soldout">
                        <p className="soldout-title">🎉 Sold Out</p>
                        <p>All {tokenInfo.total} PopCoin NFTs have been minted.</p>
                        <a
                          href={`https://opensea.io/assets/arbitrum-sepolia/${contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-block"
                          style={{ marginTop: '10px', textDecoration: 'none', display: 'flex' }}
                        >
                          View Collection on OpenSea
                        </a>
                      </div>
                    ) : (
                      <>
                        <button
                          id="btn-mint-nft"
                          className="btn btn-primary btn-glow btn-block"
                          onClick={mintToken}
                          disabled={isMinting}
                        >
                          {isMinting ? 'Minting...' : 'Mint PopCoin NFT'}
                        </button>

                        <div className="gas-info">
                          <span>Estimated gas cost: <strong>{gasEstimate} ETH</strong></span>
                        </div>

                        {/* Status Tracking */}
                        {isMinting && (
                          <div className="status-tracker">
                            <span className="spinner"></span>
                            <span>{mintStatus}</span>
                          </div>
                        )}

                        {mintStatus === 'SUCCESS' && (
                          <div className="alert alert-success">
                            <p>NFT minted successfully!</p>
                            <div className="explorer-links">
                              <a
                                href={`${activeConfig.explorer}/tx/${lastTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on Explorer
                              </a>
                              <a
                                href={`https://opensea.io/assets/arbitrum/${contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on OpenSea
                              </a>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="footer">
        <p>PopCoin DApp — Deployed on Arbitrum</p>
        <p>Contract: <a href={`https://arbiscan.io/address/${DEFAULT_MAINNET_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="faucet-link">{DEFAULT_MAINNET_ADDRESS.slice(0, 10)}…</a></p>
        <p className="footer-author">Built by <a href="https://github.com/ismael6499" target="_blank" rel="noopener noreferrer" className="faucet-link">Agustin Acosta</a></p>
      </div>
    </div>
  )
}

export default App
