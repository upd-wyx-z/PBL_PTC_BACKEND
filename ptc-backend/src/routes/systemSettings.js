// ============================================================
//  src/routes/systemSettings.js
//  System Settings routes — System Admin only
//  Base path: /api/system
// ============================================================

const express         = require('express');
const router          = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getAuditLogs,
  getBackupConfig,
  saveBackupConfig,
  manualBackup,
} = require('../controllers/systemSettingsController');

// System Admin only middleware
const sysAdminOnly = [requireAuth, requireRole('system_admin')];

// GET  /api/system/audit-logs     — fetch audit logs (search, filter, sort)
router.get('/audit-logs', ...sysAdminOnly, getAuditLogs);

// GET  /api/system/backup-config  — get current auto-backup settings
router.get('/backup-config', ...sysAdminOnly, getBackupConfig);

// PUT  /api/system/backup-config  — save auto-backup settings
router.put('/backup-config', ...sysAdminOnly, saveBackupConfig);

// POST /api/system/backup         — trigger manual backup download
router.post('/backup', ...sysAdminOnly, manualBackup);

module.exports = router;