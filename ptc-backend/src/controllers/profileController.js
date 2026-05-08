// ============================================================
//  src/controllers/profileController.js — FIXED VERSION
//  Handles the logged-in user's own profile
// ============================================================

const pool              = require('../config/db');
const bcrypt            = require('bcrypt');
const path              = require('path');
const fs                = require('fs');
const { writeAuditLog } = require('../utils/auditLog');

const SALT_ROUNDS = 10;

async function getMe(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        u.user_id, u.first_name, u.middle_name, u.last_name, u.suffix,
        u.email, u.contact_no, u.specialization, u.profile_photo,
        u.employee_no, u.is_active, u.last_login, u.created_at,
        r.role_id, r.role_name,
        d.department_id, d.dept_code, d.dept_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = $1
    `, [req.user.user_id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Profile not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getMe error:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
}

async function updateMe(req, res) {
  try {
    const user_id = req.user.user_id;
    const { first_name, last_name, middle_name = null, contact_no = null, specialization = null } = req.body;

    if (!first_name || !last_name) return res.status(400).json({ message: 'First and last name are required.' });

    const oldResult = await pool.query(
      `SELECT first_name, last_name, contact_no, specialization FROM users WHERE user_id = $1`, [user_id]
    );

    const result = await pool.query(`
      UPDATE users SET
        first_name=$1, last_name=$2, middle_name=$3, contact_no=$4, specialization=$5, updated_at=NOW()
      WHERE user_id=$6
      RETURNING user_id, first_name, middle_name, last_name, email, contact_no, specialization, profile_photo, updated_at
    `, [first_name, last_name, middle_name, contact_no, specialization, user_id]);

    await writeAuditLog({ user_id, action: 'UPDATE_OWN_PROFILE', target_table: 'users', target_id: user_id, old_values: oldResult.rows[0], new_values: { first_name, last_name, contact_no, specialization }, ip_address: req.ip });
    res.json({ message: 'Profile updated successfully.', user: result.rows[0] });
  } catch (err) {
    console.error('updateMe error:', err.message);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
}

async function changeMyPassword(req, res) {
  try {
    const user_id = req.user.user_id;
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) return res.status(400).json({ message: 'All password fields are required.' });
    if (new_password !== confirm_password) return res.status(400).json({ message: 'New passwords do not match.' });
    if (new_password.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    if (old_password === new_password) return res.status(400).json({ message: 'New password must be different from current.' });

    const userResult = await pool.query(`SELECT password_hash FROM users WHERE user_id = $1`, [user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(old_password, userResult.rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect. Please try again.' });

    const new_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await pool.query(`UPDATE users SET password_hash=$1, updated_at=NOW() WHERE user_id=$2`, [new_hash, user_id]);
    await writeAuditLog({ user_id, action: 'CHANGE_OWN_PASSWORD', target_table: 'users', target_id: user_id, ip_address: req.ip });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('changeMyPassword error:', err.message);
    res.status(500).json({ message: 'Failed to change password.' });
  }
}

async function uploadPhoto(req, res) {
  try {
    const user_id = req.user.user_id;
    if (!req.file) return res.status(400).json({ message: 'No photo uploaded.' });

    const photoUrl = `/uploads/profiles/${req.file.filename}`;

    // Delete old photo file if exists
    const oldResult = await pool.query(`SELECT profile_photo FROM users WHERE user_id=$1`, [user_id]);
    const oldPhoto = oldResult.rows[0]?.profile_photo;
    if (oldPhoto) {
      const oldPath = path.join(__dirname, '../../public', oldPhoto);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query(`UPDATE users SET profile_photo=$1, updated_at=NOW() WHERE user_id=$2`, [photoUrl, user_id]);
    await writeAuditLog({ user_id, action: 'UPLOAD_PROFILE_PHOTO', target_table: 'users', target_id: user_id, new_values: { profile_photo: photoUrl }, ip_address: req.ip });
    res.json({ message: 'Profile photo updated successfully.', profile_photo: photoUrl });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('uploadPhoto error:', err.message);
    res.status(500).json({ message: 'Failed to upload photo.' });
  }
}

module.exports = { getMe, updateMe, changeMyPassword, uploadPhoto };