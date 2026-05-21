// ============================================================
//  src/config/db.js
//  PostgreSQL connection pool using the 'pg' library
//  Connects to PTC_DB database
// ============================================================

const { Pool } = require('pg');

console.log("🛠️ DIAGNOSTIC: Checking Environment Variables...");
console.log("DB URL exists?", !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ RAW DATABASE ERROR:', err); // Forces it to print the full error
  } else {
    console.log('✅ Database connected successfully!');
    release(); // Safely close the test connection
  }
});

module.exports = pool;
