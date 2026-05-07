// ============================================================
//  src/routes/auth.js
//  Authentication routes
//  Base path: /api/auth
// ============================================================

const express  = require('express');
const router   = express.Router();
const { requireAuth } = require('../middleware/auth');
const { login, logout, getMe } = require('../controllers/authController');

// POST /api/auth/login  — no auth required (public)
router.post('/login', login);

// POST /api/auth/logout — requires valid session
router.post('/logout', requireAuth, logout);

// GET  /api/auth/me     — requires valid session (used on page refresh)
router.get('/me', requireAuth, getMe);

module.exports = router;
