// ============================================================
//  src/routes/repository.js
//  Department Repository routes — all logged-in users
//  Base path: /api/repository
// ============================================================

const express        = require('express');
const router         = express.Router();
const { requireAuth } = require('../middleware/auth');
const uploadResource  = require('../middleware/uploadResource');
const {
  getFiles, uploadFile, downloadFile, viewFile, deleteFile,
  getSchoolYears, getSubjects, getUsers,
} = require('../controllers/repositoryController');

// Lookup routes (for upload form dropdowns)
router.get('/lookup/school-years', requireAuth, getSchoolYears);
router.get('/lookup/subjects',     requireAuth, getSubjects);
router.get('/lookup/users',        requireAuth, getUsers);

// Get all accessible files
router.get('/', requireAuth, getFiles);

// Upload a file (multipart/form-data with field name: 'file')
router.post('/upload', requireAuth, uploadResource.single('file'), uploadFile);

// View file inline (PDF preview in iframe)
router.get('/:resource_id/view', requireAuth, viewFile);

// Download a file
router.get('/:resource_id/download', requireAuth, downloadFile);

// Delete a file
router.delete('/:resource_id', requireAuth, deleteFile);

module.exports = router;