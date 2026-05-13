// ============================================================
//  src/routes/scheduling.js
//  Course Scheduling routes — Admin + System Admin only
//  Base path: /api/scheduling
// ============================================================

const express         = require('express');
const router          = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchoolYears,
  getSubjects,
  getFacultyList,
} = require('../controllers/schedulingController');

// GET /api/scheduling/school-years  — dropdown options
router.get('/school-years', requireAuth, getSchoolYears);

// GET /api/scheduling/subjects      — dropdown options
router.get('/subjects', requireAuth, getSubjects);

// GET /api/scheduling/faculty       — dropdown options (faculty list)
router.get('/faculty', requireAuth, getFacultyList);

// GET /api/scheduling               — fetch all schedules (filter by sy_id)
router.get('/', requireAuth, getSchedules);

// POST /api/scheduling              — create new schedule
router.post('/', requireAuth, createSchedule);

// PUT /api/scheduling/:id           — update existing schedule
router.put('/:id', requireAuth, updateSchedule);

// DELETE /api/scheduling/:id        — delete schedule
router.delete('/:id', requireAuth, deleteSchedule);

module.exports = router;