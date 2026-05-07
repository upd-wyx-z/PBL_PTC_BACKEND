// ============================================================
//  src/utils/auditLog.js
//  Writes entries to the audit_logs table in PTC_DB
//  Called after every significant action (add, edit, delete, etc.)
// ============================================================

const pool = require('../config/db');

/**
 * Inserts a record into audit_logs.
 *
 * @param {object} params
 * @param {string}  params.user_id      - UUID of the user performing the action
 * @param {string}  params.action       - e.g. 'CREATE_USER', 'DELETE_USER', 'TOGGLE_STATUS'
 * @param {string}  params.target_table - Table affected e.g. 'users'
 * @param {string}  params.target_id    - PK of the affected record (as string)
 * @param {object}  [params.old_values] - Snapshot before change (for edits)
 * @param {object}  [params.new_values] - Snapshot after change
 * @param {string}  [params.ip_address] - Requester IP address
 */
async function writeAuditLog({ user_id, action, target_table, target_id, old_values = null, new_values = null, ip_address = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (user_id, action, target_table, target_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user_id,
        action,
        target_table,
        target_id,
        old_values  ? JSON.stringify(old_values)  : null,
        new_values  ? JSON.stringify(new_values)  : null,
        ip_address,
      ]
    );
  } catch (err) {
    // Audit log failures should never crash the main request
    console.error('⚠️  Audit log write failed:', err.message);
  }
}

module.exports = { writeAuditLog };
