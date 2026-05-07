// ============================================================
//  src/controllers/authController.js
//  Handles Login, Logout, and Get Current User (me)
//  Uses session_id stored in HTTP-only cookie
//  All table/column names match PTC_DB schema exactly
// ============================================================

const pool              = require('../config/db');
const bcrypt            = require('bcrypt');
const { v4: uuidv4 }   = require('uuid');
const { writeAuditLog } = require('../utils/auditLog');

// Session duration: 8 hours (matches user_sessions.expires_at default in DB)
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Called by Login.jsx → handleSubmit → onLogin(email, password)
//
//  1. Find user by email in users table
//  2. Verify password against password_hash (bcrypt)
//  3. Check is_active
//  4. Create a new row in user_sessions
//  5. Set session_id as HTTP-only cookie
//  6. Return user info to frontend
// ─────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user by email — CITEXT in DB so case-insensitive
    const userResult = await pool.query(
      `SELECT
         u.user_id,
         u.first_name,
         u.middle_name,
         u.last_name,
         u.suffix,
         u.email,
         u.password_hash,
         u.is_active,
         u.profile_photo,
         u.contact_no,
         u.specialization,
         u.employee_no,
         u.department_id,
         r.role_id,
         r.role_name,
         d.dept_code,
         d.dept_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email address or password. Please try again.' });
    }

    const user = userResult.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact the administrator.' });
    }

    // Verify password against bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email address or password. Please try again.' });
    }

    // Generate a unique session_id
    const session_id = uuidv4();
    const expires_at = new Date(Date.now() + SESSION_DURATION_MS);

    // Insert new session into user_sessions table
    await pool.query(
      `INSERT INTO user_sessions
         (session_id, user_id, ip_address, user_agent, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [
        session_id,
        user.user_id,
        req.ip,
        req.headers['user-agent'] || null,
        expires_at,
      ]
    );

    // Update last_login timestamp in users table
    await pool.query(
      `UPDATE users SET last_login = NOW() WHERE user_id = $1`,
      [user.user_id]
    );

    // Write to audit_logs
    await writeAuditLog({
      user_id:      user.user_id,
      action:       'LOGIN',
      target_table: 'user_sessions',
      target_id:    session_id,
      ip_address:   req.ip,
    });

    // Set session_id as HTTP-only cookie (cannot be read by JS — more secure)
    res.cookie('session_id', session_id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax',
      maxAge:   SESSION_DURATION_MS,
    });

    // Return user info to App.jsx (matches what App.jsx needs for currentUser state)
    res.json({
      message: 'Login successful.',
      user: {
        user_id:       user.user_id,
        first_name:    user.first_name,
        middle_name:   user.middle_name,
        last_name:     user.last_name,
        suffix:        user.suffix,
        email:         user.email,
        profile_photo: user.profile_photo,
        contact_no:    user.contact_no,
        specialization: user.specialization,
        employee_no:   user.employee_no,
        department_id: user.department_id,
        dept_code:     user.dept_code,
        dept_name:     user.dept_name,
        role_id:       user.role_id,
        role_name:     user.role_name,
      },
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login. Please try again.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/logout
//  Called when user clicks Logout button in Topbar (App.jsx)
//
//  1. Read session_id from cookie
//  2. Set is_active = FALSE in user_sessions
//  3. Clear the cookie
// ─────────────────────────────────────────────────────────────
async function logout(req, res) {
  try {
    const sessionId = req.cookies?.session_id;

    if (sessionId) {
      // Invalidate the session in DB
      await pool.query(
        `UPDATE user_sessions SET is_active = FALSE WHERE session_id = $1`,
        [sessionId]
      );

      // Write to audit_logs
      if (req.user) {
        await writeAuditLog({
          user_id:      req.user.user_id,
          action:       'LOGOUT',
          target_table: 'user_sessions',
          target_id:    sessionId,
          ip_address:   req.ip,
        });
      }
    }

    // Clear the cookie from the browser
    res.clearCookie('session_id', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logged out successfully.' });

  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ message: 'Server error during logout.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/me
//  Called on app load to restore session (if cookie still valid)
//  Useful for page refresh — keeps user logged in
// ─────────────────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    // req.user is attached by requireAuth middleware
    const result = await pool.query(
      `SELECT
         u.user_id,
         u.first_name,
         u.middle_name,
         u.last_name,
         u.suffix,
         u.email,
         u.profile_photo,
         u.contact_no,
         u.specialization,
         u.employee_no,
         u.department_id,
         r.role_id,
         r.role_name,
         d.dept_code,
         d.dept_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('getMe error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { login, logout, getMe };
