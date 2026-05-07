// ============================================================
//  src/middleware/auth.js
//  Session-based authentication middleware
//  Checks the session_id cookie against the user_sessions table
// ============================================================

const pool = require('../config/db');

/**
 * requireAuth
 * Validates the session_id from the request cookie.
 * Attaches the full user object to req.user if valid.
 * Returns 401 if session is missing, expired, or inactive.
 */
async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies?.session_id;

    if (!sessionId) {
      return res.status(401).json({ message: 'Unauthorized. No session found.' });
    }

    // Look up session in user_sessions table
    const sessionResult = await pool.query(
      `SELECT 
         s.session_id,
         s.user_id,
         s.expires_at,
         s.is_active,
         u.role_id,
         u.first_name,
         u.last_name,
         u.email,
         u.is_active AS user_is_active,
         r.role_name
       FROM user_sessions s
       JOIN users u ON s.user_id = u.user_id
       JOIN roles r ON u.role_id = r.role_id
       WHERE s.session_id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid session.' });
    }

    const session = sessionResult.rows[0];

    // Check if session is still active and not expired
    if (!session.is_active || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    // Check if the user account is still active
    if (!session.user_is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    // Update last_activity timestamp
    await pool.query(
      `UPDATE user_sessions SET last_activity = NOW() WHERE session_id = $1`,
      [sessionId]
    );

    // Attach user info to request for use in controllers
    req.user = {
      user_id:   session.user_id,
      role_id:   session.role_id,
      role_name: session.role_name,
      first_name: session.first_name,
      last_name:  session.last_name,
      email:      session.email,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ message: 'Server error during authentication.' });
  }
}

/**
 * requireRole
 * Role-based access control. Pass allowed role_names as arguments.
 * Example: requireRole('system_admin', 'admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
