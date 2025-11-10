-- ============================================
-- Reward System Database Schema
-- PostgreSQL 12+
-- ============================================

-- Drop existing tables if needed (for fresh install)
-- DROP TABLE IF EXISTS redemptions CASCADE;
-- DROP TABLE IF EXISTS trips CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    username VARCHAR(100),
    email VARCHAR(255),
    total_points BIGINT DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'Bronze',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_tier ON users(tier);

-- ============================================
-- Trips Table (Off-chain cache of blockchain data)
-- ============================================
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    distance INTEGER NOT NULL, -- meters
    duration INTEGER NOT NULL, -- seconds
    points_earned BIGINT NOT NULL,
    emissions_saved INTEGER NOT NULL, -- grams CO2
    trip_hash VARCHAR(66) NOT NULL, -- blockchain hash
    tx_hash VARCHAR(66), -- transaction hash
    block_number BIGINT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(wallet_address, trip_id)
);

CREATE INDEX idx_trips_user ON trips(user_id);
CREATE INDEX idx_trips_wallet ON trips(wallet_address);
CREATE INDEX idx_trips_hash ON trips(trip_hash);
CREATE INDEX idx_trips_tx ON trips(tx_hash);
CREATE INDEX idx_trips_created ON trips(created_at DESC);
CREATE INDEX idx_trips_mode ON trips(mode);

-- ============================================
-- Redemptions Table
-- ============================================
CREATE TABLE IF NOT EXISTS redemptions (
    id SERIAL PRIMARY KEY,
    redemption_id BIGINT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    reward_id VARCHAR(100) NOT NULL,
    reward_name VARCHAR(255),
    points_cost BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    status VARCHAR(20) DEFAULT 'completed', -- completed, pending, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_redemptions_user ON redemptions(user_id);
CREATE INDEX idx_redemptions_wallet ON redemptions(wallet_address);
CREATE INDEX idx_redemptions_tx ON redemptions(tx_hash);
CREATE INDEX idx_redemptions_created ON redemptions(created_at DESC);

-- ============================================
-- Rewards Catalog Table (synced from blockchain)
-- ============================================
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    reward_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_cost BIGINT NOT NULL,
    active BOOLEAN DEFAULT true,
    stock INTEGER DEFAULT -1, -- -1 means unlimited
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rewards_active ON rewards(active);
CREATE INDEX idx_rewards_cost ON rewards(points_cost);

-- ============================================
-- System Stats Table (for analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    total_trips BIGINT DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    total_points_issued BIGINT DEFAULT 0,
    total_redemptions BIGINT DEFAULT 0,
    total_emissions_saved BIGINT DEFAULT 0, -- grams CO2
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize system stats
INSERT INTO system_stats (id, total_trips, total_users, total_points_issued, total_redemptions, total_emissions_saved)
VALUES (1, 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- Views for Common Queries
-- ============================================

-- User summary view
CREATE OR REPLACE VIEW v_user_summary AS
SELECT 
    u.id,
    u.wallet_address,
    u.username,
    u.total_points,
    u.tier,
    COUNT(DISTINCT t.id) as trip_count,
    COUNT(DISTINCT r.id) as redemption_count,
    COALESCE(SUM(t.emissions_saved), 0) as total_emissions_saved,
    u.created_at as joined_at
FROM users u
LEFT JOIN trips t ON u.id = t.user_id
LEFT JOIN redemptions r ON u.id = r.user_id
GROUP BY u.id;

-- Recent trips view
CREATE OR REPLACE VIEW v_recent_trips AS
SELECT 
    t.id,
    t.trip_id,
    u.wallet_address,
    u.username,
    t.mode,
    t.distance,
    t.duration,
    t.points_earned,
    t.emissions_saved,
    t.tx_hash,
    t.verified,
    t.created_at
FROM trips t
JOIN users u ON t.user_id = u.id
ORDER BY t.created_at DESC;

-- ============================================
-- Functions
-- ============================================

-- Function to update user tier based on points
CREATE OR REPLACE FUNCTION update_user_tier()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_points >= 5000 THEN
        NEW.tier = 'Diamond';
    ELSIF NEW.total_points >= 2000 THEN
        NEW.tier = 'Gold';
    ELSIF NEW.total_points >= 500 THEN
        NEW.tier = 'Silver';
    ELSE
        NEW.tier = 'Bronze';
    END IF;
    
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update tier
CREATE TRIGGER trigger_update_tier
BEFORE UPDATE OF total_points ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_tier();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_rewards_updated_at
BEFORE UPDATE ON rewards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Seed Data - Default Rewards
-- ============================================
INSERT INTO rewards (reward_id, name, description, points_cost, active, stock)
VALUES 
    ('COFFEE_VOUCHER', 'Free Coffee', 'Get a free coffee at participating cafes', 100, true, -1),
    ('BUS_TICKET', 'Free Bus Ticket', 'One-day unlimited bus pass', 250, true, -1),
    ('TREE_PLANT', 'Plant a Tree', 'We plant a tree in your name', 500, true, -1),
    ('BIKE_RENTAL', '1 Day Bike Rental', 'Free bike rental for 24 hours', 750, true, -1),
    ('METRO_PASS', '1 Week Metro Pass', 'Unlimited metro access for 7 days', 1000, true, -1),
    ('ECO_BAG', 'Eco-Friendly Bag', 'Reusable shopping bag', 150, true, 100),
    ('WATER_BOTTLE', 'Reusable Water Bottle', 'Stainless steel water bottle', 300, true, 50),
    ('LUNCH_VOUCHER', 'Sustainable Restaurant Voucher', '$20 voucher at eco-friendly restaurants', 800, true, -1)
ON CONFLICT (reward_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    points_cost = EXCLUDED.points_cost,
    active = EXCLUDED.active;

-- ============================================
-- Grant Permissions (adjust user as needed)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO reward_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO reward_app;

-- ============================================
-- Useful Queries for Testing
-- ============================================

-- Get top users by points
-- SELECT * FROM v_user_summary ORDER BY total_points DESC LIMIT 10;

-- Get recent trips
-- SELECT * FROM v_recent_trips LIMIT 20;

-- Get user stats
-- SELECT 
--     COUNT(*) as total_users,
--     SUM(total_points) as total_points,
--     AVG(total_points) as avg_points
-- FROM users;

-- Get mode distribution
-- SELECT 
--     mode,
--     COUNT(*) as trip_count,
--     SUM(points_earned) as total_points,
--     SUM(emissions_saved) as total_emissions
-- FROM trips
-- GROUP BY mode
-- ORDER BY trip_count DESC;

COMMENT ON TABLE users IS 'User accounts linked to blockchain wallets';
COMMENT ON TABLE trips IS 'Off-chain cache of trip data from blockchain for fast queries';
COMMENT ON TABLE redemptions IS 'Reward redemption history';
COMMENT ON TABLE rewards IS 'Available rewards catalog';
COMMENT ON TABLE system_stats IS 'System-wide statistics and metrics';
