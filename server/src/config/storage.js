const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const SUBDIRS = ['menu', 'qr', 'receipts', 'upi'];

function ensureUploadDirs() {
  const base = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
  SUBDIRS.forEach(sub => {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  return base;
}

function createDiskStorage(subdir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const base = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
      cb(null, path.join(base, subdir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

function getPublicUrl(subdir, filename) {
  const base = (process.env.VPS_PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '');
  return `${base}/uploads/${subdir}/${filename}`;
}

const menuUpload = multer({
  storage: createDiskStorage('menu'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

const upiUpload = multer({
  storage: createDiskStorage('upi'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

module.exports = { ensureUploadDirs, getPublicUrl, menuUpload, upiUpload };
