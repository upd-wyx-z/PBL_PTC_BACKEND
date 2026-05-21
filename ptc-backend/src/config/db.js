// ============================================================
//  src/config/db.js
//  PostgreSQL connection pool using the 'pg' library
//  Connects to PTC_DB database
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // THIS IS THE MAGIC FIX FOR CLOUD DATABASES:
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message || err);
  } else {
    console.log('✅ Database connected successfully!');
  }
});

module.exports = pool;
