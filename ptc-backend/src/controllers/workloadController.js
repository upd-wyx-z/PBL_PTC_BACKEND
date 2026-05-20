// ============================================================
//  src/controllers/workloadController.js
//  Handles Workload Management for Dean and Faculty views
// ============================================================

const pool = require('../config/db');

// ── HELPER: format time from HH:MM:SS → H:MM AM/PM ──────────
function formatTime(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h    = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

// ── GET /api/workload/school-years ───────────────────────────
async function getSchoolYears(req, res) {
  try {
    const result = await pool.query(`
      SELECT sy_id, sy_label, semester, is_current
      FROM school_years
      ORDER BY sy_id DESC
    `);
    res.json({ schoolYears: result.rows });
  } catch (err) {
    console.error('getSchoolYears error:', err.message);
    res.status(500).json({ message: 'Failed to fetch school years.' });
  }
}

// ── GET /api/workload/subjects ───────────────────────────────
async function getSubjects(req, res) {
  try {
    const result = await pool.query(`
      SELECT s.subject_id, s.subject_code, s.subject_name, s.units,
             d.dept_code, d.dept_name
      FROM subjects s
      LEFT JOIN departments d ON s.department_id = d.department_id
      ORDER BY s.subject_code ASC
    `);
    res.json({ subjects: result.rows });
  } catch (err) {
    console.error('getSubjects error:', err.message);
    res.status(500).json({ message: 'Failed to fetch subjects.' });
  }
}

// ── POST /api/workload/subjects ──────────────────────────────
// Dean adds a new subject to the curriculum
async function addSubject(req, res) {
  try {
    const { subject_code, subject_name, units } = req.body;

    if (!subject_code || !subject_name || !units) {
      return res.status(400).json({ message: 'subject_code, subject_name, and units are required.' });
    }

    // Check uniqueness
    const exists = await pool.query(
      `SELECT 1 FROM subjects WHERE UPPER(subject_code) = $1`,
      [subject_code.toUpperCase()]
    );
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: `Subject code ${subject_code.toUpperCase()} already exists.` });
    }

    // Resolve department from requesting user
    const userResult = await pool.query(
      `SELECT department_id FROM users WHERE user_id = $1`, [req.user.user_id]
    );
    const department_id = userResult.rows[0]?.department_id || null;

    const result = await pool.query(`
      INSERT INTO subjects (subject_code, subject_name, units, department_id)
      VALUES ($1, $2, $3, $4)
      RETURNING subject_id, subject_code, subject_name, units
    `, [subject_code.toUpperCase(), subject_name, parseInt(units), department_id]);

    res.status(201).json({
      message: `Subject ${subject_code.toUpperCase()} added successfully.`,
      subject: result.rows[0],
    });
  } catch (err) {
    console.error('addSubject error:', err.message);
    res.status(500).json({ message: 'Failed to add subject.' });
  }
}

// ── DELETE /api/workload/subjects/:subjectId ─────────────────
async function deleteSubject(req, res) {
  try {
    const { subjectId } = req.params;

    const existing = await pool.query(
      `SELECT subject_id, subject_code FROM subjects WHERE subject_id = $1`, [subjectId]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    // Check if subject is in use
    const inUse = await pool.query(
      `SELECT 1 FROM class_schedules WHERE subject_id = $1 LIMIT 1`, [subjectId]
    );
    if (inUse.rowCount > 0) {
      return res.status(409).json({
        message: `Cannot delete ${existing.rows[0].subject_code} — it is currently assigned to one or more class schedules.`
      });
    }

    await pool.query(`DELETE FROM subjects WHERE subject_id = $1`, [subjectId]);

    res.json({ message: `Subject ${existing.rows[0].subject_code} deleted successfully.` });
  } catch (err) {
    console.error('deleteSubject error:', err.message);
    res.status(500).json({ message: 'Failed to delete subject.' });
  }
}

// ── GET /api/workload ─────────────────────────────────────────
// Dean: List of all faculty with their workload summary + review status
// Query params: sy_id, search, status (pending/acknowledged/revision_requested)
async function getFacultyWorkloadList(req, res) {
  try {
    const { sy_id, search = '', status = '' } = req.query;

    // Get current SY if not specified
    let targetSyId = sy_id;
    if (!targetSyId) {
      const currentSY = await pool.query(
        `SELECT sy_id FROM school_years WHERE is_current = TRUE LIMIT 1`
      );
      targetSyId = currentSY.rows[0]?.sy_id;
    }

    // Get all active faculty/admins
    const facultyResult = await pool.query(`
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        r.role_name,
        d.dept_code,
        d.dept_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.is_active = TRUE
        AND r.role_name IN ('faculty', 'admin_dean', 'admin_vpaa', 'admin_registrar')
      ORDER BY u.last_name ASC, u.first_name ASC
    `);

    // For each faculty, get workload metrics + review status
    const facultyWithMetrics = await Promise.all(
      facultyResult.rows.map(async (fac) => {
        // Get schedule metrics
        const schedResult = await pool.query(`
          SELECT COUNT(*) AS section_count,
                 COALESCE(SUM(s.units), 0) AS total_units
          FROM class_schedules cs
          JOIN subjects s ON cs.subject_id = s.subject_id
          WHERE cs.faculty_id = $1
            AND cs.sy_id = $2
        `, [fac.user_id, targetSyId]);

        // Get review status from workload_status table
        const statusResult = await pool.query(`
          SELECT workload_id, status, revision_remarks, acknowledged_at
          FROM workload_status
          WHERE faculty_id = $1 AND sy_id = $2
          LIMIT 1
        `, [fac.user_id, targetSyId]);

        const metrics       = schedResult.rows[0];
        const workloadRow   = statusResult.rows[0];

        return {
          user_id:          fac.user_id,
          first_name:       fac.first_name,
          last_name:        fac.last_name,
          role_name:        fac.role_name,
          dept_code:        fac.dept_code,
          dept_name:        fac.dept_name,
          total_units:      parseInt(metrics.total_units, 10),
          section_count:    parseInt(metrics.section_count, 10),
          workload_id:      workloadRow?.workload_id || null,
          status:           workloadRow?.status || 'pending',
          revision_remarks: workloadRow?.revision_remarks || null,
          acknowledged_at:  workloadRow?.acknowledged_at || null,
        };
      })
    );

    // Apply search filter
    let filtered = facultyWithMetrics;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(f =>
        `${f.first_name} ${f.last_name}`.toLowerCase().includes(q)
      );
    }

    // Apply status filter
    if (status && status !== 'all') {
      filtered = filtered.filter(f => f.status === status);
    }

    // Tallies (from unfiltered)
    const pendingCount      = facultyWithMetrics.filter(f => f.status === 'pending').length;
    const acknowledgedCount = facultyWithMetrics.filter(f => f.status === 'acknowledged').length;
    const revisionCount     = facultyWithMetrics.filter(f => f.status === 'revision_requested').length;

    res.json({
      faculty:          filtered,
      pendingCount,
      acknowledgedCount,
      revisionCount,
      sy_id:            targetSyId,
    });
  } catch (err) {
    console.error('getFacultyWorkloadList error:', err.message);
    res.status(500).json({ message: 'Failed to fetch faculty workload list.' });
  }
}

// ── GET /api/workload/:facultyId ──────────────────────────────
// Dean: Detailed schedule for one faculty member
async function getFacultyScheduleDetail(req, res) {
  try {
    const { facultyId } = req.params;
    const { sy_id }     = req.query;

    // Get current SY if not specified
    let targetSyId = sy_id;
    if (!targetSyId) {
      const currentSY = await pool.query(
        `SELECT sy_id FROM school_years WHERE is_current = TRUE LIMIT 1`
      );
      targetSyId = currentSY.rows[0]?.sy_id;
    }

    // Faculty info
    const facultyResult = await pool.query(`
      SELECT u.user_id, u.first_name, u.last_name,
             r.role_name, d.dept_code, d.dept_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = $1
    `, [facultyId]);

    if (!facultyResult.rowCount) {
      return res.status(404).json({ message: 'Faculty not found.' });
    }

    // Schedules
    const schedResult = await pool.query(`
      SELECT
        cs.schedule_id,
        cs.room,
        cs.section,
        cs.day_of_week,
        cs.time_start,
        cs.time_end,
        s.subject_code,
        s.subject_name,
        s.units
      FROM class_schedules cs
      JOIN subjects s ON cs.subject_id = s.subject_id
      WHERE cs.faculty_id = $1 AND cs.sy_id = $2
      ORDER BY s.subject_code ASC
    `, [facultyId, targetSyId]);

    // Review status
    const statusResult = await pool.query(`
      SELECT workload_id, status, revision_remarks, acknowledged_at
      FROM workload_status
      WHERE faculty_id = $1 AND sy_id = $2
      LIMIT 1
    `, [facultyId, targetSyId]);

    const fac         = facultyResult.rows[0];
    const workloadRow = statusResult.rows[0];

    const schedules = schedResult.rows.map(sch => ({
      ...sch,
      time: `${formatTime(sch.time_start)} - ${formatTime(sch.time_end)}`,
      days: sch.day_of_week,
    }));

    const totalUnits    = schedules.reduce((sum, s) => sum + parseInt(s.units, 10), 0);
    const totalSections = schedules.length;

    res.json({
      faculty: {
        ...fac,
        status:           workloadRow?.status || 'pending',
        workload_id:      workloadRow?.workload_id || null,
        revision_remarks: workloadRow?.revision_remarks || null,
      },
      schedules,
      totalUnits,
      totalSections,
      sy_id: targetSyId,
    });
  } catch (err) {
    console.error('getFacultyScheduleDetail error:', err.message);
    res.status(500).json({ message: 'Failed to fetch faculty schedule detail.' });
  }
}

// ── POST /api/workload/:facultyId/acknowledge ─────────────────
// Dean acknowledges a faculty's workload
// Also auto-sends a memo to the faculty
async function acknowledgeWorkload(req, res) {
  try {
    const { facultyId } = req.params;
    const { sy_id }     = req.body;
    const deanId        = req.user.user_id;

    let targetSyId = sy_id;
    if (!targetSyId) {
      const currentSY = await pool.query(
        `SELECT sy_id FROM school_years WHERE is_current = TRUE LIMIT 1`
      );
      targetSyId = currentSY.rows[0]?.sy_id;
    }

    // Upsert workload_status
    await pool.query(`
      INSERT INTO workload_status (faculty_id, sy_id, reviewed_by, status, acknowledged_at)
      VALUES ($1, $2, $3, 'acknowledged', NOW())
      ON CONFLICT (faculty_id, sy_id)
      DO UPDATE SET
        status          = 'acknowledged',
        reviewed_by     = $3,
        acknowledged_at = NOW(),
        updated_at      = NOW()
    `, [facultyId, targetSyId, deanId]);

    await pool.query(`
      UPDATE class_schedules
      SET workflow_status = 'Drafting', updated_at = NOW()
      WHERE faculty_id = $1 AND sy_id = $2
      AND (workflow_status IS NULL OR workflow_status = 'For Approval')
    `, [facultyId, targetSyId]);

    // Get faculty name for the memo
    const facResult = await pool.query(
      `SELECT first_name, last_name FROM users WHERE user_id = $1`, [facultyId]
    );
    const fac = facResult.rows[0];

    // Get dean name
    const deanResult = await pool.query(
      `SELECT first_name, last_name FROM users WHERE user_id = $1`, [deanId]
    );
    const dean = deanResult.rows[0];

    // Get SY label
    const syResult = await pool.query(
      `SELECT sy_label, semester FROM school_years WHERE sy_id = $1`, [targetSyId]
    );
    const sy = syResult.rows[0];

    // Auto-send official memo to faculty
    await pool.query(`
      INSERT INTO workload_memos (sent_by, recipient_id, sy_id, title, body, memo_type)
      VALUES ($1, $2, $3, $4, $5, 'success')
    `, [
      deanId,
      facultyId,
      targetSyId,
      'Workload Officially Acknowledged',
      `Your teaching load for the ${sy?.semester} Semester (AY ${sy?.sy_label}) has been reviewed and approved by ${dean?.first_name} ${dean?.last_name}. Please ensure your syllabus for each assigned subject is uploaded to the repository before the first day of classes.`,
    ]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'ACKNOWLEDGE_WORKLOAD', 'workload_status', $2, $3, $4)
    `, [deanId, facultyId, JSON.stringify({ sy_id: targetSyId, status: 'acknowledged' }), req.ip]);

    res.json({
      message: `Workload acknowledged! An official schedule memo has been sent to ${fac?.first_name}.`,
    });
  } catch (err) {
    console.error('acknowledgeWorkload error:', err.message);
    res.status(500).json({ message: 'Failed to acknowledge workload.' });
  }
}

// ── POST /api/workload/:facultyId/revision ────────────────────
// Dean requests a revision — sends memo and notifies Registrar
async function requestRevision(req, res) {
  try {
    const { facultyId }      = req.params;
    const { sy_id, remarks } = req.body;
    const deanId             = req.user.user_id;

    if (!remarks?.trim()) {
      return res.status(400).json({ message: 'Revision remarks are required.' });
    }

    let targetSyId = sy_id;
    if (!targetSyId) {
      const currentSY = await pool.query(
        `SELECT sy_id FROM school_years WHERE is_current = TRUE LIMIT 1`
      );
      targetSyId = currentSY.rows[0]?.sy_id;
    }

    // Upsert workload_status
    await pool.query(`
      INSERT INTO workload_status (faculty_id, sy_id, reviewed_by, status, revision_remarks)
      VALUES ($1, $2, $3, 'revision_requested', $4)
      ON CONFLICT (faculty_id, sy_id)
      DO UPDATE SET
        status           = 'revision_requested',
        reviewed_by      = $3,
        revision_remarks = $4,
        updated_at       = NOW()
    `, [facultyId, targetSyId, deanId, remarks.trim()]);

    await pool.query(`
      UPDATE class_schedules
      SET workflow_status = 'For Approval', updated_at = NOW()
      WHERE faculty_id = $1 AND sy_id = $2
      AND workflow_status = 'Drafting'
    `, [facultyId, targetSyId]);

    // Get dean info
    const deanResult = await pool.query(
      `SELECT first_name, last_name FROM users WHERE user_id = $1`, [deanId]
    );
    const dean = deanResult.rows[0];

    // Get faculty info
    const facResult = await pool.query(
      `SELECT first_name, last_name FROM users WHERE user_id = $1`, [facultyId]
    );
    const fac = facResult.rows[0];

    // Get SY
    const syResult = await pool.query(
      `SELECT sy_label, semester FROM school_years WHERE sy_id = $1`, [targetSyId]
    );
    const sy = syResult.rows[0];

    // Send memo to faculty about the revision
    await pool.query(`
      INSERT INTO workload_memos (sent_by, recipient_id, sy_id, title, body, memo_type)
      VALUES ($1, $2, $3, $4, $5, 'warning')
    `, [
      deanId,
      facultyId,
      targetSyId,
      'Workload Revision Requested',
      `Your teaching load for the ${sy?.semester} Semester (AY ${sy?.sy_label}) requires revision as noted by ${dean?.first_name} ${dean?.last_name}. Reason: ${remarks.trim()}`,
    ]);

    // Also notify Registrar(s) about the revision request
    const registrarResult = await pool.query(`
      SELECT u.user_id FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE r.role_name = 'admin_registrar' AND u.is_active = TRUE
    `);

    for (const registrar of registrarResult.rows) {
      await pool.query(`
        INSERT INTO workload_memos (sent_by, recipient_id, sy_id, title, body, memo_type)
        VALUES ($1, $2, $3, $4, $5, 'warning')
      `, [
        deanId,
        registrar.user_id,
        targetSyId,
        `Revision Requested — ${fac?.first_name} ${fac?.last_name}'s Workload`,
        `Dean ${dean?.first_name} ${dean?.last_name} has requested a revision to the schedule of ${fac?.first_name} ${fac?.last_name}. Reason: ${remarks.trim()}`,
      ]);
    }

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'REQUEST_REVISION', 'workload_status', $2, $3, $4)
    `, [deanId, facultyId, JSON.stringify({ sy_id: targetSyId, remarks }), req.ip]);

    res.json({ message: 'Revision requested and sent to the Registrar.' });
  } catch (err) {
    console.error('requestRevision error:', err.message);
    res.status(500).json({ message: 'Failed to request revision.' });
  }
}

// ── GET /api/workload/my ──────────────────────────────────────
// Faculty: their own schedule + workload status for current SY
async function getMyWorkload(req, res) {
  try {
    const facultyId = req.user.user_id;

    // Get current SY
    const currentSY = await pool.query(
      `SELECT sy_id, sy_label, semester FROM school_years WHERE is_current = TRUE LIMIT 1`
    );
    const sy = currentSY.rows[0];
    if (!sy) {
      return res.json({ schedules: [], status: 'pending', sy_label: '', totalUnits: 0 });
    }

    // Get schedules
    const schedResult = await pool.query(`
      SELECT
        cs.schedule_id,
        cs.room,
        cs.section,
        cs.day_of_week,
        cs.time_start,
        cs.time_end,
        s.subject_code,
        s.subject_name,
        s.units
      FROM class_schedules cs
      JOIN subjects s ON cs.subject_id = s.subject_id
      WHERE cs.faculty_id = $1 AND cs.sy_id = $2
      ORDER BY s.subject_code ASC
    `, [facultyId, sy.sy_id]);

    // Get workload status
    const statusResult = await pool.query(`
      SELECT status, revision_remarks, acknowledged_at
      FROM workload_status
      WHERE faculty_id = $1 AND sy_id = $2
      LIMIT 1
    `, [facultyId, sy.sy_id]);

    const schedules = schedResult.rows.map(sch => ({
      ...sch,
      days: sch.day_of_week,
      time: `${formatTime(sch.time_start)} - ${formatTime(sch.time_end)}`,
    }));

    const totalUnits    = schedules.reduce((sum, s) => sum + parseInt(s.units, 10), 0);
    const totalSections = schedules.length;
    const workloadRow   = statusResult.rows[0];

    res.json({
      schedules,
      totalUnits,
      totalSections,
      status:           workloadRow?.status || 'pending',
      revision_remarks: workloadRow?.revision_remarks || null,
      sy_label:         `${sy.sy_label} — ${sy.semester} Semester`,
      sy_id:            sy.sy_id,
    });
  } catch (err) {
    console.error('getMyWorkload error:', err.message);
    res.status(500).json({ message: 'Failed to fetch your workload.' });
  }
}

// ── GET /api/workload/my/memos ────────────────────────────────
// Faculty: their department memos (workload_memos)
async function getMyMemos(req, res) {
  try {
    const facultyId = req.user.user_id;

    const result = await pool.query(`
      SELECT
        wm.memo_id,
        wm.title,
        wm.body,
        wm.memo_type,
        wm.is_read,
        wm.created_at,
        u.first_name || ' ' || u.last_name AS sender_name,
        r.role_name AS sender_role
      FROM workload_memos wm
      JOIN users u ON wm.sent_by = u.user_id
      JOIN roles r ON u.role_id  = r.role_id
      WHERE wm.recipient_id = $1
      ORDER BY wm.created_at DESC
      LIMIT 20
    `, [facultyId]);

    // Mark all as read
    await pool.query(`
      UPDATE workload_memos
      SET is_read = TRUE, read_at = NOW()
      WHERE recipient_id = $1 AND is_read = FALSE
    `, [facultyId]);

    res.json({ memos: result.rows });
  } catch (err) {
    console.error('getMyMemos error:', err.message);
    res.status(500).json({ message: 'Failed to fetch memos.' });
  }
}

module.exports = {
  getSchoolYears,
  getSubjects,
  addSubject,
  deleteSubject,
  getFacultyWorkloadList,
  getFacultyScheduleDetail,
  acknowledgeWorkload,
  requestRevision,
  getMyWorkload,
  getMyMemos,
};