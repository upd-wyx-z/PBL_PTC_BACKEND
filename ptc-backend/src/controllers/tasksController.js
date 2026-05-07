// ============================================================
//  src/controllers/tasksController.js - FIXED VERSION
//  Corrected column names to match PTC_DB exactly:
//
//  tasks:           task_id(SERIAL), assigned_to, assigned_by,
//                   title, description, priority, status, due_date
//  calendar_events: event_id(SERIAL), created_by, title,
//                   event_type, start_datetime, end_datetime,
//                   is_all_day, location, color_tag
//  announcements:   announcement_id(SERIAL), posted_by,
//                   department_id, title, body, is_pinned, is_active
// ============================================================

const pool = require('../config/db');
const { writeAuditLog } = require('../utils/auditLog');

// ── TASKS ────────────────────────────────────────────────────

async function getTasks(req, res) {
  try {
    const user_id = req.user.user_id;
    const result = await pool.query(`
      SELECT task_id, title, description, priority, status,
             due_date, completed_at, created_at, updated_at
      FROM tasks
      WHERE assigned_to = $1
      ORDER BY
        CASE WHEN priority = 'high' THEN 1 ELSE 2 END,
        due_date ASC NULLS LAST
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('getTasks error:', err.message);
    res.status(500).json({ message: 'Failed to fetch tasks.' });
  }
}

async function createTask(req, res) {
  try {
    const user_id = req.user.user_id;
    const { title, description = '', priority = 'normal', status = 'pending', due_date = null } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });

    const result = await pool.query(`
      INSERT INTO tasks (assigned_to, assigned_by, title, description, priority, status, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING task_id, title, description, priority, status, due_date, created_at, updated_at
    `, [user_id, user_id, title, description, priority, status, due_date]);

    await writeAuditLog({ user_id, action: 'CREATE_TASK', target_table: 'tasks', target_id: String(result.rows[0].task_id), ip_address: req.ip });
    res.status(201).json({ message: 'Task created.', task: result.rows[0] });
  } catch (err) {
    console.error('createTask error:', err.message);
    res.status(500).json({ message: 'Failed to create task.' });
  }
}

async function updateTask(req, res) {
  try {
    const user_id = req.user.user_id;
    const { task_id } = req.params;
    const { title, description = '', priority, status, due_date = null } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });

    const result = await pool.query(`
      UPDATE tasks SET title=$1, description=$2, priority=$3, status=$4, due_date=$5, updated_at=NOW()
      WHERE task_id=$6 AND assigned_to=$7
      RETURNING task_id, title, description, priority, status, due_date, created_at, updated_at
    `, [title, description, priority, status, due_date, task_id, user_id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Task not found.' });
    res.json({ message: 'Task updated.', task: result.rows[0] });
  } catch (err) {
    console.error('updateTask error:', err.message);
    res.status(500).json({ message: 'Failed to update task.' });
  }
}

async function toggleTaskStatus(req, res) {
  try {
    const user_id = req.user.user_id;
    const { task_id } = req.params;

    const current = await pool.query(
      `SELECT task_id, status FROM tasks WHERE task_id=$1 AND assigned_to=$2`,
      [task_id, user_id]
    );
    if (current.rows.length === 0) return res.status(404).json({ message: 'Task not found.' });

    const newStatus = current.rows[0].status === 'pending' ? 'completed' : 'pending';
    const result = await pool.query(`
      UPDATE tasks SET status=$1, completed_at=${newStatus === 'completed' ? 'NOW()' : 'NULL'}, updated_at=NOW()
      WHERE task_id=$2 AND assigned_to=$3
      RETURNING task_id, status, updated_at
    `, [newStatus, task_id, user_id]);

    res.json({ message: `Task marked ${newStatus}.`, task: result.rows[0] });
  } catch (err) {
    console.error('toggleTaskStatus error:', err.message);
    res.status(500).json({ message: 'Failed to toggle task.' });
  }
}

async function deleteTask(req, res) {
  try {
    const user_id = req.user.user_id;
    const { task_id } = req.params;
    const deleted = await pool.query(
      `DELETE FROM tasks WHERE task_id=$1 AND assigned_to=$2 RETURNING task_id`,
      [task_id, user_id]
    );
    if (deleted.rows.length === 0) return res.status(404).json({ message: 'Task not found.' });
    await writeAuditLog({ user_id, action: 'DELETE_TASK', target_table: 'tasks', target_id: task_id, ip_address: req.ip });
    res.json({ message: 'Task deleted.', task_id });
  } catch (err) {
    console.error('deleteTask error:', err.message);
    res.status(500).json({ message: 'Failed to delete task.' });
  }
}

// ── CALENDAR EVENTS ──────────────────────────────────────────

async function getEvents(req, res) {
  try {
    const user_id = req.user.user_id;
    const result = await pool.query(`
      SELECT event_id, title, event_type, location,
             start_datetime, end_datetime, is_all_day,
             color_tag AS color, is_public, created_at, updated_at
      FROM calendar_events
      WHERE created_by=$1 OR is_public=TRUE
      ORDER BY start_datetime ASC
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('getEvents error:', err.message);
    res.status(500).json({ message: 'Failed to fetch events.' });
  }
}

async function createEvent(req, res) {
  try {
    const user_id = req.user.user_id;
    const { title, event_type = 'meeting', location = '', start_datetime, end_datetime = null, is_all_day = false, color = 'orange' } = req.body;
    if (!title || !start_datetime) return res.status(400).json({ message: 'Title and start_datetime are required.' });

    const result = await pool.query(`
      INSERT INTO calendar_events
        (created_by, title, event_type, location, start_datetime, end_datetime, is_all_day, color_tag, is_public)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
      RETURNING event_id, title, event_type, location, start_datetime, end_datetime, is_all_day, color_tag AS color, created_at, updated_at
    `, [user_id, title, event_type, location, start_datetime, end_datetime, is_all_day, color]);

    await writeAuditLog({ user_id, action: 'CREATE_EVENT', target_table: 'calendar_events', target_id: String(result.rows[0].event_id), ip_address: req.ip });
    res.status(201).json({ message: 'Event created.', event: result.rows[0] });
  } catch (err) {
    console.error('createEvent error:', err.message);
    res.status(500).json({ message: 'Failed to create event.' });
  }
}

async function updateEvent(req, res) {
  try {
    const user_id = req.user.user_id;
    const { event_id } = req.params;
    const { title, event_type, location = '', start_datetime, end_datetime = null, is_all_day = false, color = 'orange' } = req.body;
    if (!title || !start_datetime) return res.status(400).json({ message: 'Title and start_datetime required.' });

    const result = await pool.query(`
      UPDATE calendar_events SET
        title=$1, event_type=$2, location=$3, start_datetime=$4,
        end_datetime=$5, is_all_day=$6, color_tag=$7, updated_at=NOW()
      WHERE event_id=$8 AND created_by=$9
      RETURNING event_id, title, event_type, location, start_datetime, end_datetime, is_all_day, color_tag AS color, created_at, updated_at
    `, [title, event_type, location, start_datetime, end_datetime, is_all_day, color, event_id, user_id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Event not found.' });
    res.json({ message: 'Event updated.', event: result.rows[0] });
  } catch (err) {
    console.error('updateEvent error:', err.message);
    res.status(500).json({ message: 'Failed to update event.' });
  }
}

async function deleteEvent(req, res) {
  try {
    const user_id = req.user.user_id;
    const { event_id } = req.params;
    const deleted = await pool.query(
      `DELETE FROM calendar_events WHERE event_id=$1 AND created_by=$2 RETURNING event_id`,
      [event_id, user_id]
    );
    if (deleted.rows.length === 0) return res.status(404).json({ message: 'Event not found.' });
    res.json({ message: 'Event deleted.', event_id });
  } catch (err) {
    console.error('deleteEvent error:', err.message);
    res.status(500).json({ message: 'Failed to delete event.' });
  }
}

// ── ANNOUNCEMENTS ─────────────────────────────────────────────

async function getAnnouncements(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        a.announcement_id, a.title, a.body, a.is_pinned,
        a.published_at, a.updated_at,
        COALESCE(d.dept_name, 'All Departments') AS dept_name,
        u.first_name || ' ' || u.last_name AS posted_by
      FROM announcements a
      LEFT JOIN users u       ON a.posted_by     = u.user_id
      LEFT JOIN departments d ON a.department_id = d.department_id
      WHERE a.is_active = TRUE
      ORDER BY a.is_pinned DESC, a.published_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('getAnnouncements error:', err.message);
    res.status(500).json({ message: 'Failed to fetch announcements.' });
  }
}

async function createAnnouncement(req, res) {
  try {
    const posted_by = req.user.user_id;
    const { title, body, is_pinned = false, dept_name = 'All Departments' } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Title and body are required.' });

    let department_id = null;
    if (dept_name && dept_name !== 'All Departments') {
      const deptResult = await pool.query(
        `SELECT department_id FROM departments WHERE dept_name=$1 OR dept_code=$1`, [dept_name]
      );
      if (deptResult.rows.length > 0) department_id = deptResult.rows[0].department_id;
    }

    const result = await pool.query(`
      INSERT INTO announcements (posted_by, department_id, title, body, is_pinned, is_active, published_at)
      VALUES ($1,$2,$3,$4,$5,TRUE,NOW())
      RETURNING announcement_id, title, body, is_pinned, published_at, updated_at
    `, [posted_by, department_id, title, body, is_pinned]);

    const ann = result.rows[0];
    ann.posted_by = `${req.user.first_name} ${req.user.last_name}`;
    ann.dept_name = dept_name;

    res.status(201).json({ message: 'Announcement posted.', announcement: ann });
  } catch (err) {
    console.error('createAnnouncement error:', err.message);
    res.status(500).json({ message: 'Failed to create announcement.' });
  }
}

async function updateAnnouncement(req, res) {
  try {
    const { announcement_id } = req.params;
    const { title, body, is_pinned = false, dept_name = 'All Departments' } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Title and body are required.' });

    let department_id = null;
    if (dept_name && dept_name !== 'All Departments') {
      const deptResult = await pool.query(
        `SELECT department_id FROM departments WHERE dept_name=$1 OR dept_code=$1`, [dept_name]
      );
      if (deptResult.rows.length > 0) department_id = deptResult.rows[0].department_id;
    }

    const result = await pool.query(`
      UPDATE announcements SET title=$1, body=$2, is_pinned=$3, department_id=$4, updated_at=NOW()
      WHERE announcement_id=$5
      RETURNING announcement_id, title, body, is_pinned, published_at, updated_at
    `, [title, body, is_pinned, department_id, announcement_id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Announcement not found.' });

    const ann = result.rows[0];
    ann.posted_by = `${req.user.first_name} ${req.user.last_name}`;
    ann.dept_name = dept_name;

    res.json({ message: 'Announcement updated.', announcement: ann });
  } catch (err) {
    console.error('updateAnnouncement error:', err.message);
    res.status(500).json({ message: 'Failed to update announcement.' });
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const { announcement_id } = req.params;
    const deleted = await pool.query(
      `UPDATE announcements SET is_active=FALSE, updated_at=NOW() WHERE announcement_id=$1 RETURNING announcement_id`,
      [announcement_id]
    );
    if (deleted.rows.length === 0) return res.status(404).json({ message: 'Announcement not found.' });
    res.json({ message: 'Announcement deleted.', announcement_id });
  } catch (err) {
    console.error('deleteAnnouncement error:', err.message);
    res.status(500).json({ message: 'Failed to delete announcement.' });
  }
}

module.exports = {
  getTasks, createTask, updateTask, toggleTaskStatus, deleteTask,
  getEvents, createEvent, updateEvent, deleteEvent,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
};