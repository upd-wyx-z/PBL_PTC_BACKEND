// ============================================================
//  src/config/db.js
//  PostgreSQL connection pool using the 'pg' library
//  Connects to PTC_DB database
// ============================================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test the connection when the server starts
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to PTC_DB (PostgreSQL)');
    release();
  }
});

module.exports = pool;
