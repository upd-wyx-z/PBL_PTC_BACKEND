// ============================================================
//  src/routes/directory.js
//  Faculty Directory routes — Admin + System Admin only
//  Base path: /api/directory
// ============================================================

const express             = require('express');
const router              = express.Router();
const { requireAuth }     = require('../middleware/auth');
const {
  getDirectory,
  getDepartments,
  getRoles,
} = require('../controllers/directoryController');

// GET /api/directory         — fetch all active users (with filters/search via query params)
router.get('/', requireAuth, getDirectory);

// GET /api/directory/departments — list of unique departments for filter dropdown
router.get('/departments', requireAuth, getDepartments);

// GET /api/directory/roles      — list of unique role names for filter dropdown
router.get('/roles', requireAuth, getRoles);

module.exports = router;