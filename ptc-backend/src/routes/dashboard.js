// ============================================================
//  src/routes/dashboard.js
//  Dashboard routes — all logged-in users
//  Base path: /api/dashboard
// ============================================================

const express    = require('express');
const router     = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDashboardData } = require('../controllers/dashboardController');

// GET /api/dashboard
// Returns tasks, eventsList, announcements, and summary stats
// All roles can access — data is filtered per user inside the controller
router.get('/', requireAuth, getDashboardData);

module.exports = router;
