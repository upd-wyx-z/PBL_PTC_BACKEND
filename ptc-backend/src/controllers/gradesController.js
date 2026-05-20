// ============================================================
//  src/controllers/gradesController.js
//  Unified Architecture: Pulls from class_schedules and subjects
// ============================================================
const pool = require('../config/db');

// ── 1. GET ALL COURSES FOR LOGGED-IN FACULTY (FIXED FILTER) ──
async function getFacultyCourses(req, res) {
  try {
    const facultyId = req.user.user_id;

    // Faculty should see schedules that are in the grading phase:
    // 'Drafting', 'Pending Dean', 'Returned', 'Approved', etc.
    // They should NOT see schedules that are still 'For Approval' in workload.
    const result = await pool.query(`
      SELECT 
        cs.schedule_id AS course_id, 
        s.subject_code AS course_code, 
        s.subject_name AS course_title, 
        cs.section, 
        sy.semester,
        'College' AS year_level,
        COALESCE(cs.workflow_status, 'Drafting') AS workflow_status 
      FROM class_schedules cs
      JOIN subjects s ON cs.subject_id = s.subject_id
      JOIN school_years sy ON cs.sy_id = sy.sy_id
      WHERE cs.faculty_id = $1
      AND (cs.workflow_status IS NULL OR cs.workflow_status != 'For Approval')
      ORDER BY s.subject_code ASC
    `, [facultyId]);

    res.json({ courses: result.rows });
  } catch (err) {
    console.error('getFacultyCourses error:', err.message);
    res.status(500).json({ message: 'Failed to fetch courses.' });
  }
}

// ── 2. GET GRADEBOOK DATA (Students, Activities, Grades, Remarks) ──
async function getCourseGradebook(req, res) {
  try {
    const { courseId } = req.params;

    const students = await pool.query(
      `SELECT s.* FROM students s
       JOIN enrollments e ON s.student_no = e.student_no
       WHERE e.course_id = $1
       ORDER BY s.last_name ASC`,
      [courseId]
    );

    const activities = await pool.query(
      `SELECT * FROM activities WHERE course_id = $1 ORDER BY activity_date ASC`,
      [courseId]
    );

    const gradesQuery = await pool.query(
      `SELECT g.activity_id, g.student_no, g.score 
       FROM grades g
       JOIN activities a ON g.activity_id = a.activity_id
       WHERE a.course_id = $1`,
      [courseId]
    );

    const gradesMap = {};
    gradesQuery.rows.forEach(g => {
      if (!gradesMap[g.activity_id]) gradesMap[g.activity_id] = {};
      gradesMap[g.activity_id][g.student_no] = g.score;
    });

    // FETCH THE DEAN'S REJECTION REMARKS FROM THE AUDIT LOG
    const remarksQuery = await pool.query(`
    SELECT new_values->>'remarks' AS remarks
    FROM audit_logs
    WHERE target_table = 'class_schedules' AND target_id = $1 AND action = 'RETURN_GRADES'
    ORDER BY created_at DESC LIMIT 1
    `, [courseId]);

    const returnRemarks = remarksQuery.rows[0]?.remarks || null;

    res.json({
    students: students.rows,
    activities: activities.rows,
    grades: gradesMap,
    return_remarks: returnRemarks // Make sure this is in the response!
    });
  } catch (err) {
    console.error('getCourseGradebook error:', err.message);
    res.status(500).json({ message: 'Failed to fetch gradebook.' });
  }
}

// ── 3. ADD OR UPDATE ACTIVITY ──
async function saveActivity(req, res) {
  try {
    const { activity_id, course_id, title, type, period, max_score, date } = req.body;

    if (activity_id) {
      await pool.query(
        `UPDATE activities 
         SET title=$1, activity_type=$2, period=$3, max_score=$4, activity_date=$5 
         WHERE activity_id=$6`,
        [title, type, period, max_score, date, activity_id]
      );
      res.json({ message: 'Activity updated successfully.' });
    } else {
      const insert = await pool.query(
        `INSERT INTO activities (course_id, title, activity_type, period, max_score, activity_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [course_id, title, type, period, max_score, date]
      );
      res.status(201).json({ message: 'Activity created.', activity: insert.rows[0] });
    }
  } catch (err) {
    console.error('saveActivity error:', err.message);
    res.status(500).json({ message: 'Failed to save activity.' });
  }
}

// ── 4. UPSERT GRADES (Save as they type) ──
async function saveGrades(req, res) {
  try {
    const { gradeUpdates } = req.body; 
    for (let update of gradeUpdates) {
      if (update.score === '' || update.score === null) {
        await pool.query(`DELETE FROM grades WHERE activity_id=$1 AND student_no=$2`, [update.activity_id, update.student_no]);
      } else {
        await pool.query(
          `INSERT INTO grades (activity_id, student_no, score) 
           VALUES ($1, $2, $3)
           ON CONFLICT (activity_id, student_no) 
           DO UPDATE SET score = EXCLUDED.score`,
          [update.activity_id, update.student_no, update.score]
        );
      }
    }
    res.json({ message: 'Grades saved successfully.' });
  } catch (err) {
    console.error('saveGrades error:', err.message);
    res.status(500).json({ message: 'Failed to save grades.' });
  }
}

// ── 5. SUBMIT TO DEAN (THE RUBRIC WORKFLOW) ──
async function submitTermGrades(req, res) {
  try {
    const { courseId } = req.params; // This is the schedule_id
    const facultyId = req.user.user_id;

    // Change status in Kennidy's class_schedules table
    await pool.query(
      `UPDATE class_schedules SET workflow_status = 'Pending Dean' WHERE schedule_id = $1`,
      [courseId]
    );

    // Audit Log for the Rubric
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, ip_address)
      VALUES ($1, 'SUBMIT_GRADES_TO_DEAN', 'class_schedules', $2, $3)
    `, [facultyId, courseId, req.ip]);

    res.json({ message: 'Grades successfully submitted to the Dean for approval.' });
  } catch (err) {
    console.error('submitTermGrades error:', err.message);
    res.status(500).json({ message: 'Failed to submit grades.' });
  }
}

module.exports = {
  getFacultyCourses,
  getCourseGradebook,
  saveActivity,
  saveGrades,
  submitTermGrades
};