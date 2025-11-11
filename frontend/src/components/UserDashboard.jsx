import { useState, useEffect } from 'react'

export default function UserDashboard({ walletAddress, refreshKey, apiBase }) {
  const [summary, setSummary] = useState(null)
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [summaryRes, tripsRes] = await Promise.all([
          fetch(`${apiBase}/users/summary/${walletAddress}`),
          fetch(`${apiBase}/trips/history/${walletAddress}?limit=10`),
        ])
        
        const summaryData = await summaryRes.json()
        const tripsData = await tripsRes.json()
        
        if (summaryData.success) setSummary(summaryData.data)
        if (tripsData.success) setTrips(tripsData.data.trips)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [walletAddress, refreshKey, apiBase])

  if (loading) return <div className="container loading">Loading...</div>

  const getTierBadgeClass = (tier) => {
    return `badge badge-${tier?.toLowerCase() || 'bronze'}`
  }

  return (
    <div className="container">
      <h2>📊 User Dashboard</h2>
      
      {summary && (
        <>
          <div className="grid grid-3" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-value">{summary.points.balance}</div>
              <div className="stat-label">Points Balance</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                <span className={getTierBadgeClass(summary.points.tier)}>
                  {summary.points.tier}
                </span>
              </div>
              <div className="stat-label">Current Tier</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.activity.tripCount}</div>
              <div className="stat-label">Total Trips</div>
            </div>
          </div>

          {summary.points.tierProgress && summary.points.tierProgress.nextTier && (
            <div>
              <h3>Progress to {summary.points.tierProgress.nextTier}</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${summary.points.tierProgress.progress}%` }}
                >
                  {summary.points.tierProgress.progress}%
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#718096' }}>
                {summary.points.tierProgress.pointsToNext} points to next tier
              </p>
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <h3>🌱 Environmental Impact</h3>
            <p><strong>Total CO₂ Saved:</strong> {(summary.environmental.totalEmissionsSaved / 1000).toFixed(2)} kg</p>
            {summary.environmental.impact && (
              <p style={{ fontSize: '0.875rem', color: '#48bb78' }}>
                {summary.environmental.impact.message}
              </p>
            )}
          </div>
        </>
      )}

      <h3 style={{ marginTop: '20px' }}>Recent Trips</h3>
      {trips.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Distance</th>
              <th>Points</th>
              <th>CO₂ Saved</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip, idx) => (
              <tr key={idx}>
                <td>{new Date(trip.created_at).toLocaleDateString()}</td>
                <td>{trip.mode}</td>
                <td>{(trip.distance / 1000).toFixed(2)} km</td>
                <td>{trip.points_earned}</td>
                <td>{(trip.emissions_saved / 1000).toFixed(2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#718096', textAlign: 'center', padding: '20px' }}>
          No trips yet. Start recording trips to earn points!
        </p>
      )}
    </div>
  )
}
