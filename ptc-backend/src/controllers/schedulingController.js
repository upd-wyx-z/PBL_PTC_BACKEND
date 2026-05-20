// ============================================================
//  src/controllers/schedulingController.js
//  Handles Course Scheduling — Registrar creates/edits/deletes
//  class sections and assigns faculty
// ============================================================

const pool = require('../config/db');

// ── GET /api/scheduling/school-years ─────────────────────────
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
        AND r.role_name = 'faculty'
      ORDER BY u.last_name ASC, u.first_name ASC
    `);
    res.json({ faculty: result.rows });
  } catch (err) {
    console.error('getFacultyList error:', err.message);
    res.status(500).json({ message: 'Failed to fetch faculty list.' });
  }
}

// ── GET /api/scheduling/sections ──────────────────────────────
async function getStudentSections(req, res) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT section 
      FROM students 
      WHERE is_active = TRUE AND section IS NOT NULL
      ORDER BY section ASC
    `);
    res.json({ sections: result.rows.map(r => r.section) });
  } catch (err) {
    console.error('getStudentSections error:', err.message);
    res.status(500).json({ message: 'Failed to fetch sections.' });
  }
}

// ── GET /api/scheduling ───────────────────────────────────────
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

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

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
      subject_code:  row.subject_code,
      subject_name:  row.subject_name,
      units:         row.units,
      sy_label:      row.sy_label,
      semester:      row.semester,
      faculty_name:  row.faculty_first_name ? `${row.faculty_first_name} ${row.faculty_last_name}` : null,
      faculty_dept:  row.faculty_dept_code || null,
    }));

    const unassignedCount = schedules.filter(s => !s.faculty_id).length;

    res.json({ schedules, total: schedules.length, unassignedCount });
  } catch (err) {
    console.error('getSchedules error:', err.message);
    res.status(500).json({ message: 'Failed to fetch schedules.' });
  }
}

// ── POST /api/scheduling ──────────────────────────────────────
async function createSchedule(req, res) {
  try {
    const { sy_id, subject_id, section, room, days, time_start, time_end, faculty_id } = req.body;

    if (!sy_id || !subject_id || !section || !room || !days || !time_start || !time_end) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    if (faculty_id) {
      const conflict = await pool.query(`
        SELECT 1 FROM class_schedules
        WHERE faculty_id  = $1 AND sy_id = $2 AND day_of_week = $3
          AND NOT (time_end <= $4 OR time_start >= $5) LIMIT 1
      `, [faculty_id, sy_id, days, time_start, time_end]);

      if (conflict.rowCount > 0) {
        return res.status(409).json({ message: 'Schedule conflict detected: this faculty already has a class at that day and time.' });
      }
    }

    const result = await pool.query(`
    INSERT INTO class_schedules 
      (sy_id, subject_id, faculty_id, room, section, day_of_week, time_start, time_end, assigned_by, workflow_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'For Approval')
      RETURNING schedule_id, sy_id, subject_id, faculty_id, room, section, day_of_week, time_start, time_end, created_at
    `, [parseInt(sy_id), parseInt(subject_id), faculty_id || null, room, section, days, time_start, time_end, req.user.user_id]);

    const newScheduleId = result.rows[0].schedule_id;

    // Auto-enroll the students
    await pool.query(`
      INSERT INTO enrollments (course_id, student_no)
      SELECT $1, student_no FROM students WHERE section = $2
      ON CONFLICT DO NOTHING
    `, [newScheduleId, section]);

    // INVALIDATE DEAN'S APPROVAL (Set to pending)
    if (faculty_id) {
      await pool.query(`
        UPDATE workload_status SET status = 'pending', updated_at = NOW()
        WHERE faculty_id = $1 AND sy_id = $2
      `, [faculty_id, sy_id]);
    }

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'CREATE_SCHEDULE', 'class_schedules', $2, $3, $4)
    `, [req.user.user_id, newScheduleId.toString(), JSON.stringify({ section, subject_id, faculty_id }), req.ip]);

    res.status(201).json({ message: `Schedule created and ${section} students auto-enrolled.`, schedule: result.rows[0] });
  } catch (err) {
    console.error('createSchedule error:', err.message);
    res.status(500).json({ message: 'Failed to create schedule.' });
  }
}

// ── PUT /api/scheduling/:id ───────────────────────────────────
async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const { sy_id, subject_id, section, room, days, time_start, time_end, faculty_id } = req.body;

    const existing = await pool.query(`SELECT * FROM class_schedules WHERE schedule_id = $1`, [id]);
    if (!existing.rowCount) return res.status(404).json({ message: 'Schedule not found.' });

    const old_faculty_id = existing.rows[0].faculty_id;
    const old_sy_id = existing.rows[0].sy_id;

    if (faculty_id) {
      const conflict = await pool.query(`
        SELECT 1 FROM class_schedules
        WHERE faculty_id = $1 AND sy_id = $2 AND day_of_week = $3 AND schedule_id != $4
          AND NOT (time_end <= $5 OR time_start >= $6) LIMIT 1
      `, [faculty_id, sy_id, days, id, time_start, time_end]);

      if (conflict.rowCount > 0) return res.status(409).json({ message: 'Schedule conflict detected.' });
    }

    await pool.query(`
      UPDATE class_schedules SET
        sy_id = $1, subject_id = $2, faculty_id = $3, room = $4, section = $5,
        day_of_week = $6, time_start = $7, time_end = $8, assigned_by = $9, updated_at = NOW()
      WHERE schedule_id = $10
    `, [parseInt(sy_id), parseInt(subject_id), faculty_id || null, room, section, days, time_start, time_end, req.user.user_id, id]);

    // INVALIDATE DEAN'S APPROVAL (Set new faculty to pending)
    if (faculty_id) {
      await pool.query(`
        UPDATE workload_status SET status = 'pending', updated_at = NOW()
        WHERE faculty_id = $1 AND sy_id = $2
      `, [faculty_id, sy_id]);
    }
    // INVALIDATE DEAN'S APPROVAL (Set old faculty to pending if it changed)
    if (old_faculty_id && (old_faculty_id !== faculty_id || old_sy_id !== sy_id)) {
      await pool.query(`
        UPDATE workload_status SET status = 'pending', updated_at = NOW()
        WHERE faculty_id = $1 AND sy_id = $2
      `, [old_faculty_id, old_sy_id]);
    }

    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'UPDATE_SCHEDULE', 'class_schedules', $2, $3, $4)
    `, [req.user.user_id, id, JSON.stringify({ section, subject_id, faculty_id }), req.ip]);

    res.json({ message: 'Schedule updated successfully.' });
  } catch (err) {
    console.error('updateSchedule error:', err.message);
    res.status(500).json({ message: 'Failed to update schedule.' });
  }
}

// ── DELETE /api/scheduling/:id ────────────────────────────────
async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;

    // We must grab faculty_id and sy_id to know who to reset
    const existing = await pool.query(`
      SELECT schedule_id, section, subject_id, faculty_id, sy_id 
      FROM class_schedules WHERE schedule_id = $1
    `, [id]);
    
    if (!existing.rowCount) return res.status(404).json({ message: 'Schedule not found.' });

    const old_faculty_id = existing.rows[0].faculty_id;
    const old_sy_id = existing.rows[0].sy_id;

    await pool.query(`DELETE FROM class_schedules WHERE schedule_id = $1`, [id]);

    // INVALIDATE DEAN'S APPROVAL (Set affected faculty to pending)
    if (old_faculty_id) {
      await pool.query(`
        UPDATE workload_status SET status = 'pending', updated_at = NOW()
        WHERE faculty_id = $1 AND sy_id = $2
      `, [old_faculty_id, old_sy_id]);
    }

    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, old_values, ip_address)
      VALUES ($1, 'DELETE_SCHEDULE', 'class_schedules', $2, $3, $4)
    `, [req.user.user_id, id, JSON.stringify(existing.rows[0]), req.ip]);

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
  getStudentSections
};