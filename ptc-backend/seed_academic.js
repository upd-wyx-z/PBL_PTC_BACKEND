// ============================================================
//  seed_academic.js
//  Seeds school years and subjects into PTC_DB
//  Run ONCE:  node seed_academic.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  console.log('🌱 Seeding school years and subjects...\n');
  try {

    // ── SCHOOL YEARS ─────────────────────────────────────────
    console.log('📅 Inserting school years...');
    await pool.query(`
      INSERT INTO school_years (sy_label, semester, is_current, date_start, date_end)
      VALUES
        ('2025-2026', '2nd', TRUE,  '2025-01-06', '2026-05-31'),
        ('2024-2025', '1st', TRUE, '2024-08-05', '2025-12-20')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ School years inserted!\n');

    // ── DEPARTMENTS (ensure they exist first) ────────────────
    console.log('🏫 Ensuring departments exist...');
    await pool.query(`
      INSERT INTO departments (dept_code, dept_name)
      VALUES
        ('IICT', 'Institute of Information and Communications Technology'),
        ('CBM',  'College of Business Management'),
        ('CTE',  'College of Teacher Education'),
        ('CAS',  'College of Arts and Sciences')
      ON CONFLICT (dept_code) DO NOTHING
    `);
    console.log('✅ Departments ready!\n');

    // Get IICT department_id
    const deptRes = await pool.query(
      `SELECT department_id FROM departments WHERE dept_code = 'IICT'`
    );
    const iict_id = deptRes.rows[0]?.department_id;

    // ── SUBJECTS ─────────────────────────────────────────────
    console.log('📚 Inserting subjects...');
    await pool.query(`
      INSERT INTO subjects (subject_code, subject_name, units, department_id)
      VALUES
        ('CC101',  'Introduction to Computing',              3, $1),
        ('IT201',  'Data Structures and Algorithms',         3, $1),
        ('IT301',  'Database Management Systems',            3, $1),
        ('IT401',  'Network Administration',                 3, $1),
        ('ITE314', 'Integrative Programming and Technology', 3, $1),
        ('ITE401', 'Software Engineering',                   3, $1),
        ('GE001',  'Purposive Communication',                3, $1),
        ('GE002',  'Readings in Philippine History',         3, $1),
        ('GE003',  'Mathematics in the Modern World',        3, $1),
        ('PE001',  'Physical Education 1',                   2, $1)
      ON CONFLICT (subject_code) DO NOTHING
    `, [iict_id]);
    console.log('✅ Subjects inserted!\n');

    // Show what was inserted
    const syResult  = await pool.query(`SELECT sy_id, sy_label, semester, is_current FROM school_years ORDER BY sy_id DESC`);
    const subResult = await pool.query(`SELECT subject_id, subject_code, subject_name FROM subjects ORDER BY subject_code`);

    console.log('📅 School Years in DB:');
    console.log('┌────────┬─────────────┬──────────┬───────────┐');
    console.log('│ sy_id  │ sy_label    │ semester │ is_current│');
    console.log('├────────┼─────────────┼──────────┼───────────┤');
    syResult.rows.forEach(r => {
      console.log(`│ ${String(r.sy_id).padEnd(6)} │ ${r.sy_label.padEnd(11)} │ ${r.semester.padEnd(8)} │ ${String(r.is_current).padEnd(9)} │`);
    });
    console.log('└────────┴─────────────┴──────────┴───────────┘\n');

    console.log('📚 Subjects in DB:');
    subResult.rows.forEach(r => {
      console.log(`  ${r.subject_code.padEnd(8)} — ${r.subject_name}`);
    });

    console.log('\n🎉 Seed complete!');
    console.log('\n📌 To add more school years or subjects in the future,');
    console.log('   go to System Settings → (we will add a management page there)');
    console.log('   OR just run this script again with updated values.\n');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

seed();