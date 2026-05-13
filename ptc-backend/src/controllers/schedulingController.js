// ============================================================
//  src/controllers/schedulingController.js
//  Handles Course Scheduling — Registrar creates/edits/deletes
//  class sections and assigns faculty
// ============================================================

const pool = require('../config/db');

// ── GET /api/scheduling/school-years ─────────────────────────
// Returns all school years for the filter dropdown
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

// ── GET /api/scheduling/subjects ─────────────────────────────
// Returns all subjects for the dropdown
async function getSubjects(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        s.subject_id,
        s.subject_code,
        s.subject_name,
        s.units,
        d.dept_code,
        d.dept_name
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

// ── GET /api/scheduling/faculty ──────────────────────────────
// Returns all active faculty + admins for the assignment dropdown
async function getFacultyList(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.first_name || ' ' || u.last_name AS full_name,
        d.dept_code,
        d.dept_name,
        r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.is_active = TRUE
        AND r.role_name IN ('faculty', 'admin_dean', 'admin_vpaa', 'admin_registrar')
      ORDER BY u.last_name ASC, u.first_name ASC
    `);
    res.json({ faculty: result.rows });
  } catch (err) {
    console.error('getFacultyList error:', err.message);
    res.status(500).json({ message: 'Failed to fetch faculty list.' });
  }
}

// ── GET /api/scheduling ───────────────────────────────────────
// Returns all schedules, optionally filtered by sy_id
// Query params: sy_id, search
async function getSchedules(req, res) {
  try {
    const { sy_id, search = '' } = req.query;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (sy_id) {
      conditions.push(`cs.sy_id = $${idx}`);
      params.push(parseInt(sy_id));
      idx++;
    }

    if (search.trim()) {
      conditions.push(`(
        LOWER(s.subject_code) LIKE $${idx}
        OR LOWER(s.subject_name) LIKE $${idx}
        OR LOWER(cs.section) LIKE $${idx}
        OR LOWER(u.first_name || ' ' || u.last_name) LIKE $${idx}
      )`);
      params.push(`%${search.toLowerCase().trim()}%`);
      idx++;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(`
      SELECT
        cs.schedule_id,
        cs.sy_id,
        cs.subject_id,
        cs.faculty_id,
        cs.room,
        cs.section,
        cs.day_of_week,
        cs.time_start,
        cs.time_end,
        cs.created_at,
        cs.updated_at,
        s.subject_code,
        s.subject_name,
        s.units,
        sy.sy_label,
        sy.semester,
        u.first_name   AS faculty_first_name,
        u.last_name    AS faculty_last_name,
        d.dept_code    AS faculty_dept_code,
        d.dept_name    AS faculty_dept_name
      FROM class_schedules cs
      JOIN subjects s      ON cs.subject_id  = s.subject_id
      JOIN school_years sy ON cs.sy_id       = sy.sy_id
      LEFT JOIN users u    ON cs.faculty_id  = u.user_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      ${whereClause}
      ORDER BY s.subject_code ASC, cs.section ASC
    `, params);

    // Format for frontend — matching the shape the JSX expects
    const schedules = result.rows.map(row => ({
      schedule_id:   row.schedule_id,
      sy_id:         row.sy_id,
      subject_id:    row.subject_id,
      faculty_id:    row.faculty_id,
      room:          row.room,
      section:       row.section,
      days:          row.day_of_week,
      time_start:    row.time_start ? row.time_start.substring(0, 5) : '',
      time_end:      row.time_end   ? row.time_end.substring(0, 5)   : '',
      created_at:    row.created_at,
      updated_at:    row.updated_at,
      // Joined subject info
      subject_code:  row.subject_code,
      subject_name:  row.subject_name,
      units:         row.units,
      sy_label:      row.sy_label,
      semester:      row.semester,
      // Joined faculty info
      faculty_name:  row.faculty_first_name
        ? `${row.faculty_first_name} ${row.faculty_last_name}`
        : null,
      faculty_dept:  row.faculty_dept_code || null,
    }));

    // Count unassigned for the current sy_id filter
    const unassignedCount = schedules.filter(s => !s.faculty_id).length;

    res.json({ schedules, total: schedules.length, unassignedCount });
  } catch (err) {
    console.error('getSchedules error:', err.message);
    res.status(500).json({ message: 'Failed to fetch schedules.' });
  }
}

// ── POST /api/scheduling ──────────────────────────────────────
// Create a new class schedule/section
// Body: { sy_id, subject_id, section, room, days, time_start, time_end, faculty_id? }
async function createSchedule(req, res) {
  try {
    const {
      sy_id, subject_id, section, room,
      days, time_start, time_end, faculty_id
    } = req.body;

    // Validate required fields
    if (!sy_id || !subject_id || !section || !room || !days || !time_start || !time_end) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Check for schedule conflict (same faculty, same day/time, same SY)
    if (faculty_id) {
      const conflict = await pool.query(`
        SELECT 1 FROM class_schedules
        WHERE faculty_id  = $1
          AND sy_id       = $2
          AND day_of_week = $3
          AND NOT (time_end <= $4 OR time_start >= $5)
        LIMIT 1
      `, [faculty_id, sy_id, days, time_start, time_end]);

      if (conflict.rowCount > 0) {
        return res.status(409).json({
          message: 'Schedule conflict detected: this faculty already has a class at that day and time.'
        });
      }
    }

    const result = await pool.query(`
      INSERT INTO class_schedules
        (sy_id, subject_id, faculty_id, room, section, day_of_week, time_start, time_end, assigned_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING schedule_id, sy_id, subject_id, faculty_id, room, section,
                day_of_week, time_start, time_end, created_at
    `, [
      parseInt(sy_id),
      parseInt(subject_id),
      faculty_id || null,
      room,
      section,
      days,
      time_start,
      time_end,
      req.user.user_id,
    ]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'CREATE_SCHEDULE', 'class_schedules', $2, $3, $4)
    `, [
      req.user.user_id,
      result.rows[0].schedule_id.toString(),
      JSON.stringify({ section, subject_id, faculty_id }),
      req.ip,
    ]);

    res.status(201).json({
      message: 'Schedule created successfully.',
      schedule: result.rows[0],
    });
  } catch (err) {
    console.error('createSchedule error:', err.message);
    res.status(500).json({ message: 'Failed to create schedule.' });
  }
}

// ── PUT /api/scheduling/:id ───────────────────────────────────
// Update an existing class schedule
// Body: { sy_id, subject_id, section, room, days, time_start, time_end, faculty_id? }
async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const {
      sy_id, subject_id, section, room,
      days, time_start, time_end, faculty_id
    } = req.body;

    // Check schedule exists
    const existing = await pool.query(
      `SELECT * FROM class_schedules WHERE schedule_id = $1`, [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    // Check for conflict (exclude self)
    if (faculty_id) {
      const conflict = await pool.query(`
        SELECT 1 FROM class_schedules
        WHERE faculty_id   = $1
          AND sy_id        = $2
          AND day_of_week  = $3
          AND schedule_id != $4
          AND NOT (time_end <= $5 OR time_start >= $6)
        LIMIT 1
      `, [faculty_id, sy_id, days, id, time_start, time_end]);

      if (conflict.rowCount > 0) {
        return res.status(409).json({
          message: 'Schedule conflict detected: this faculty already has a class at that day and time.'
        });
      }
    }

    await pool.query(`
      UPDATE class_schedules SET
        sy_id       = $1,
        subject_id  = $2,
        faculty_id  = $3,
        room        = $4,
        section     = $5,
        day_of_week = $6,
        time_start  = $7,
        time_end    = $8,
        assigned_by = $9,
        updated_at  = NOW()
      WHERE schedule_id = $10
    `, [
      parseInt(sy_id),
      parseInt(subject_id),
      faculty_id || null,
      room,
      section,
      days,
      time_start,
      time_end,
      req.user.user_id,
      id,
    ]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'UPDATE_SCHEDULE', 'class_schedules', $2, $3, $4)
    `, [
      req.user.user_id,
      id,
      JSON.stringify({ section, subject_id, faculty_id }),
      req.ip,
    ]);

    res.json({ message: 'Schedule updated successfully.' });
  } catch (err) {
    console.error('updateSchedule error:', err.message);
    res.status(500).json({ message: 'Failed to update schedule.' });
  }
}

// ── DELETE /api/scheduling/:id ────────────────────────────────
// Permanently delete a class schedule
async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      `SELECT schedule_id, section, subject_id FROM class_schedules WHERE schedule_id = $1`, [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    await pool.query(`DELETE FROM class_schedules WHERE schedule_id = $1`, [id]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, old_values, ip_address)
      VALUES ($1, 'DELETE_SCHEDULE', 'class_schedules', $2, $3, $4)
    `, [
      req.user.user_id,
      id,
      JSON.stringify(existing.rows[0]),
      req.ip,
    ]);

    res.json({ message: 'Schedule deleted successfully.' });
  } catch (err) {
    console.error('deleteSchedule error:', err.message);
    res.status(500).json({ message: 'Failed to delete schedule.' });
  }
}

module.exports = {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchoolYears,
  getSubjects,
  getFacultyList,
};