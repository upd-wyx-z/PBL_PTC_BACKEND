// ============================================================
//  src/routes/tasks.js - FIXED
//  IMPORTANT: Specific routes (/events, /announcements) MUST
//  come BEFORE dynamic routes (/:task_id) to avoid conflicts!
// ============================================================

const express = require('express');
const router  = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getTasks, createTask, updateTask, toggleTaskStatus, deleteTask,
  getEvents, createEvent, updateEvent, deleteEvent,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} = require('../controllers/tasksController');

const auth      = requireAuth;
const adminOnly = [requireAuth, requireRole('admin_dean', 'admin_vpaa', 'admin_registrar', 'system_admin')];

// ─── CALENDAR EVENTS (must be before /:task_id) ──────────────
router.get('/events',              auth, getEvents);
router.post('/events',             auth, createEvent);
router.put('/events/:event_id',    auth, updateEvent);
router.delete('/events/:event_id', auth, deleteEvent);

// ─── ANNOUNCEMENTS (must be before /:task_id) ────────────────
router.get('/announcements',                        auth,       getAnnouncements);
router.post('/announcements',                       ...adminOnly, createAnnouncement);
router.put('/announcements/:announcement_id',       ...adminOnly, updateAnnouncement);
router.delete('/announcements/:announcement_id',    ...adminOnly, deleteAnnouncement);

// ─── TASKS ───────────────────────────────────────────────────
router.get('/',                    auth, getTasks);
router.post('/',                   auth, createTask);
router.put('/:task_id',            auth, updateTask);
router.patch('/:task_id/toggle',   auth, toggleTaskStatus);
router.delete('/:task_id',         auth, deleteTask);

module.exports = router;