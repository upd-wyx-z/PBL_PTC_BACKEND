// ============================================================
//  src/controllers/repositoryController.js
//  Handles Department Repository — file upload, list, download, delete
//
//  DB columns (resources table):
//    resource_id, uploaded_by, department_id, subject_id,
//    sy_id, title, description, file_name, file_path,
//    file_size_bytes, mime_type, download_count,
//    visibility, visible_to, remarks_faculty, is_active,
//    created_at, updated_at
// ============================================================

const pool              = require('../config/db');
const path              = require('path');
const fs                = require('fs');
const { writeAuditLog } = require('../utils/auditLog');

// ─────────────────────────────────────────────────────────────
//  GET /api/repository
//  Returns all accessible files for the logged-in user
//  Supports: ?search= &sy_id= &sortBy= &sortDir=
// ─────────────────────────────────────────────────────────────
async function getFiles(req, res) {
  try {
    const user_id   = req.user.user_id;
    const role_name = req.user.role_name;
    const {
      search  = '',
      sy_id   = '',
      sortBy  = 'created_at',
      sortDir = 'desc',
    } = req.query;

    const allowedSort = ['created_at', 'file_name', 'title'];
    const safeSortBy  = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const safeSortDir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const conditions = [`r.is_active = TRUE`];
    const params     = [];
    let   idx        = 1;

    // Search by title or filename
    if (search) {
      conditions.push(`(LOWER(r.title) LIKE $${idx} OR LOWER(r.file_name) LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    // Filter by school year
    if (sy_id && sy_id !== 'All') {
      conditions.push(`r.sy_id = $${idx++}`);
      params.push(parseInt(sy_id));
    }

    // Visibility logic — matches frontend access control
    const isAdmin = ['admin_dean', 'admin_vpaa', 'admin_registrar', 'system_admin'].includes(role_name);
    if (!isAdmin) {
      conditions.push(`(
        r.visibility = 'all'
        OR r.uploaded_by = $${idx}
        OR (r.visibility = 'specific' AND $${idx} = ANY(r.visible_to::uuid[]))
      )`);
      params.push(user_id);
      idx++;
    }
    // Admins can see everything except private files they don't own
    else {
      conditions.push(`(
        r.visibility != 'private'
        OR r.uploaded_by = $${idx}
      )`);
      params.push(user_id);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query(`
      SELECT
        r.resource_id   AS file_id,
        r.title,
        r.file_name,
        r.file_path,
        r.mime_type     AS file_type,
        r.file_size_bytes,
        r.visibility,
        r.visible_to,
        r.remarks_faculty,
        r.download_count,
        r.created_at    AS upload_date,
        r.updated_at,
        r.uploaded_by   AS uploader_id,
        u.first_name || ' ' || u.last_name AS uploaded_by,
        sy.sy_label,
        sy.semester,
        s.subject_code,
        s.subject_name
      FROM resources r
      JOIN users        u  ON r.uploaded_by = u.user_id
      LEFT JOIN school_years sy ON r.sy_id      = sy.sy_id
      LEFT JOIN subjects     s  ON r.subject_id = s.subject_id
      ${whereClause}
      ORDER BY r.${safeSortBy} ${safeSortDir}
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('getFiles error:', err.message);
    res.status(500).json({ message: 'Failed to fetch repository files.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  POST /api/repository/upload
//  Uploads a file — uses multer for multipart/form-data
//  Fields: title, sy_id, subject_id, remarks_faculty,
//          visibility, visible_to (JSON array)
// ─────────────────────────────────────────────────────────────
async function uploadFile(req, res) {
  try {
    const user_id = req.user.user_id;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const {
      title,
      sy_id          = null,
      subject_id     = null,
      remarks_faculty = '',
      visibility     = 'all',
      visible_to     = '[]',
    } = req.body;

    if (!title) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Document title is required.' });
    }

    // Parse visible_to JSON array
    let visibleToArray = [];
    try {
      visibleToArray = JSON.parse(visible_to);
    } catch {
      visibleToArray = [];
    }

    // Build the public URL path — MUST be set before INSERT
    // DB has constraint: resource_type='file' requires file_path NOT NULL
    const file_path = `/uploads/resources/${req.file.filename}`;
    if (!file_path) {
      return res.status(500).json({ message: 'File path could not be determined.' });
    }

    // Get uploader's department_id
    const userResult = await pool.query(
      `SELECT department_id FROM users WHERE user_id = $1`, [user_id]
    );
    const department_id = userResult.rows[0]?.department_id || null;

    const result = await pool.query(`
      INSERT INTO resources
        (uploaded_by, department_id, subject_id, sy_id, title,
         file_name, file_path, file_size_bytes, mime_type,
         resource_type, visibility, visible_to, remarks_faculty, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'file',$10,$11,$12,TRUE)
      RETURNING
        resource_id AS file_id, title, file_name, file_path,
        mime_type AS file_type, file_size_bytes, visibility,
        visible_to, created_at AS upload_date
    `, [
      user_id,
      department_id,
      subject_id ? parseInt(subject_id) : null,
      sy_id      ? parseInt(sy_id)      : null,
      title,
      req.file.originalname,
      file_path,
      req.file.size,
      req.file.mimetype,
      visibility,
      visibleToArray,
      remarks_faculty || '',
    ]);

    const newFile = result.rows[0];
    newFile.uploaded_by  = `${req.user.first_name} ${req.user.last_name}`;
    newFile.uploader_id  = user_id;

    await writeAuditLog({
      user_id,
      action:       'UPLOAD_RESOURCE',
      target_table: 'resources',
      target_id:    String(newFile.file_id),
      new_values:   { title, visibility, file_name: req.file.originalname },
      ip_address:   req.ip,
    });

    res.status(201).json({ message: 'File uploaded successfully.', file: newFile });
  } catch (err) {
    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('uploadFile error:', err.message);
    res.status(500).json({ message: 'Failed to upload file.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/repository/:resource_id/download
//  Downloads a file and increments download_count
// ─────────────────────────────────────────────────────────────
async function downloadFile(req, res) {
  try {
    const { resource_id } = req.params;
    const user_id         = req.user.user_id;

    const result = await pool.query(
      `SELECT resource_id, file_name, file_path, mime_type, is_active FROM resources WHERE resource_id = $1`,
      [resource_id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '../../public', file.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    // Increment download count
    await pool.query(
      `UPDATE resources SET download_count = download_count + 1 WHERE resource_id = $1`,
      [resource_id]
    );

    // Log the download
    await pool.query(
      `INSERT INTO resource_access_logs (resource_id, accessed_by, action) VALUES ($1, $2, 'download')`,
      [resource_id, user_id]
    );

    res.download(filePath, file.file_name);
  } catch (err) {
    console.error('downloadFile error:', err.message);
    res.status(500).json({ message: 'Failed to download file.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  DELETE /api/repository/:resource_id
//  Soft deletes a file (sets is_active = FALSE)
//  Only uploader or system_admin can delete
// ─────────────────────────────────────────────────────────────
async function deleteFile(req, res) {
  try {
    const { resource_id } = req.params;
    const user_id         = req.user.user_id;
    const role_name       = req.user.role_name;

    const fileResult = await pool.query(
      `SELECT resource_id, uploaded_by, title FROM resources WHERE resource_id = $1 AND is_active = TRUE`,
      [resource_id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const file      = fileResult.rows[0];
    const isOwner   = file.uploaded_by === user_id;
    const isSysAdmin = role_name === 'system_admin';

    if (!isOwner && !isSysAdmin) {
      return res.status(403).json({ message: 'You can only delete files you uploaded.' });
    }

    // Soft delete
    await pool.query(
      `UPDATE resources SET is_active = FALSE, updated_at = NOW() WHERE resource_id = $1`,
      [resource_id]
    );

    await writeAuditLog({
      user_id,
      action:       'DELETE_RESOURCE',
      target_table: 'resources',
      target_id:    String(resource_id),
      old_values:   { title: file.title },
      ip_address:   req.ip,
    });

    res.json({ message: 'File deleted successfully.', resource_id });
  } catch (err) {
    console.error('deleteFile error:', err.message);
    res.status(500).json({ message: 'Failed to delete file.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/repository/lookup/school-years
//  Returns all school years for the filter dropdown
// ─────────────────────────────────────────────────────────────
async function getSchoolYears(req, res) {
  try {
    const result = await pool.query(
      `SELECT sy_id, sy_label, semester, is_current FROM school_years ORDER BY sy_id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getSchoolYears error:', err.message);
    res.status(500).json({ message: 'Failed to fetch school years.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/repository/lookup/subjects
//  Returns all subjects for the upload form dropdown
// ─────────────────────────────────────────────────────────────
async function getSubjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT subject_id, subject_code, subject_name FROM subjects ORDER BY subject_code`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getSubjects error:', err.message);
    res.status(500).json({ message: 'Failed to fetch subjects.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/repository/lookup/users
//  Returns all users for the "specific" visibility selector
// ─────────────────────────────────────────────────────────────
async function getUsers(req, res) {
  try {
    const user_id = req.user.user_id;
    const result  = await pool.query(`
      SELECT
        u.user_id,
        u.first_name || ' ' || u.last_name AS name,
        r.role_name AS role,
        u.email
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.is_active = TRUE
        AND u.user_id  != $1
      ORDER BY u.last_name ASC
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('getUsers error:', err.message);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/repository/:resource_id/view
//  Streams the file inline for PDF preview in the browser
//  Sets Content-Disposition: inline so browser renders it
// ─────────────────────────────────────────────────────────────
async function viewFile(req, res) {
  try {
    const { resource_id } = req.params;

    const result = await pool.query(
      `SELECT resource_id, file_name, file_path, mime_type, is_active FROM resources WHERE resource_id = $1`,
      [resource_id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const file     = result.rows[0];
    const filePath = path.join(__dirname, '../../public', file.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    // Set inline disposition so browser renders PDF instead of downloading
    res.setHeader('Content-Type',        file.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);

    // Log view access
    await pool.query(
      `INSERT INTO resource_access_logs (resource_id, accessed_by, action) VALUES ($1, $2, 'view')`,
      [resource_id, req.user.user_id]
    );

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('viewFile error:', err.message);
    res.status(500).json({ message: 'Failed to view file.' });
  }
}
 
  module.exports = {
  getFiles, uploadFile, downloadFile, viewFile, deleteFile,
  getSchoolYears, getSubjects, getUsers,
};