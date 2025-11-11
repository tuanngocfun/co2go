import { useState } from 'react'

const TRANSPORT_MODES = [
  { value: 'walk', label: 'Walking 🚶' },
  { value: 'bike', label: 'Bicycle 🚲' },
  { value: 'ebike', label: 'E-Bike ⚡🚲' },
  { value: 'scooter', label: 'E-Scooter 🛴' },
  { value: 'bus', label: 'Bus 🚌' },
  { value: 'train', label: 'Train 🚆' },
  { value: 'motorcycle', label: 'Motorcycle 🏍️' },
  { value: 'car', label: 'Car 🚗' },
]

export default function TripSimulator({ walletAddress, onTripSubmitted, apiBase }) {
  const [mode, setMode] = useState('bike')
  const [distance, setDistance] = useState('5000')
  const [duration, setDuration] = useState('1200')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handlePreview = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/points/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          distance: parseInt(distance),
          duration: parseInt(duration),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPreview(data.data)
        setResult(null)
      } else {
        setError(data.error || 'Failed to calculate points')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/trips/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          mode,
          distance: parseInt(distance),
          duration: parseInt(duration),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data)
        setPreview(null)
        onTripSubmitted()
      } else {
        setError(data.error || 'Failed to submit trip')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h2>🚴 Trip Simulator</h2>
      
      <div className="form-group">
        <label>Transport Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {TRANSPORT_MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Distance (meters)</label>
        <input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          min="1"
        />
      </div>

      <div className="form-group">
        <label>Duration (seconds)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min="1"
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="button-group">
        <button
          className="btn-outline"
          onClick={handlePreview}
          disabled={loading}
        >
          {loading ? '⏳ Calculating...' : '🔍 Preview Points'}
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '⏳ Recording...' : '✅ Record on Blockchain'}
        </button>
      </div>

      {preview && (
        <div className="success" style={{ marginTop: '16px' }}>
          <h3>Preview (Off-chain)</h3>
          <p><strong>Points:</strong> {preview.pointsEarned}</p>
          <p><strong>CO₂ Saved:</strong> {preview.breakdown.co2SavedKg} kg</p>
          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
            {preview.breakdown.formula}
          </p>
        </div>
      )}

      {result && (
        <div className="success" style={{ marginTop: '16px' }}>
          <h3>✅ Trip Recorded on Blockchain!</h3>
          <p><strong>Points Earned:</strong> {result.pointsEarned}</p>
          <p><strong>Total Points:</strong> {result.totalPoints}</p>
          <p><strong>CO₂ Saved:</strong> {(result.emissionsSaved / 1000).toFixed(2)} kg</p>
          <p><strong>TX Hash:</strong> <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{result.txHash}</code></p>
          <p><strong>Block:</strong> {result.blockNumber}</p>
        </div>
      )}
    </div>
  )
}
