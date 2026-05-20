// ============================================================
//  src/controllers/gradeApprovalsController.js
//  Handles the Administrative Workflow (Dean, VPAA, Registrar)
// ============================================================

const pool = require('../config/db');
const nodemailer = require('nodemailer');

// ── CONFIGURE EMAIL TRANSPORTER ──
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

// ── EMAIL HELPER FUNCTION ──
async function releaseGradesViaEmail(scheduleId) {
  try {
    // 1. Fetch the bundled student data using the JSON aggregation query
    const result = await pool.query(`
      SELECT 
        s.student_no,
        s.first_name,
        s.last_name,
        s.email,
        subj.subject_code,
        subj.subject_name,
        COALESCE(
          json_agg(
            json_build_object(
              'task', a.title,
              'score', COALESCE(g.score, 0),
              'max_score', a.max_score
            )
          ) FILTER (WHERE a.activity_id IS NOT NULL), '[]'
        ) AS tasks,
        CASE 
          WHEN SUM(a.max_score) > 0 
          THEN ROUND((SUM(COALESCE(g.score, 0)) / SUM(a.max_score)::numeric) * 100, 2)
          ELSE 0.00
        END AS final_grade_percentage
      FROM students s
      JOIN enrollments e ON s.student_no = e.student_no
      JOIN class_schedules cs ON e.course_id = cs.schedule_id
      JOIN subjects subj ON cs.subject_id = subj.subject_id
      LEFT JOIN activities a ON cs.schedule_id = a.course_id
      LEFT JOIN grades g ON a.activity_id = g.activity_id AND g.student_no = s.student_no
      WHERE cs.schedule_id = $1
      GROUP BY 
        s.student_no, s.first_name, s.last_name, s.email, 
        subj.subject_code, subj.subject_name;
    `, [scheduleId]);

    const students = result.rows;
    if (students.length === 0) return;

    // 2. Loop through students and send the emails
    for (const student of students) {
      // Skip missing emails or dummy mock emails so we only email your test accounts!
      if (!student.email || student.email.includes('@dummy.local')) continue;

      // Build the table rows for their specific tasks
      let tasksHtml = student.tasks.map(t => `
        <tr>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px;">${t.task}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0f172a; font-size: 14px;">${t.score} / ${t.max_score}</td>
        </tr>
      `).join('');

      // Determine passing color
      const isPassing = parseFloat(student.final_grade_percentage) >= 75;
      const gradeColor = isPassing ? '#15803d' : '#ef4444';
      const gradeStatus = isPassing ? 'PASSED' : 'FAILED';

      const mailOptions = {
        from: `"PTC EduSync Registrar" <${process.env.EMAIL_USER}>`,
        to: student.email,
        subject: `[OFFICIAL] Final Grades Released: ${student.subject_code}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; padding: 40px 20px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              
              <div style="background-color: #15803d; padding: 30px 20px; text-align: center;">
                <img src="https://www.paterostechnologicalcollege.edu.ph/ASSETS/IMAGES/LOGO/logo-ptc.png" alt="PTC Logo" style="width: 80px; height: auto; margin-bottom: 15px; display: inline-block;">
                <h1 style="color: #facc15; margin: 0; font-size: 24px; letter-spacing: 1px; font-weight: bold;">PTC EduSync</h1>
                <p style="color: #ffffff; font-size: 14px; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">Official Grade Report</p>
              </div>
              
              <div style="padding: 30px;">
                <p style="color: #1f2937; font-size: 16px; line-height: 1.5; margin-top: 0;">Hello <strong>${student.first_name} ${student.last_name}</strong>,</p>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Your final grades for <strong>${student.subject_code} - ${student.subject_name}</strong> have been formally verified and released by the Office of the Registrar.</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 25px; margin-bottom: 30px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="padding: 12px 15px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #cbd5e1;">Activity</th>
                        <th style="padding: 12px 15px; text-align: center; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #cbd5e1;">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tasksHtml}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style="padding: 20px 15px; font-weight: bold; text-align: right; color: #475569; font-size: 14px;">Final Term Percentage:</td>
                        <td style="padding: 20px 15px; font-weight: 900; font-size: 20px; text-align: center; color: ${gradeColor};">
                          ${student.final_grade_percentage}%
                        </td>
                      </tr>
                      <tr style="background-color: ${isPassing ? '#f0fdf4' : '#fef2f2'}; border-top: 1px solid #e2e8f0;">
                        <td style="padding: 15px; font-weight: bold; text-align: right; color: #475569; font-size: 14px;">Status:</td>
                        <td style="padding: 15px; font-weight: 900; font-size: 16px; text-align: center; color: ${gradeColor}; letter-spacing: 1px;">
                          ${gradeStatus}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} Pateros Technological College. All rights reserved.<br>
                  This is an automated system message. Please do not reply directly to this email.
                </p>
              </div>

            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    }
  } catch (err) {
    console.error('Error in releaseGradesViaEmail:', err);
    // We log the error but don't throw it, so the Registrar's approval still saves even if the email fails.
  }
}

// ── 1. GET ALL SUBMITTED GRADES ──
async function getSubmissions(req, res) {
  try {
    // Fetch all schedules that are NO LONGER in workload phase OR grade drafting phase
    const result = await pool.query(`
      SELECT 
        cs.schedule_id AS submission_id,
        s.subject_code AS course_code,
        s.subject_name AS course_title,
        cs.section,
        sy.semester,
        sy.sy_label AS sy,
        u.first_name || ' ' || u.last_name AS faculty_name,
        cs.workflow_status AS status,
        cs.updated_at AS submitted_date,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = cs.schedule_id) AS students_count
      FROM class_schedules cs
      JOIN subjects s ON cs.subject_id = s.subject_id
      JOIN school_years sy ON cs.sy_id = sy.sy_id
      JOIN users u ON cs.faculty_id = u.user_id
      WHERE cs.workflow_status NOT IN ('Drafting', 'For Approval')
      ORDER BY cs.updated_at DESC
    `);
    
    res.json({ submissions: result.rows });
  } catch (err) {
    console.error('getSubmissions error:', err.message);
    res.status(500).json({ message: 'Failed to fetch submissions.' });
  }
}

// ── 2. GET SPECIFIC GRADEBOOK FOR REVIEW ──
async function getSubmissionDetails(req, res) {
  try {
    const { submissionId } = req.params;

    const students = await pool.query(
      `SELECT s.student_no, s.first_name, s.last_name, s.middle_name 
       FROM students s
       JOIN enrollments e ON s.student_no = e.student_no
       WHERE e.course_id = $1
       ORDER BY s.last_name ASC`,
      [submissionId]
    );

    const activities = await pool.query(
      `SELECT activity_id, title, max_score FROM activities WHERE course_id = $1 ORDER BY activity_date ASC`,
      [submissionId]
    );

    const gradesQuery = await pool.query(
      `SELECT g.activity_id, g.student_no, g.score 
       FROM grades g
       JOIN activities a ON g.activity_id = a.activity_id
       WHERE a.course_id = $1`,
      [submissionId]
    );

    const studentGradesMap = {};
    students.rows.forEach(st => {
      studentGradesMap[st.student_no] = {};
    });
    
    gradesQuery.rows.forEach(g => {
      if (studentGradesMap[g.student_no]) {
        studentGradesMap[g.student_no][g.activity_id] = parseFloat(g.score);
      }
    });

    const formattedStudents = students.rows.map(st => ({
      ...st,
      grades: studentGradesMap[st.student_no] 
    }));

    res.json({
      activities: activities.rows,
      students: formattedStudents
    });
  } catch (err) {
    console.error('getSubmissionDetails error:', err.message);
    res.status(500).json({ message: 'Failed to fetch submission details.' });
  }
}

// ── 3. APPROVE GRADES (Advance Workflow) ──
async function approveSubmission(req, res) {
  try {
    const { submissionId } = req.params;
    
    // Fetch the current status from the DB to be safe
    const statusQuery = await pool.query(`SELECT workflow_status FROM class_schedules WHERE schedule_id = $1`, [submissionId]);
    if (statusQuery.rows.length === 0) return res.status(404).json({ message: 'Schedule not found' });
    
    const currentStatus = statusQuery.rows[0].workflow_status;
    
    // Determine the next step in the chain
    let nextStatus = 'Grade Released'; // Default end of the line
    if (currentStatus === 'Pending Dean') nextStatus = 'Pending VPAA';
    else if (currentStatus === 'Pending VPAA') nextStatus = 'Pending Registrar';
    else if (currentStatus === 'Pending Registrar') nextStatus = 'Grade Released';

    await pool.query(
      `UPDATE class_schedules SET workflow_status = $1, updated_at = NOW() WHERE schedule_id = $2`,
      [nextStatus, submissionId]
    );

    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, ip_address)
      VALUES ($1, 'APPROVE_GRADES', 'class_schedules', $2, $3)
    `, [req.user.user_id, submissionId, req.ip]);

    // 🌟 THE TRIGGER: If the status hit 'Grade Released' (Registrar approved it), send the emails!
    if (nextStatus === 'Grade Released') {
      releaseGradesViaEmail(submissionId); // We deliberately don't 'await' so the Registrar's UI responds instantly
    }

    res.json({ message: 'Grades successfully approved.', newStatus: nextStatus });
  } catch (err) {
    console.error('approveSubmission error:', err.message);
    res.status(500).json({ message: 'Failed to approve submission.' });
  }
}

// ── 4. RETURN GRADES TO FACULTY ──
async function returnSubmission(req, res) {
  try {
    const { submissionId } = req.params;
    const { remarks } = req.body;

    await pool.query(
      `UPDATE class_schedules SET workflow_status = 'Returned', updated_at = NOW() WHERE schedule_id = $1`,
      [submissionId]
    );

    await pool.query(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, new_values, ip_address)
      VALUES ($1, 'RETURN_GRADES', 'class_schedules', $2, $3, $4)
    `, [req.user.user_id, submissionId, JSON.stringify({ remarks }), req.ip]);

    res.json({ message: 'Grades returned to faculty for revision.' });
  } catch (err) {
    console.error('returnSubmission error:', err.message);
    res.status(500).json({ message: 'Failed to return submission.' });
  }
}

module.exports = {
  getSubmissions,
  getSubmissionDetails,
  approveSubmission,
  returnSubmission
};