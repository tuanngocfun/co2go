import { useState } from 'react'
import WalletSelector from './components/WalletSelector'
import TripSimulator from './components/TripSimulator'
import UserDashboard from './components/UserDashboard'
import SystemStats from './components/SystemStats'

const API_BASE = '/api'

const TEST_WALLETS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
]

function App() {
  const [selectedWallet, setSelectedWallet] = useState(TEST_WALLETS[0])
  const [refreshKey, setRefreshKey] = useState(0)

  const handleWalletChange = (wallet) => {
    setSelectedWallet(wallet)
    setRefreshKey(prev => prev + 1)
  }

  const handleTripSubmitted = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <>
      <h1>🌍 CO2Go Reward System</h1>
      <div className="info-box">
        <strong>Blockchain Demo:</strong> This UI demonstrates the complete flow: 
        Trip → Backend API → Smart Contract → Database → Analytics
      </div>

      <WalletSelector
        selectedWallet={selectedWallet}
        testWallets={TEST_WALLETS}
        onWalletChange={handleWalletChange}
      />

      <div className="grid grid-2">
        <TripSimulator
          walletAddress={selectedWallet}
          onTripSubmitted={handleTripSubmitted}
          apiBase={API_BASE}
        />
        <UserDashboard
          walletAddress={selectedWallet}
          refreshKey={refreshKey}
          apiBase={API_BASE}
        />
      </div>

      <SystemStats
        apiBase={API_BASE}
        refreshKey={refreshKey}
      />
    </>
  )
}

export default App
