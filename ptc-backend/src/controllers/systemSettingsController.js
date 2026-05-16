// ============================================================
//  src/controllers/systemSettingsController.js
//  Handles System Settings:
//    - Audit Logs (read, filter, search, export)
//    - Backup & Recovery (manual backup, auto-backup config)
//
//  DB Tables:
//    audit_logs:      log_id, user_id, action, target_table,
//                     target_id, old_values, new_values, ip_address, created_at
//    system_settings: setting_key, setting_value, description,
//                     updated_by, updated_at
// ============================================================

const pool = require('../config/db');
const path = require('path');
const fs   = require('fs');

// ── HELPER: Map target_table → friendly module name ──────────
function getModuleFromTable(targetTable, action) {
  if (!targetTable) {
    if (action?.includes('LOGIN') || action?.includes('LOGOUT')) return 'System Settings';
    return 'System Settings';
  }
  const map = {
    users:           'User Management',
    user_sessions:   'System Settings',
    resources:       'Department Repository',
    grade_sheets:    'Grading System',
    grade_entries:   'Grading System',
    tasks:           'Tasks & Schedule',
    calendar_events: 'Tasks & Schedule',
    announcements:   'Tasks & Schedule',
    class_schedules: 'Course Scheduling',
    workload_status: 'Workload Management',
    workload_memos:  'Workload Management',
    subjects:        'Workload Management',
    system_settings: 'System Settings',
  };
  return map[targetTable] || 'System Settings';
}

// ── GET /api/system/audit-logs ────────────────────────────────
// Returns paginated audit logs with search, module filter, sort
// Query params: search, module, sortBy, sortDir, page, limit,
//               start_date, end_date
async function getAuditLogs(req, res) {
  try {
    const {
      search     = '',
      module     = 'All Modules',
      sortBy     = 'created_at',
      sortDir    = 'desc',
      page       = 1,
      limit      = 50,
      start_date = '',
      end_date   = '',
    } = req.query;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    // Search by action, user name, or details
    if (search.trim()) {
      conditions.push(`(
        LOWER(al.action)       LIKE $${idx}
        OR LOWER(u.first_name || ' ' || u.last_name) LIKE $${idx}
        OR LOWER(al.target_table) LIKE $${idx}
        OR LOWER(al.target_id) LIKE $${idx}
      )`);
      params.push(`%${search.toLowerCase().trim()}%`);
      idx++;
    }

    // Filter by module (using target_table mapping)
    if (module && module !== 'All Modules') {
      const tableMap = {
        'User Management':      ['users', 'user_sessions'],
        'Department Repository': ['resources'],
        'Grading System':       ['grade_sheets', 'grade_entries'],
        'Tasks & Schedule':     ['tasks', 'calendar_events', 'announcements'],
        'Course Scheduling':    ['class_schedules'],
        'Workload Management':  ['workload_status', 'workload_memos', 'subjects'],
        'System Settings':      ['system_settings'],
      };
      const tables = tableMap[module];
      if (tables) {
        const placeholders = tables.map((_, i) => `$${idx + i}`).join(', ');
        conditions.push(`al.target_table IN (${placeholders})`);
        params.push(...tables);
        idx += tables.length;
      }
    }

    // Date range filter
    if (start_date) {
      conditions.push(`al.created_at >= $${idx}::date`);
      params.push(start_date);
      idx++;
    }
    if (end_date) {
      conditions.push(`al.created_at < ($${idx}::date + interval '1 day')`);
      params.push(end_date);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sort columns
    const allowedSort = ['created_at', 'action', 'user_name'];
    const safeSortBy  = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const safeSortDir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);

    // Get logs
    const result = await pool.query(`
      SELECT
        al.log_id,
        al.action,
        al.target_table,
        al.target_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.created_at AS timestamp,
        COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name,
        COALESCE(r.role_name, 'system') AS role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id  = u.user_id
      LEFT JOIN roles r ON u.role_id   = r.role_id
      ${whereClause}
      ORDER BY ${safeSortBy === 'user_name' ? 'user_name' : `al.${safeSortBy}`} ${safeSortDir}
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, parseInt(limit), offset]);

    // Shape the response to match what System_Settings.jsx expects
    const logs = result.rows.map(row => ({
      log_id:    row.log_id,
      user_name: row.user_name,
      role:      row.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      module:    getModuleFromTable(row.target_table, row.action),
      action:    row.action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      timestamp: row.timestamp,
      details:   row.new_values
        ? `New values: ${JSON.stringify(row.new_values)}`
        : row.old_values
        ? `Affected: ${JSON.stringify(row.old_values)}`
        : `Target: ${row.target_table || '—'} #${row.target_id || '—'}`,
    }));

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('getAuditLogs error:', err.message);
    res.status(500).json({ message: 'Failed to fetch audit logs.' });
  }
}

// ── GET /api/system/backup-config ────────────────────────────
// Returns the current auto-backup configuration from system_settings
async function getBackupConfig(req, res) {
  try {
    const result = await pool.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (
        'backup_enabled', 'backup_frequency',
        'backup_time', 'backup_retention'
      )
    `);

    // Build config object with defaults
    const config = {
      enabled:   true,
      frequency: 'daily',
      time:      '02:00',
      retention: '30',
    };

    result.rows.forEach(row => {
      if (row.setting_key === 'backup_enabled')   config.enabled   = row.setting_value === 'true';
      if (row.setting_key === 'backup_frequency')  config.frequency = row.setting_value;
      if (row.setting_key === 'backup_time')       config.time      = row.setting_value;
      if (row.setting_key === 'backup_retention')  config.retention = row.setting_value;
    });

    res.json(config);
  } catch (err) {
    console.error('getBackupConfig error:', err.message);
    res.status(500).json({ message: 'Failed to fetch backup configuration.' });
  }
}

// ── PUT /api/system/backup-config ────────────────────────────
// Saves auto-backup settings to system_settings table
// Body: { enabled, frequency, time, retention }
async function saveBackupConfig(req, res) {
  try {
    const user_id = req.user.user_id;
    const { enabled, frequency, time, retention } = req.body;

    const settings = [
      { key: 'backup_enabled',   value: String(enabled),   desc: 'Auto-backup enabled/disabled' },
      { key: 'backup_frequency', value: frequency,          desc: 'Backup frequency (daily/weekly/monthly)' },
      { key: 'backup_time',      value: time,               desc: 'Backup run time (HH:MM)' },
      { key: 'backup_retention', value: String(retention),  desc: 'Backup retention in days' },
    ];

    for (const setting of settings) {
      await pool.query(`
        INSERT INTO system_settings (setting_key, setting_value, description, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (setting_key) DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_by    = EXCLUDED.updated_by,
          updated_at    = NOW()
      `, [setting.key, setting.value, setting.desc, user_id]);
    }

    // Write to audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, new_values, ip_address)
      VALUES ($1, 'UPDATE_BACKUP_CONFIG', 'system_settings', $2, $3)
    `, [user_id, JSON.stringify({ enabled, frequency, time, retention }), req.ip]);

    res.json({ message: 'Backup configuration saved successfully.' });
  } catch (err) {
    console.error('saveBackupConfig error:', err.message);
    res.status(500).json({ message: 'Failed to save backup configuration.' });
  }
}

// ── POST /api/system/backup ───────────────────────────────────
// Triggers a manual database backup
// Returns a JSON snapshot of key tables as a downloadable file
async function manualBackup(req, res) {
  try {
    const user_id = req.user.user_id;

    // Collect key table data for backup
    const tables  = ['users', 'roles', 'departments', 'subjects', 'school_years',
                     'class_schedules', 'grade_sheets', 'grade_entries',
                     'announcements', 'tasks', 'resources', 'system_settings'];

    const backup = {
      generated_at: new Date().toISOString(),
      generated_by: req.user.user_id,
      version:      '1.0',
      tables:       {},
    };

    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT * FROM ${table} LIMIT 10000`);
        backup.tables[table] = result.rows;
      } catch {
        backup.tables[table] = [];
      }
    }

    // Write to audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, ip_address)
      VALUES ($1, 'MANUAL_BACKUP', 'system_settings', $2)
    `, [user_id, req.ip]);

    const fileName = `PTC_Backup_${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(JSON.stringify(backup, null, 2));

  } catch (err) {
    console.error('manualBackup error:', err.message);
    res.status(500).json({ message: 'Failed to generate backup.' });
  }
}

module.exports = {
  getAuditLogs,
  getBackupConfig,
  saveBackupConfig,
  manualBackup,
};