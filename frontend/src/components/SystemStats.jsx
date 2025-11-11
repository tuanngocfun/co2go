import { useState, useEffect } from 'react'

export default function SystemStats({ apiBase, refreshKey }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${apiBase}/system/stats`)
        const data = await res.json()
        if (data.success) {
          setStats(data.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [apiBase, refreshKey])

  if (loading) return <div className="container loading">Loading system stats...</div>

  return (
    <div className="container">
      <h2>📈 System Statistics</h2>
      
      {stats && (
        <div className="grid grid-3">
          <div className="stat-card">
            <div className="stat-value">{stats.blockchain.totalTrips}</div>
            <div className="stat-label">Total Trips (Blockchain)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.blockchain.totalPointsIssued}</div>
            <div className="stat-label">Points Issued</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.blockchain.totalRedemptions}</div>
            <div className="stat-label">Rewards Redeemed</div>
          </div>
        </div>
      )}

      <div className="info-box" style={{ marginTop: '20px' }}>
        <strong>💡 Note:</strong> This dashboard demonstrates how individual blockchain transactions 
        aggregate into system-wide analytics via the database. The backend acts as a bridge between 
        the smart contract (source of truth) and the database (for fast queries and analytics).
      </div>
    </div>
  )
}
