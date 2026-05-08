// ============================================================
//  src/routes/profile.js
//  Profile routes — all logged-in users (own profile only)
//  Base path: /api/profile
// ============================================================

const express     = require('express');
const router      = express.Router();
const { requireAuth } = require('../middleware/auth');
const uploadPhoto     = require('../middleware/uploadPhoto');
const { getMe, updateMe, changeMyPassword, uploadPhoto: uploadPhotoHandler } = require('../controllers/profileController');

// Get own profile
router.get('/me', requireAuth, getMe);

// Update general info
router.put('/me', requireAuth, updateMe);

// Change own password
router.patch('/me/password', requireAuth, changeMyPassword);

// Upload profile photo (field name must be "photo")
router.post('/me/photo', requireAuth, uploadPhoto.single('photo'), uploadPhotoHandler);

module.exports = router;