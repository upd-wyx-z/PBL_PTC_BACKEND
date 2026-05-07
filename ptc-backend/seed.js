// ============================================================
//  seed.js
//  Run this ONCE to insert the initial users into PTC_DB
//  Default password for ALL users: ptc@2026
//
//  HOW TO RUN:
//    cd ptc-backend
//    node seed.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const DEFAULT_PASSWORD = 'ptc@2026';
const SALT_ROUNDS      = 10;

async function seed() {
  console.log('🌱 Starting PTC_DB seed...\n');

  try {
    const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    console.log(`✅ Password hashed: "${DEFAULT_PASSWORD}"\n`);

    // ── STEP 1: Insert Roles (if not exists) ──────────────
    console.log('📋 Inserting roles...');
    await pool.query(`
      INSERT INTO roles (role_name, description)
      VALUES
        ('faculty',       'Regular faculty member'),
        ('admin_dean',    'Dean administrator'),
        ('admin_vpaa',    'VPAA administrator'),
        ('admin_registrar', 'Registrar administrator'),
        ('system_admin',  'System administrator with full access')
      ON CONFLICT (role_name) DO NOTHING
    `);
    console.log('✅ Roles inserted!\n');

    // ── STEP 2: Insert a default Department (if not exists) 
    console.log('🏫 Inserting default department...');
    await pool.query(`
      INSERT INTO departments (dept_code, dept_name)
      VALUES
        ('IICT', 'Institute of Information and Communications Technology'),
        ('CBM',  'College of Business Management'),
        ('CTE',  'College of Teacher Education'),
        ('CAS',  'College of Arts and Sciences')
      ON CONFLICT (dept_code) DO NOTHING
    `);
    console.log('✅ Departments inserted!\n');

    // ── STEP 3: Fetch role IDs ─────────────────────────────
    const rolesResult = await pool.query(`SELECT role_id, role_name FROM roles`);
    const roles = {};
    rolesResult.rows.forEach(r => { roles[r.role_name] = r.role_id; });

    // ── STEP 4: Fetch department ID ────────────────────────
    const deptResult = await pool.query(`SELECT department_id FROM departments WHERE dept_code = 'IICT'`);
    const iict_id = deptResult.rows[0]?.department_id || null;

    // ── STEP 5: Insert the 4 users ─────────────────────────
    console.log('👥 Inserting users...');

    const users = [
      {
        first_name:    'John Kennidy',
        last_name:     'Abunda',
        email:         'faculty@ptc.edu.ph',
        role_name:     'faculty',
        specialization: 'Instructor',
        employee_no:   'EMP-001',
      },
      {
        first_name:    'Angel Cylo G.',
        last_name:     'Real',
        email:         'dean@ptc.edu.ph',
        role_name:     'admin_dean',
        specialization: 'Dean, IICT',
        employee_no:   'EMP-002',
      },
      {
        first_name:    'VPAA',
        last_name:     'Admin',
        email:         'vpaa@ptc.edu.ph',
        role_name:     'admin_vpaa',
        specialization: 'VPAA',
        employee_no:   'EMP-003',
      },
      {
        first_name:    'Registrar',
        last_name:     'Admin',
        email:         'registrar@ptc.edu.ph',
        role_name:     'admin_registrar',
        specialization: 'Registrar',
        employee_no:   'EMP-004',
      },
      {
        first_name:    'System',
        last_name:     'Administrator',
        email:         'sysadmin@ptc.edu.ph',
        role_name:     'system_admin',
        specialization: 'System Administrator',
        employee_no:   'EMP-005',
      },
    ];

    for (const user of users) {
      await pool.query(`
        INSERT INTO users
          (first_name, last_name, email, password_hash, role_id,
           department_id, specialization, employee_no, is_active, is_email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, TRUE)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          is_active     = TRUE
      `, [
        user.first_name,
        user.last_name,
        user.email,
        password_hash,
        roles[user.role_name],
        iict_id,
        user.specialization,
        user.employee_no,
      ]);
      console.log(`  ✅ ${user.email} (${user.role_name})`);
    }

    console.log('\n🎉 Seed complete! Here are your login credentials:\n');
    console.log('┌─────────────────────────────┬───────────────────┬──────────────┐');
    console.log('│ Email                       │ Role              │ Password     │');
    console.log('├─────────────────────────────┼───────────────────┼──────────────┤');
    console.log('│ faculty@ptc.edu.ph          │ faculty           │ ptc@2026     │');
    console.log('│ dean@ptc.edu.ph             │ admin_dean        │ ptc@2026     │');
    console.log('│ vpaa@ptc.edu.ph             │ admin_vpaa        │ ptc@2026     │');
    console.log('│ registrar@ptc.edu.ph        │ admin_registrar   │ ptc@2026     │');
    console.log('│ sysadmin@ptc.edu.ph         │ system_admin      │ ptc@2026     │');
    console.log('└─────────────────────────────┴───────────────────┴──────────────┘');

  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error('Make sure your .env DB credentials are correct and PTC_DB is running!');
  } finally {
    await pool.end();
    process.exit();
  }
}

seed();