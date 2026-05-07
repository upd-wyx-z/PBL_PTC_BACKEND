// ============================================================
//  src/middleware/uploadResource.js
//  Multer middleware for Department Repository file uploads
//  Max size: 50MB — matches frontend note
//  Accepted: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG
// ============================================================

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/resources');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    cb(null, `${baseName}_${Date.now()}${ext}`);
  },
});

const allowedTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, XLS, PPT, JPG, PNG allowed.'), false);
  }
};

const uploadResource = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

module.exports = uploadResource;