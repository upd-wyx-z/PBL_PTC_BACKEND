// ============================================================
//  src/controllers/authController.js
//  Handles Login (2-Step MFA), Logout, and Get Current User (me)
//  Uses session_id stored in HTTP-only cookie
//  * DEMO MODE: Email sending bypassed for cloud stability *
// ============================================================

const pool              = require('../config/db');
const bcrypt            = require('bcrypt');
const { v4: uuidv4 }    = require('uuid');
const { writeAuditLog } = require('../utils/auditLog');
const crypto            = require('crypto');

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
//  STEP 1: POST /api/auth/login
//  Verifies password and assigns a hardcoded DEMO OTP
// ─────────────────────────────────────────────────────────────
async function loginStepOne(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const userResult = await pool.query(
      `SELECT user_id, email, password_hash, is_active FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email address or password.' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account deactivated. Contact administrator.' });
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email address or password.' });
    }

    // --- DEMO BYPASS: HARDCODED OTP ---
    const otpCode = '123456'; 
    const expiresAt = new Date(Date.now() + 10 * 60000); 

    // Save to DB
    await pool.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE user_id = $3',
      [otpCode, expiresAt, user.user_id]
    );

    console.log(`\n🔔 DEMO MODE: Login approved for ${user.email}. Use OTP: 123456\n`);

    res.status(200).json({ 
      message: 'Password verified. Demo mode active: Use 123456 as your OTP.', 
      email: user.email 
    });

  } catch (err) {
    console.error('loginStepOne error:', err.message);
    res.status(500).json({ message: 'Server error during login step one.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 2: POST /api/auth/verify-otp
//  Validates the OTP and creates the actual user session
// ─────────────────────────────────────────────────────────────
async function verifyOTP(req, res) {
  try {
    const { email, otp_code } = req.body;

    if (!email || !otp_code) {
      return res.status(400).json({ message: 'Email and OTP code are required.' });
    }

    // Pull full user data needed for the frontend session
    const userResult = await pool.query(
      `SELECT
         u.user_id, u.first_name, u.middle_name, u.last_name, u.suffix,
         u.email, u.profile_photo, u.contact_no, u.specialization,
         u.employee_no, u.department_id, u.otp_code, u.otp_expires_at,
         r.role_id, r.role_name, d.dept_code, d.dept_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.email = $1`,
      [email]
    );

    const user = userResult.rows[0];

    // Validate OTP
    if (!user || user.otp_code !== otp_code) {
      return res.status(401).json({ message: 'Invalid OTP code.' });
    }
    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(401).json({ message: 'OTP has expired. Please log in again.' });
    }

    // Clear OTP from DB
    await pool.query(
      'UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = $1',
      [user.user_id]
    );

    const session_id = uuidv4();
    const expires_at = new Date(Date.now() + SESSION_DURATION_MS);

    await pool.query(
      `INSERT INTO user_sessions (session_id, user_id, ip_address, user_agent, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [session_id, user.user_id, req.ip, req.headers['user-agent'] || null, expires_at]
    );

    await pool.query(`UPDATE users SET last_login = NOW() WHERE user_id = $1`, [user.user_id]);

    await writeAuditLog({
      user_id: user.user_id, action: 'LOGIN',
      target_table: 'user_sessions', target_id: session_id, ip_address: req.ip,
    });

    res.cookie('session_id', session_id, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: SESSION_DURATION_MS,
    });

    res.json({
      message: 'Login successful.',
      user: {
        user_id: user.user_id, first_name: user.first_name, middle_name: user.middle_name,
        last_name: user.last_name, suffix: user.suffix, email: user.email,
        profile_photo: user.profile_photo, contact_no: user.contact_no,
        specialization: user.specialization, employee_no: user.employee_no,
        department_id: user.department_id, dept_code: user.dept_code,
        dept_name: user.dept_name, role_id: user.role_id, role_name: user.role_name,
      },
    });

  } catch (err) {
    console.error('verifyOTP error:', err.message);
    res.status(500).json({ message: 'Server error during OTP verification.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  Logout and GetMe 
// ─────────────────────────────────────────────────────────────
async function logout(req, res) {
  try {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
      await pool.query(`UPDATE user_sessions SET is_active = FALSE WHERE session_id = $1`, [sessionId]);
      if (req.user) {
        await writeAuditLog({ user_id: req.user.user_id, action: 'LOGOUT', target_table: 'user_sessions', target_id: sessionId, ip_address: req.ip });
      }
    }
    res.clearCookie('session_id', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ message: 'Server error during logout.' });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.suffix, u.email, u.profile_photo, u.contact_no, u.specialization, u.employee_no, u.department_id, r.role_id, r.role_name, d.dept_code, d.dept_name
       FROM users u JOIN roles r ON u.role_id = r.role_id LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.user_id = $1`, [req.user.user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('getMe error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { loginStepOne, verifyOTP, logout, getMe };
