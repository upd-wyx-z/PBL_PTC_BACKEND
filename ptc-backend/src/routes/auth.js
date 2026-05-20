// ============================================================
//  src/routes/auth.js
//  Authentication routes
//  Base path: /api/auth
// ============================================================

const express  = require('express');
const router   = express.Router();
const { requireAuth } = require('../middleware/auth');
const { loginStepOne, verifyOTP, logout, getMe } = require('../controllers/authController');

// POST /api/auth/login      — Step 1: Check password & send OTP
router.post('/login', loginStepOne);

// POST /api/auth/verify-otp — Step 2: Check OTP & issue session
router.post('/verify-otp', verifyOTP);

// POST /api/auth/logout     — requires valid session
router.post('/logout', requireAuth, logout);

// GET  /api/auth/me         — requires valid session (used on page refresh)
router.get('/me', requireAuth, getMe);

module.exports = router;