// ============================================================
//  migrate_resources.js
//  Run ONCE to add visibility column to resources table
//  and create uploads directory
//
//  HOW TO RUN:
//    cd ptc-backend
//    node migrate_resources.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  console.log('🔧 Running resources migration...\n');
  try {

    // 1. Add visibility column if not exists
    await pool.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'all'
    `);
    console.log('✅ visibility column added to resources');

    // 2. Add visible_to column (stores array of user_ids for specific visibility)
    await pool.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS visible_to TEXT[] DEFAULT '{}'
    `);
    console.log('✅ visible_to column added to resources');

    // 3. Add remarks_faculty column if not exists
    await pool.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS remarks_faculty TEXT
    `);
    console.log('✅ remarks_faculty column added to resources');

    // 4. Create uploads directory
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'resources');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('✅ Upload directory created: public/uploads/resources');
    } else {
      console.log('✅ Upload directory already exists');
    }

    console.log('\n🎉 Migration complete! You can now use the Department Repository.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

migrate();