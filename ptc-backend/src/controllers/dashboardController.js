// ============================================================
//  src/controllers/dashboardController.js
//  Handles the Dashboard data for all roles.
//
//  Dashboard.jsx receives all data as props from App.jsx:
//    - user        → from session (already handled by auth)
//    - tasks       → logged-in user's pending tasks (max 3 shown)
//    - eventsList  → logged-in user's calendar events
//    - announcements → all announcements (pinned first)
//
//  This single endpoint returns everything the Dashboard needs
//  in one request so App.jsx can populate all props at once.
//
//  Tables used:
//    tasks, calendar_events, announcements,
//    users, departments, grade_sheets
// ============================================================

const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
//  GET /api/dashboard
//  Returns all data needed by Dashboard.jsx in one call:
//    - tasks        (logged-in user's pending tasks)
//    - eventsList   (logged-in user's calendar events)
//    - announcements (all, pinned first)
//    - summary      (role-specific quick stats)
// ─────────────────────────────────────────────────────────────
async function getDashboardData(req, res) {
  try {
    const user_id   = req.user.user_id;
    const role_name = req.user.role_name;

    // ── 1. Tasks — logged-in user's tasks, pending first, max shown is 3
    //    Matches: tasks.filter(t => t.status !== 'completed').slice(0, 3)
    const tasksResult = await pool.query(`
      SELECT
        task_id,
        title,
        task_type   AS type,
        description,
        priority,
        status,
        due_date,
        created_at,
        updated_at
      FROM tasks
      WHERE user_id = $1
      ORDER BY
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        CASE WHEN priority = 'high'  THEN 0 ELSE 1 END,
        due_date ASC
    `, [user_id]);

    // ── 2. Calendar Events — logged-in user's events
    //    Matches: eventsList prop used by Dashboard calendar grid
    const eventsResult = await pool.query(`
      SELECT
        event_id,
        title,
        event_type,
        location,
        start_datetime,
        end_datetime,
        is_all_day,
        color,
        created_at,
        updated_at
      FROM calendar_events
      WHERE user_id = $1
      ORDER BY start_datetime ASC
    `, [user_id]);

    // ── 3. Announcements — all announcements, pinned first
    //    Matches: announcements prop used by Dashboard side panel
    const announcementsResult = await pool.query(`
      SELECT
        a.announcement_id,
        a.title,
        a.body,
        a.type,
        a.is_pinned,
        a.published_at,
        u.first_name || ' ' || u.last_name AS posted_by,
        COALESCE(d.dept_name, 'All Departments') AS dept_name
      FROM announcements a
      LEFT JOIN users       u ON a.posted_by     = u.user_id
      LEFT JOIN departments d ON a.department_id  = d.department_id
      ORDER BY a.is_pinned DESC, a.published_at DESC
    `);

    // ── 4. Role-specific summary stats
    //    Shown as quick-info cards depending on who is logged in
    let summary = {};

    if (role_name === 'faculty') {
      // Faculty: pending grade sheets + overdue tasks
      const gradeStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft')     AS draft_count,
          COUNT(*) FILTER (WHERE status = 'submitted') AS submitted_count,
          COUNT(*) FILTER (WHERE status = 'returned')  AS returned_count,
          COUNT(*) FILTER (WHERE status = 'approved')  AS approved_count
        FROM grade_sheets
        WHERE faculty_id = $1
      `, [user_id]);

      const overdueCount = await pool.query(`
        SELECT COUNT(*) AS overdue_count
        FROM tasks
        WHERE user_id = $1
          AND status  = 'pending'
          AND due_date < NOW()
      `, [user_id]);

      summary = {
        ...gradeStats.rows[0],
        overdue_tasks: parseInt(overdueCount.rows[0].overdue_count),
      };

    } else if (['admin_dean', 'admin_vpaa', 'admin_registrar'].includes(role_name)) {
      // Admin: pending approvals at their step
      const pendingStatusMap = {
        admin_dean:       'pending_dean',
        admin_vpaa:       'pending_vpaa',
        admin_registrar:  'pending_registrar',
      };
      const myPendingStatus = pendingStatusMap[role_name];

      const approvalStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = $1) AS my_pending_count,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
          COUNT(*) FILTER (WHERE status = 'returned') AS returned_count
        FROM grade_sheets
      `, [myPendingStatus]);

      summary = approvalStats.rows[0];

    } else if (role_name === 'system_admin') {
      // System Admin: total users, active sessions
      const userStats = await pool.query(`
        SELECT
          COUNT(*)                                   AS total_users,
          COUNT(*) FILTER (WHERE is_active = TRUE)   AS active_users,
          COUNT(*) FILTER (WHERE is_active = FALSE)  AS inactive_users
        FROM users
      `);

      const sessionStats = await pool.query(`
        SELECT COUNT(DISTINCT user_id) AS online_count
        FROM user_sessions
        WHERE is_active  = TRUE
          AND expires_at > NOW()
      `);

      summary = {
        ...userStats.rows[0],
        online_count: parseInt(sessionStats.rows[0].online_count),
      };
    }

    // ── Return everything in one response
    res.json({
      tasks:         tasksResult.rows,
      eventsList:    eventsResult.rows,
      announcements: announcementsResult.rows,
      summary,
    });

  } catch (err) {
    console.error('getDashboardData error:', err.message);
    res.status(500).json({ message: 'Failed to load dashboard data.' });
  }
}

module.exports = { getDashboardData };
