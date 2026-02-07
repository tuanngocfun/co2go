#!/bin/bash

# WalletSelector.jsx
cat > frontend/src/components/WalletSelector.jsx << 'EOF'
import { useState } from 'react'

export default function WalletSelector({ selectedWallet, testWallets, onWalletChange }) {
  const [customWallet, setCustomWallet] = useState('')

  const handleCustomSubmit = (e) => {
    e.preventDefault()
    if (customWallet) {
      onWalletChange(customWallet)
    }
  }

  return (
    <div className="container">
      <h2>👛 Wallet Selector</h2>
      <div className="button-group">
        {testWallets.map((wallet, idx) => (
          <button
            key={wallet}
            className={selectedWallet === wallet ? 'btn-primary' : 'btn-outline'}
            onClick={() => onWalletChange(wallet)}
          >
            Test Wallet #{idx}
          </button>
        ))}
      </div>
      <form onSubmit={handleCustomSubmit} style={{ marginTop: '16px' }}>
        <div className="form-group">
          <label>Or enter custom wallet address:</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={customWallet}
              onChange={(e) => setCustomWallet(e.target.value)}
              placeholder="0x..."
            />
            <button type="submit" className="btn-secondary">Load</button>
          </div>
        </div>
      </form>
      <div style={{ marginTop: '12px', fontSize: '0.875rem', color: '#718096' }}>
        <strong>Selected:</strong> {selectedWallet}
      </div>
    </div>
  )
}
EOF

echo "✅ Created WalletSelector.jsx"
