const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/**
 * Database Migration Script
 * Sets up the database schema for the reward system
 */

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "reward_system",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
  });

  try {
    console.log("🔄 Starting database migration...");
    console.log(`📍 Database: ${process.env.DB_NAME || "reward_system"}`);
    console.log(`📍 Host: ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}`);

    // Read SQL file
    const sqlPath = path.join(__dirname, "database.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Execute SQL
    await pool.query(sql);

    console.log("✅ Database migration completed successfully!");
    console.log("\nDatabase schema created:");
    console.log("  ✓ users table");
    console.log("  ✓ trips table");
    console.log("  ✓ redemptions table");
    console.log("  ✓ rewards table");
    console.log("  ✓ system_stats table");
    console.log("  ✓ Views and triggers");
    console.log("  ✓ Seed data (default rewards)");

    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log("\n📊 Tables created:");
    result.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Make sure PostgreSQL is running");
    console.error("2. Check database credentials in .env file");
    console.error("3. Ensure database exists: CREATE DATABASE reward_system;");
    console.error("4. Check user permissions");
    
    await pool.end();
    process.exit(1);
  }
}

// Run migration
migrate();
