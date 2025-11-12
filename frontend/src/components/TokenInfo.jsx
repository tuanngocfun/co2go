import { useState, useEffect } from 'react'
import { 
  getNetworkInfo, 
  getTokenAddress, 
  isNetworkSupported, 
  areContractsDeployed,
  SUPPORTED_NETWORKS 
} from '../config/networks'

export default function TokenInfo({ apiBase, walletAddress }) {
  const [tokenInfo, setTokenInfo] = useState(null)
  const [tokenBalance, setTokenBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addingToWallet, setAddingToWallet] = useState(false)
  const [currentNetwork, setCurrentNetwork] = useState(null)
  const [currentChainId, setCurrentChainId] = useState(null)

  // Effect 1: Detect network and fetch token info
  useEffect(() => {
    const fetchTokenInfoForNetwork = async (chainId, tokenAddress) => {
      setLoading(true)
      try {
        const res = await fetch(`${apiBase}/token/info`)
        const data = await res.json()
        if (data.success) {
          setTokenInfo({
            ...data.data,
            network: getNetworkInfo(chainId),
          })
        }
      } catch (err) {
        console.error('Error fetching token info:', err)
        // Fallback: use network config
        setTokenInfo({
          address: tokenAddress,
          symbol: 'C2GP',
          name: 'CO2Go Points',
          decimals: '18',
          network: getNetworkInfo(chainId),
        })
      } finally {
        setLoading(false)
      }
    }

    const updateNetwork = async () => {
      if (!window.ethereum) return
      
      try {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
        const chainId = parseInt(chainIdHex, 16)
        
        setCurrentNetwork(chainIdHex)
        setCurrentChainId(chainId)
        
        console.log('Current network:', {
          chainIdHex,
          chainId,
          networkInfo: getNetworkInfo(chainId),
          supported: isNetworkSupported(chainId),
          contractsDeployed: areContractsDeployed(chainId),
        })
        
        // Fetch token info for current network
        const tokenAddress = getTokenAddress(chainId)
        if (tokenAddress) {
          fetchTokenInfoForNetwork(chainId, tokenAddress)
        } else {
          setTokenInfo(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('Error getting chain ID:', err)
        setLoading(false)
      }
    }

    updateNetwork()
    
    // Listen for network changes
    if (window.ethereum) {
      const handleChainChanged = () => {
        updateNetwork()
        // Reload to ensure clean state
        window.location.reload()
      }
      
      window.ethereum.on('chainChanged', handleChainChanged)
      
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [apiBase])

  // Effect 2: Fetch token balance
  useEffect(() => {
    if (!walletAddress || !currentChainId) return
    
    // Only fetch balance if contracts are deployed on this network
    if (!areContractsDeployed(currentChainId)) {
      setTokenBalance(null)
      return
    }

    const fetchTokenBalance = async () => {
      try {
        const res = await fetch(`${apiBase}/token/balance/${walletAddress}`)
        const data = await res.json()
        if (data.success) {
          setTokenBalance(data.data)
        }
      } catch (err) {
        console.error('Error fetching token balance:', err)
        setTokenBalance(null)
      }
    }

    fetchTokenBalance()
    const interval = setInterval(fetchTokenBalance, 5000)
    return () => clearInterval(interval)
  }, [apiBase, walletAddress, currentChainId])

  const addTokenToMetaMask = async () => {
    // Check if MetaMask is installed
    if (!window.ethereum) {
      alert('❌ MetaMask is not installed!\n\nPlease install MetaMask extension from:\nhttps://metamask.io')
      return
    }

    // Check if we have current chain ID
    if (!currentChainId) {
      alert('❌ Unable to detect current network. Please refresh the page.')
      return
    }

    // Check if network is supported
    if (!isNetworkSupported(currentChainId)) {
      const networkList = Object.values(SUPPORTED_NETWORKS)
        .map(n => `${n.name} (Chain ID: ${n.chainId})`)
        .join('\n')
      
      alert(
        `❌ Unsupported Network!\n\n` +
        `Current network: Chain ID ${currentChainId}\n\n` +
        `Supported networks:\n${networkList}\n\n` +
        `Please switch to a supported network.`
      )
      return
    }

    // Check if contracts are deployed on this network
    if (!areContractsDeployed(currentChainId)) {
      const networkInfo = getNetworkInfo(currentChainId)
      alert(
        `❌ Contracts Not Deployed!\n\n` +
        `Network: ${networkInfo.name}\n\n` +
        `The CO2Go contracts have not been deployed to this network yet.\n\n` +
        `To deploy:\n` +
        `pnpm run deploy:${currentChainId === 31337 ? 'local' : 'amoy'}\n\n` +
        `Then update frontend/src/config/networks.js with the new addresses.`
      )
      return
    }

    // Check if token info is loaded
    if (!tokenInfo || !tokenInfo.address) {
      alert('❌ Token information not loaded yet. Please wait a moment and try again.')
      return
    }

    setAddingToWallet(true)
    try {
      const networkInfo = getNetworkInfo(currentChainId)
      
      console.log('Adding token to MetaMask:', {
        network: networkInfo.name,
        chainId: currentChainId,
        address: tokenInfo.address,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
      })

      // Convert decimals to number
      const decimals = typeof tokenInfo.decimals === 'string' 
        ? parseInt(tokenInfo.decimals) 
        : tokenInfo.decimals

      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenInfo.address,
            symbol: tokenInfo.symbol,
            decimals: decimals,
          },
        },
      })

      if (wasAdded) {
        alert(
          `✅ Success!\n\n` +
          `${tokenInfo.symbol} token has been added to MetaMask!\n\n` +
          `Network: ${networkInfo.name}\n` +
          `Address: ${tokenInfo.address}\n\n` +
          `You should now see it in your assets list.`
        )
      } else {
        alert('ℹ️ Token addition was cancelled.')
      }
    } catch (error) {
      console.error('Error adding token:', error)
      let errorMessage = '❌ Failed to add token!\n\n'
      
      if (error.code === 4001) {
        errorMessage += 'You rejected the request in MetaMask.'
      } else if (error.message && error.message.includes('ERC1155')) {
        errorMessage += 'CONTRACT TYPE MISMATCH!\n\n'
        errorMessage += `The address ${tokenInfo.address} contains a different type of contract on this network.\n\n`
        errorMessage += 'This usually means you\'re on the wrong network or the contract isn\'t deployed here.'
      } else if (error.message) {
        errorMessage += 'Error: ' + error.message
      } else {
        errorMessage += 'An unknown error occurred.'
      }
      
      alert(errorMessage)
    } finally {
      setAddingToWallet(false)
    }
  }

  const addNetworkToMetaMask = async (chainId) => {
    const networkInfo = getNetworkInfo(chainId)
    if (!networkInfo) {
      alert('Network not found')
      return
    }

    const params = {
      chainId: `0x${chainId.toString(16)}`,
      chainName: networkInfo.name,
      nativeCurrency: networkInfo.nativeCurrency,
      rpcUrls: [networkInfo.rpcUrl],
      blockExplorerUrls: networkInfo.blockExplorer ? [networkInfo.blockExplorer] : []
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [params]
      })
      alert(`✅ ${params.chainName} network added to MetaMask!`)
    } catch (error) {
      console.error('Error adding network:', error)
      if (error.code === 4001) {
        alert('You rejected the request.')
      } else if (error.code === -32602) {
        alert('Invalid network parameters. Please add the network manually.')
      } else {
        alert('Failed to add network: ' + error.message)
      }
    }
  }

  if (loading) {
    return (
      <div className="container">
        <h2>🪙 Token Info</h2>
        <p>Loading token information...</p>
      </div>
    )
  }

  const networkInfo = getNetworkInfo(currentChainId)
  const isDeployed = areContractsDeployed(currentChainId)
  
  return (
    <div className="container">
      <h2>🪙 CO2Go Reward Token</h2>
      
      {!isNetworkSupported(currentChainId) && (
        <div className="info-box" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>⚠️ Unsupported Network</h3>
          <p>Current network: <strong>Chain ID {currentChainId}</strong></p>
          <p>Please switch to one of these supported networks:</p>
          
          <div style={{ marginTop: '15px' }}>
            {Object.values(SUPPORTED_NETWORKS).map(network => (
              <button
                key={network.chainId}
                className="btn-outline"
                onClick={() => addNetworkToMetaMask(network.chainId)}
                style={{ marginRight: '10px', marginBottom: '10px' }}
              >
                Switch to {network.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {networkInfo && isDeployed && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#d4edda',
          border: '2px solid #28a745',
          borderRadius: '8px', 
          fontSize: '0.95rem'
        }}>
          <strong>✅ Ready to Use!</strong>
          <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
            Contracts are deployed on <strong>{networkInfo.name}</strong>. 
            You can add the token to MetaMask and start earning rewards!
          </div>
        </div>
      )}

      {tokenInfo && (
        <div className="grid grid-2" style={{ marginBottom: '20px' }}>
          <div>
            <p><strong>Name:</strong> {tokenInfo.name}</p>
            <p><strong>Symbol:</strong> {tokenInfo.symbol}</p>
            <p><strong>Address:</strong> <code style={{ fontSize: '0.8rem' }}>{tokenInfo.address}</code></p>
            <p><strong>Network:</strong> {networkInfo?.name || 'Unknown'}</p>
            
            {tokenBalance && (
              <div className="stat-card" style={{ marginTop: '10px' }}>
                <div className="stat-value">{parseFloat(tokenBalance.formatted).toFixed(2)}</div>
                <div className="stat-label">{tokenBalance.symbol}</div>
              </div>
            )}
          </div>
          
          <div>
            <button 
              onClick={addTokenToMetaMask}
              disabled={addingToWallet || !isDeployed}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              {addingToWallet ? '⏳ Adding...' : '🦊 Add to MetaMask'}
            </button>
            
            {tokenInfo.address && networkInfo?.blockExplorer && (
              <a 
                href={`${networkInfo.blockExplorer}/address/${tokenInfo.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
                style={{ width: '100%', marginTop: '10px', display: 'block', textAlign: 'center' }}
              >
                View on Explorer
              </a>
            )}
          </div>
        </div>
      )}

      <div className="info-box" style={{ marginTop: '20px', fontSize: '0.875rem' }}>
        <h4>How to see your tokens:</h4>
        <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
          <li>Click "Add to MetaMask" button above</li>
          <li>Approve in MetaMask popup</li>
          <li>
            <strong>Important:</strong> Switch to the correct network:
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li><strong>Local testing:</strong> Localhost 8545 (add manually if needed)</li>
              <li><strong>Polygon Amoy:</strong> Select from MetaMask network list</li>
            </ul>
          </li>
          <li>Your token balance will appear in MetaMask!</li>
        </ol>
        
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
          <strong>⚠️ Note:</strong> For localhost testing, you need to add the Hardhat network to MetaMask:
          <ul style={{ marginLeft: '20px', marginTop: '5px', fontSize: '0.8rem' }}>
            <li>Network Name: Hardhat Local</li>
            <li>RPC URL: http://localhost:8545</li>
            <li>Chain ID: 31337</li>
            <li>Currency: ETH</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
