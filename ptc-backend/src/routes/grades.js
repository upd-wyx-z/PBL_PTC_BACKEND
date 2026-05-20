// ============================================================
//  src/routes/grades.js
//  Base path: /api/grades
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { 
  getFacultyCourses, 
  getCourseGradebook, 
  saveActivity, 
  saveGrades, 
  submitTermGrades 
} = require('../controllers/gradesController');

// All grade routes require the user to be logged in
router.use(requireAuth);

router.get('/courses', getFacultyCourses);
router.get('/courses/:courseId', getCourseGradebook);
router.post('/activities', saveActivity);
router.post('/save', saveGrades);
router.post('/courses/:courseId/submit', submitTermGrades);

module.exports = router;