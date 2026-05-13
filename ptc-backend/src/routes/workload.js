// ============================================================
//  src/routes/workload.js
//  Workload Management routes
//  Dean/Admin: /api/workload/*
//  Faculty: /api/workload/my/*
//  Base path: /api/workload
// ============================================================

const express         = require('express');
const router          = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  // Dean/Admin routes
  getFacultyWorkloadList,
  getFacultyScheduleDetail,
  acknowledgeWorkload,
  requestRevision,
  getSchoolYears,
  // Subject management (Dean)
  getSubjects,
  addSubject,
  deleteSubject,
  // Faculty routes
  getMyWorkload,
  getMyMemos,
} = require('../controllers/workloadController');

// ── Shared ────────────────────────────────────────────────────
router.get('/school-years', requireAuth, getSchoolYears);
 
// ── Subject management (MUST be before /:facultyId) ──────────
router.get('/subjects',              requireAuth, getSubjects);
router.post('/subjects',             requireAuth, addSubject);
router.delete('/subjects/:subjectId',requireAuth, deleteSubject);
 
// ── Faculty self routes (MUST be before /:facultyId) ─────────
router.get('/my',       requireAuth, getMyWorkload);
router.get('/my/memos', requireAuth, getMyMemos);
 
// ── Dean/Admin routes ─────────────────────────────────────────
router.get('/', requireAuth, getFacultyWorkloadList);
 
// ── Dynamic /:facultyId LAST ──────────────────────────────────
router.get('/:facultyId',                  requireAuth, getFacultyScheduleDetail);
router.post('/:facultyId/acknowledge',     requireAuth, acknowledgeWorkload);
router.post('/:facultyId/revision',        requireAuth, requestRevision);
 
module.exports = router;