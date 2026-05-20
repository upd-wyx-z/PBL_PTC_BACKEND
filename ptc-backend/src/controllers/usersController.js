// ============================================================
//  src/controllers/usersController.js
//  Handles all User Management actions — System Admin only
//  Security: all mutating actions require admin password verify
// ============================================================

const pool   = require('../config/db');
const bcrypt = require('bcrypt');

// ── HELPER: verify the requesting admin's own password ────────
// The frontend Security Verification modal sends { admin_password }
// in the request body before any destructive action.
async function verifyAdminPassword(adminUserId, plainPassword) {
  const result = await pool.query(
    `SELECT password_hash FROM users WHERE user_id = $1`,
    [adminUserId]
  );
  if (!result.rows.length) return false;
  return bcrypt.compare(plainPassword, result.rows[0].password_hash);
}

// ── HELPER: map frontend role label → DB role_id ─────────────
// The Add/Edit form sends role as a display label ('Faculty', 'Dean', etc.)
// We need to translate that to the actual role_id in the roles table.
async function getRoleId(roleLabel) {
  // Map frontend display names to DB role_name values
  const roleMap = {
    'Faculty':      'faculty',
    'Dean':         'admin_dean',
    'Registrar':    'admin_registrar',
    'VPAA':         'admin_vpaa',
    'System Admin': 'system_admin',
  };

  const dbName = roleMap[roleLabel];
  if (!dbName) return null; // Safety check

  const result = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [dbName]);
  return result.rows[0]?.role_id;
}

// ── HELPER: map DB role_name → frontend display label ────────
function formatRoleLabel(role_name = '') {
  const displayMap = {
    'faculty':          'Faculty',
    'admin_dean':       'Dean',
    'admin_registrar':  'Registrar',
    'admin_vpaa':       'VPAA',
    'system_admin':     'System Admin',
  };
  return displayMap[role_name] || role_name;
}

// ── HELPER: check if a session is currently active ───────────
async function isUserOnline(userId) {
  const result = await pool.query(
    `SELECT 1 FROM user_sessions
     WHERE user_id = $1
       AND is_active = TRUE
       AND expires_at > NOW()
     LIMIT 1`,
    [userId]
  );
  return result.rowCount > 0;
}

// ── GET /api/users ────────────────────────────────────────────
// Returns all users with optional search/filter/sort query params
// Query params: search, department, role, status
async function getUsers(req, res) {
  try {
    const { search = '', department = '', role = '', status = '' } = req.query;

    const conditions = [];
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

    // Filter by department code
    if (department.trim() && department !== 'All Departments') {
      conditions.push(`LOWER(d.dept_code) = $${idx}`);
      params.push(department.toLowerCase().trim());
      idx++;
    }

    // Filter by role display label (maps to DB role_name)
    if (role.trim() && role !== 'All Roles') {
      const roleMap = {
        'Faculty':      'faculty',
        'Dean':         'admin_dean',
        'Registrar':    'admin_registrar',
        'VPAA':         'admin_vpaa',
        'System Admin': 'system_admin',
      };
      const dbRole = roleMap[role];
      if (dbRole) {
        conditions.push(`r.role_name = $${idx}`);
        params.push(dbRole);
        idx++;
      }
    }

    // Filter by account status (Active = is_active TRUE, Deactivated = FALSE)
    if (status.trim() && status !== 'All Statuses') {
      conditions.push(`u.is_active = $${idx}`);
      params.push(status === 'Active');
      idx++;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

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
        u.created_at,
        r.role_name,
        d.dept_code,
        d.dept_name
      FROM users u
      JOIN  roles r       ON u.role_id       = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      ${whereClause}
      ORDER BY u.last_name ASC, u.first_name ASC
    `, params);

    // Attach online status and map role label for each user
    const users = await Promise.all(result.rows.map(async (u) => ({
      ...u,
      role:       formatRoleLabel(u.role_name),
      department: u.dept_code || '',
      status:     u.is_active ? 'Active' : 'Deactivated',
      is_online:  await isUserOnline(u.user_id),
    })));

    res.json({ users, total: users.length });
  } catch (err) {
    console.error('getUsers error:', err.message);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
}

// ── GET /api/users/departments ────────────────────────────────
// Returns unique department codes from the departments table
async function getUserDepartments(req, res) {
  try {
    const result = await pool.query(`
      SELECT dept_code, dept_name
      FROM departments
      ORDER BY dept_code ASC
    `);
    res.json({ departments: result.rows });
  } catch (err) {
    console.error('getUserDepartments error:', err.message);
    res.status(500).json({ message: 'Failed to fetch departments.' });
  }
}

// ── GET /api/users/roles ──────────────────────────────────────
// Returns display-friendly role labels for the filter dropdown
async function getUserRoles(req, res) {
  try {
    const result = await pool.query(`
      SELECT role_name FROM roles ORDER BY role_id ASC
    `);
    const labels = result.rows.map(r => formatRoleLabel(r.role_name));
    res.json({ roles: labels });
  } catch (err) {
    console.error('getUserRoles error:', err.message);
    res.status(500).json({ message: 'Failed to fetch roles.' });
  }
}

// ── GET /api/users/metrics ────────────────────────────────────
// Returns counters: active, deactivated, online, offline
async function getUserMetrics(req, res) {
  try {
    const countResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = TRUE)  AS active_count,
        COUNT(*) FILTER (WHERE is_active = FALSE) AS deactivated_count,
        COUNT(*)                                   AS total_count
      FROM users
    `);

    // Count online: users with at least 1 active, non-expired session
    const onlineResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS online_count
      FROM user_sessions
      WHERE is_active = TRUE AND expires_at > NOW()
    `);

    const { active_count, deactivated_count, total_count } = countResult.rows[0];
    const online_count  = parseInt(onlineResult.rows[0].online_count, 10);
    const offline_count = parseInt(total_count, 10) - online_count;

    res.json({
      activeCount:      parseInt(active_count, 10),
      deactivatedCount: parseInt(deactivated_count, 10),
      onlineCount:      online_count,
      offlineCount:     offline_count < 0 ? 0 : offline_count,
    });
  } catch (err) {
    console.error('getUserMetrics error:', err.message);
    res.status(500).json({ message: 'Failed to fetch metrics.' });
  }
}

// ── POST /api/users ───────────────────────────────────────────
// Create a new user account
// Body: { first_name, last_name, email, contact_no, role, department,
//         specialization, admin_password, initial_password }
async function createUser(req, res) {
  let department_id = null;
  let role_id = null;

  try {
    const adminId = req.user.user_id;

    // 1. Removed employee_no from req.body (the frontend doesn't send it anymore)
    const {
      first_name, last_name, email, contact_no,
      role, department, specialization,
      admin_password, initial_password
    } = req.body;

    // 2. Removed employee_no from the validation check
    if (!first_name || !last_name || !email || !role || !admin_password || !initial_password) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Resolve Role & Department
    role_id = await getRoleId(role);
    if (!role_id) return res.status(400).json({ message: `Invalid role: ${role}` });

    if (department && department !== 'All Departments') {
      const deptResult = await pool.query(
        `SELECT department_id FROM departments WHERE LOWER(dept_code) = $1`,
        [department.toLowerCase()]
      );
      if (deptResult.rows.length > 0) {
        department_id = deptResult.rows[0].department_id;
      }
    }

    const password_hash = await bcrypt.hash(initial_password, 10);

    // 3. ⚙️ AUTO-GENERATE EMPLOYEE NUMBER ⚙️
    let next_employee_no = 'EMP-1000'; // Default if the database is totally empty

    // Find the most recently created employee number
    const lastEmp = await pool.query(`
      SELECT employee_no FROM users 
      WHERE employee_no LIKE 'EMP-%' 
      ORDER BY created_at DESC LIMIT 1
    `);

    if (lastEmp.rows.length > 0) {
      // Grab the last number (e.g., splits "EMP-1000" and takes the "1000")
      const lastNumber = parseInt(lastEmp.rows[0].employee_no.split('-')[1]);
      next_employee_no = `EMP-${lastNumber + 1}`; // Creates "EMP-1001"
    }

    // 4. Insert User using the generated next_employee_no
    const insertResult = await pool.query(`
      INSERT INTO users (
        role_id, department_id, employee_no, first_name, last_name,
        email, contact_no, specialization, password_hash,
        is_active, is_email_verified
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, TRUE, FALSE)
      RETURNING user_id, first_name, last_name, email, is_active, created_at, employee_no
    `, [
      role_id, department_id, next_employee_no, first_name, last_name,
      email, contact_no || null, specialization || null, password_hash,
    ]);

    // 5. Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'CREATE_USER', 'users', $2, $3, $4)
    `, [
      adminId,
      insertResult.rows[0].user_id,
      JSON.stringify({ first_name, last_name, email, role, employee_no: next_employee_no }),
      req.ip,
    ]);

    res.status(201).json({
      message: `Account created successfully with ID: ${next_employee_no}`,
      user: insertResult.rows[0],
    });

  } catch (err) {
    console.error('createUser error:', err.message);
    res.status(500).json({ message: 'Failed to create user.' });
  }
}

// ── PUT /api/users/:id ────────────────────────────────────────
// Update user details (name, email, contact, role, dept, specialization, status)
// Body: { first_name, last_name, email, contact_no, role, department,
//         specialization, status, admin_password }
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const {
      first_name, last_name, email, contact_no,
      role, department, specialization, status,
      admin_password, employee_no,
    } = req.body;

    if (!admin_password) {
      return res.status(400).json({ message: 'Admin password is required.' });
    }

    // --- Verify admin password ---
    const adminId = req.user.user_id;
    const isValid = await verifyAdminPassword(adminId, admin_password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password. Action denied.' });
    }

    // --- Check user exists ---
    const existing = await pool.query(
      `SELECT * FROM users WHERE user_id = $1`, [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // --- Check email uniqueness (exclude self) ---
    if (email) {
      const emailCheck = await pool.query(
        `SELECT 1 FROM users WHERE email = $1 AND user_id != $2`, [email, id]
      );
      if (emailCheck.rowCount > 0) {
        return res.status(409).json({ message: 'Email is already in use by another account.' });
      }
    }

    // --- Check employee_no uniqueness (exclude self) ---
    if (employee_no) {
      const empCheck = await pool.query(
        `SELECT 1 FROM users WHERE employee_no = $1 AND user_id != $2`, [employee_no, id]
      );
      if (empCheck.rowCount > 0) {
        return res.status(409).json({ message: 'This Employee Number is already in use by another account.' });
      }
    }

    // --- Resolve role_id ---
    let role_id = existing.rows[0].role_id;
    if (role) {
      const resolved = await getRoleId(role);
      if (!resolved) {
        return res.status(400).json({ message: `Invalid role: ${role}` });
      }
      role_id = resolved;
    }

    // --- Resolve department_id ---
    let department_id = existing.rows[0].department_id;
    
    if (department && department !== 'All Departments') {
      const deptResult = await pool.query(
        `SELECT department_id FROM departments WHERE LOWER(dept_code) = $1`,
        [department.toLowerCase()]
      );
      department_id = deptResult.rows[0]?.department_id ?? existing.rows[0].department_id;
    }

    const is_active = status ? (status === 'Active') : existing.rows[0].is_active;

    // --- Update ---
    // --- Update ---
    await pool.query(`
      UPDATE users SET
        first_name    = COALESCE($1, first_name),
        last_name     = COALESCE($2, last_name),
        email         = COALESCE($3, email),
        contact_no    = COALESCE($4, contact_no),
        role_id       = $5,
        department_id = $6,
        specialization = COALESCE($7, specialization),
        is_active     = $8,
        employee_no   = COALESCE($9, employee_no),
        updated_at    = NOW()
      WHERE user_id = $10
    `, [
      first_name || null, last_name || null, email || null,
      contact_no || null, role_id, department_id,
      specialization || null, is_active, 
      employee_no || null, 
      id,
    ]);
    
    // --- Audit log ---
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'UPDATE_USER', 'users', $2, $3, $4)
    `, [adminId, id, JSON.stringify(req.body), req.ip]);

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    console.error('updateUser error:', err.message);
    res.status(500).json({ message: 'Failed to update user.' });
  }
}

// ── PATCH /api/users/:id/status ───────────────────────────────
// Toggle is_active TRUE ↔ FALSE
// Body: { admin_password }
async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { admin_password } = req.body;

    if (!admin_password) {
      return res.status(400).json({ message: 'Admin password is required.' });
    }

    const adminId = req.user.user_id;
    const isValid = await verifyAdminPassword(adminId, admin_password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password. Action denied.' });
    }

    const existing = await pool.query(
      `SELECT user_id, is_active, first_name, last_name FROM users WHERE user_id = $1`, [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const current   = existing.rows[0];
    const newStatus = !current.is_active;

    await pool.query(`
      UPDATE users SET is_active = $1, updated_at = NOW() WHERE user_id = $2
    `, [newStatus, id]);

    // If deactivating — also kill all their active sessions
    if (!newStatus) {
      await pool.query(`
        UPDATE user_sessions SET is_active = FALSE
        WHERE user_id = $1 AND is_active = TRUE
      `, [id]);
    }

    // --- Audit log ---
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, $2, 'users', $3, $4, $5)
    `, [
      adminId,
      newStatus ? 'REACTIVATE_USER' : 'DEACTIVATE_USER',
      id,
      JSON.stringify({ is_active: newStatus }),
      req.ip,
    ]);

    res.json({
      message:   `Account ${newStatus ? 'reactivated' : 'deactivated'} successfully.`,
      is_active: newStatus,
    });
  } catch (err) {
    console.error('toggleUserStatus error:', err.message);
    res.status(500).json({ message: 'Failed to toggle user status.' });
  }
}

// ── PATCH /api/users/:id/password ────────────────────────────
// Admin-forced password reset for any user
// Body: { new_password, admin_password }
async function changeUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { new_password, admin_password } = req.body;

    if (!new_password || !admin_password) {
      return res.status(400).json({ message: 'new_password and admin_password are required.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const adminId = req.user.user_id;
    const isValid = await verifyAdminPassword(adminId, admin_password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password. Action denied.' });
    }

    const existing = await pool.query(
      `SELECT user_id FROM users WHERE user_id = $1`, [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    await pool.query(`
      UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2
    `, [password_hash, id]);

    // Force re-login: kill all active sessions for this user
    await pool.query(`
      UPDATE user_sessions SET is_active = FALSE
      WHERE user_id = $1 AND is_active = TRUE
    `, [id]);

    // --- Audit log ---
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, ip_address)
      VALUES ($1, 'CHANGE_PASSWORD', 'users', $2, $3)
    `, [adminId, id, req.ip]);

    res.json({ message: 'Password changed successfully. User will need to log in again.' });
  } catch (err) {
    console.error('changeUserPassword error:', err.message);
    res.status(500).json({ message: 'Failed to change password.' });
  }
}

// ── DELETE /api/users/:id ─────────────────────────────────────
// Permanently delete a user account
// Body: { admin_password }
async function deleteUser(req, res) {
  try {
    const { id }            = req.params;
    const { admin_password } = req.body;

    if (!admin_password) {
      return res.status(400).json({ message: 'Admin password is required.' });
    }

    const adminId = req.user.user_id;
    const isValid = await verifyAdminPassword(adminId, admin_password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password. Action denied.' });
    }

    // Prevent self-deletion
    if (id === adminId) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const existing = await pool.query(
      `SELECT user_id, first_name, last_name, email FROM users WHERE user_id = $1`, [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const target = existing.rows[0];

    // Delete (cascades handle sessions, tokens, etc. via ON DELETE CASCADE)
    await pool.query(`DELETE FROM users WHERE user_id = $1`, [id]);

    // --- Audit log ---
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, old_values, ip_address)
      VALUES ($1, 'DELETE_USER', 'users', $2, $3, $4)
    `, [
      adminId,
      id,
      JSON.stringify({ name: `${target.first_name} ${target.last_name}`, email: target.email }),
      req.ip,
    ]);

    res.json({ message: `Account for ${target.first_name} ${target.last_name} deleted permanently.` });
  } catch (err) {
    console.error('deleteUser error:', err.message);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
}

module.exports = {
  getUsers,
  getUserDepartments,
  getUserRoles,
  getUserMetrics,
  createUser,
  updateUser,
  toggleUserStatus,
  changeUserPassword,
  deleteUser,
};