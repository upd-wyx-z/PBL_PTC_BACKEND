// ============================================================
//  server.js
//  PTC Online Educators Web Portal - Express Backend
//  Entry point — mounts all routes and middleware
// ============================================================

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
//  GLOBAL MIDDLEWARE
// ─────────────────────────────────────────────────────────────

// CORS — allow requests from the Vite frontend
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,   // needed so cookies (session_id) are sent
}));

// Serve uploaded files as static (for downloads)
const path = require('path');
app.use('/uploads', require('express').static(path.join(__dirname, 'public/uploads')));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Simple cookie parser (reads req.cookies without a library)
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [key, ...val] = cookie.trim().split('=');
      req.cookies[key.trim()] = decodeURIComponent(val.join('='));
    });
  }
  next();
});

// ─────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PTC Backend is running.' });
});

// Auth routes (login, logout, me)
app.use('/api/auth', require('./src/routes/auth'));


// Department Repository routes (All users)
app.use('/api/repository', require('./src/routes/repository'));


// Tasks, Events & Announcements routes (All users)
app.use('/api/tasks', require('./src/routes/tasks'));

// Dashboard routes (All logged-in users)
app.use('/api/dashboard', require('./src/routes/dashboard'));

// ─────────────────────────────────────────────────────────────
//  404 HANDLER
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
});

// ─────────────────────────────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'An unexpected server error occurred.' });
});

// ─────────────────────────────────────────────────────────────
//  START SERVER
//  On every restart: clear all active sessions from DB
//  This forces users to log in again on fresh server start
// ─────────────────────────────────────────────────────────────
const pool = require('./src/config/db');

app.listen(PORT, async () => {
  console.log(`🚀 PTC Backend running on http://localhost:${PORT}`);
  console.log(`📋 API Base: http://localhost:${PORT}/api`);

  // Clear all active sessions on server restart
  // This ensures users always see the login page on fresh start
  try {
    const result = await pool.query(
      `UPDATE user_sessions SET is_active = FALSE WHERE is_active = TRUE`
    );
    console.log(`🔐 Sessions cleared on startup (${result.rowCount} session/s invalidated)`);
  } catch (err) {
    console.error('⚠️  Could not clear sessions on startup:', err.message);
  }
});