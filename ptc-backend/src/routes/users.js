// ============================================================
//  src/routes/users.js
//  User Management routes — System Admin only
//  Base path: /api/users
// ============================================================

const express         = require('express');
const router          = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getUsers,
  getUserDepartments,
  getUserRoles,
  getUserMetrics,
  createUser,
  updateUser,
  toggleUserStatus,
  changeUserPassword,
  deleteUser,
} = require('../controllers/usersController');

// ── GET /api/users/departments  — dropdown options
router.get('/departments', requireAuth, getUserDepartments);

// ── GET /api/users/roles        — dropdown options
router.get('/roles', requireAuth, getUserRoles);

// ── GET /api/users/metrics      — dashboard counters (active, deactivated, online, offline)
router.get('/metrics', requireAuth, getUserMetrics);

// ── GET /api/users              — list all users (search + filter via query params)
router.get('/', requireAuth, getUsers);

// ── POST /api/users             — create a new user account
router.post('/', requireAuth, createUser);

// ── PUT /api/users/:id          — edit user details
router.put('/:id', requireAuth, updateUser);

// ── PATCH /api/users/:id/status   — toggle active / deactivated
router.patch('/:id/status', requireAuth, toggleUserStatus);

// ── PATCH /api/users/:id/password — admin-forced password change
router.patch('/:id/password', requireAuth, changeUserPassword);

// ── DELETE /api/users/:id       — permanently delete a user
router.delete('/:id', requireAuth, deleteUser);

module.exports = router;