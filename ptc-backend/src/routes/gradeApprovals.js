// ============================================================
//  src/routes/gradeApprovals.js
//  Base path: /api/grade-approvals
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { 
  getSubmissions, 
  getSubmissionDetails, 
  approveSubmission, 
  returnSubmission 
} = require('../controllers/gradeApprovalsController');

router.use(requireAuth);

router.get('/', getSubmissions);
router.get('/:submissionId', getSubmissionDetails);
router.post('/:submissionId/approve', approveSubmission);
router.post('/:submissionId/return', returnSubmission);

module.exports = router;