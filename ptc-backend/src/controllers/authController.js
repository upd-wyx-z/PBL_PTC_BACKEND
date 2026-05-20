// ============================================================
//  src/controllers/authController.js
//  Handles Login (2-Step MFA), Logout, and Get Current User (me)
//  Uses session_id stored in HTTP-only cookie
// ============================================================

const pool              = require('../config/db');
const bcrypt            = require('bcrypt');
const { v4: uuidv4 }    = require('uuid');
const { writeAuditLog } = require('../utils/auditLog');
const nodemailer        = require('nodemailer');
const crypto            = require('crypto');

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Configure Email Sender (Requires Gmail App Password)
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

// ─────────────────────────────────────────────────────────────
//  STEP 1: POST /api/auth/login
//  Verifies password and sends OTP to email. DOES NOT log user in yet.
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

    // Generate 6-digit OTP & Expiration (10 mins)
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); 

    // Save to DB
    await pool.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE user_id = $3',
      [otpCode, expiresAt, user.user_id]
    );

    // Send Email
    await transporter.sendMail({
      from: `"PTC EduSync Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'PTC EduSync - Your Login OTP',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; padding: 40px 20px; margin: 0;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            
            <div style="background-color: #15803d; padding: 30px 20px; text-align: center;">
              <img src="https://www.paterostechnologicalcollege.edu.ph/ASSETS/IMAGES/LOGO/logo-ptc.png" alt="PTC Logo" style="width: 80px; height: auto; margin-bottom: 15px; display: inline-block;">
              <h1 style="color: #facc15; margin: 0; font-size: 26px; letter-spacing: 1px; font-weight: bold;">PTC EduSync</h1>
            </div>
            
            <div style="padding: 40px 30px; text-align: center;">
              <h2 style="color: #1f2937; font-size: 22px; margin-top: 0; margin-bottom: 16px;">Security Verification</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
                You recently requested to log in to your PTC EduSync account. Please use the following 6-digit code to complete your authentication:
              </p>
              
              <div style="background-color: #f9fafb; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #15803d; display: block; margin-left: 10px;">
                  ${otpCode}
                </span>
              </div>
              
              <p style="color: #ef4444; font-size: 14px; font-weight: 600; margin-top: 0; margin-bottom: 10px;">
                ⚠️ This code will expire in 10 minutes.
              </p>
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                If you did not attempt to log in, please secure your account and contact MIS immediately.
              </p>
            </div>
            
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Pateros Technological College. All rights reserved.<br>
                This is an automated message. Please do not reply.
              </p>
            </div>

          </div>
        </div>
      `
    });

    res.status(200).json({ 
      message: 'Password verified. Please check your email for the OTP.', 
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

    // --- Create Session (Your Original Logic) ---
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
//  Logout and GetMe (Unchanged)
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