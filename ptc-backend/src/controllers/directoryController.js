// ============================================================
//  src/controllers/directoryController.js
//  Handles Faculty Directory — active users with their dept & role
// ============================================================

const pool = require('../config/db');

// ── GET /api/directory ────────────────────────────────────────
// Returns all active users (all roles) with department & role info
// Supports optional query params: search, department, role
async function getDirectory(req, res) {
  try {
    const { search = '', department = '', role = '' } = req.query;

    // Build dynamic WHERE clauses
    const conditions = ['u.is_active = TRUE'];
    const params     = [];
    let   idx        = 1;

    // Search by name or email
    if (search.trim()) {
      conditions.push(`(
        LOWER(u.first_name || ' ' || u.last_name) LIKE $${idx}
        OR LOWER(u.email) LIKE $${idx}
      )`);
      params.push(`%${search.toLowerCase().trim()}%`);
      idx++;
    }

    // Filter by department code or name
    if (department.trim() && department !== 'All Departments') {
      conditions.push(`(LOWER(d.dept_code) = $${idx} OR LOWER(d.dept_name) LIKE $${idx + 1})`);
      params.push(department.toLowerCase().trim());
      params.push(`%${department.toLowerCase().trim()}%`);
      idx += 2;
    }

    // Filter by role name (case-insensitive, partial match for friendlier UX)
    if (role.trim() && role !== 'All Roles') {
      conditions.push(`LOWER(r.role_name) LIKE $${idx}`);
      params.push(`%${role.toLowerCase().trim()}%`);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.contact_no,
        u.specialization,
        u.profile_photo,
        u.is_active,
        r.role_name,
        d.dept_code,
        d.dept_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      ${whereClause}
      ORDER BY u.last_name ASC, u.first_name ASC
    `, params);

    res.json({ users: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('getDirectory error:', err.message);
    res.status(500).json({ message: 'Failed to fetch directory.' });
  }
}

// ── GET /api/directory/departments ───────────────────────────
// Returns unique departments from users currently in the system
async function getDepartments(req, res) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT d.dept_code, d.dept_name
      FROM departments d
      JOIN users u ON u.department_id = d.department_id
      WHERE u.is_active = TRUE
      ORDER BY d.dept_code ASC
    `);
    res.json({ departments: result.rows });
  } catch (err) {
    console.error('getDepartments error:', err.message);
    res.status(500).json({ message: 'Failed to fetch departments.' });
  }
}

// ── GET /api/directory/roles ─────────────────────────────────
// Returns unique roles from users currently in the system
async function getRoles(req, res) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT r.role_name
      FROM roles r
      JOIN users u ON u.role_id = r.role_id
      WHERE u.is_active = TRUE
      ORDER BY r.role_name ASC
    `);
    res.json({ roles: result.rows.map(r => r.role_name) });
  } catch (err) {
    console.error('getRoles error:', err.message);
    res.status(500).json({ message: 'Failed to fetch roles.' });
  }
}

module.exports = { getDirectory, getDepartments, getRoles };