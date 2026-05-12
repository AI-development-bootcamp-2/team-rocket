'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Allowed MIME types and their magic byte signatures ────────────────────────
// Magic bytes are checked against the raw buffer — NOT the Content-Type header.
const ALLOWED = [
  {
    mime: 'image/jpeg',
    magic: [Buffer.from([0xff, 0xd8, 0xff])],
    offset: 0,
  },
  {
    mime: 'image/png',
    magic: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    offset: 0,
  },
  {
    mime: 'application/pdf',
    magic: [Buffer.from('%PDF')],
    offset: 0,
  },
  {
    // Legacy .doc (Compound Document / OLE2)
    mime: 'application/msword',
    magic: [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
    offset: 0,
  },
  {
    // .docx is a ZIP — PK signature at offset 0
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    offset: 0,
  },
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Detect MIME type from buffer magic bytes.
 * Returns the matched MIME string, or null if unrecognised.
 * @param {Buffer} buf
 * @returns {string|null}
 */
function detectMime(buf) {
  for (const { mime, magic, offset } of ALLOWED) {
    for (const sig of magic) {
      const slice = buf.slice(offset, offset + sig.length);
      if (slice.equals(sig)) return mime;
    }
  }
  return null;
}

// ── Storage engine ────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Use memory storage so we can inspect bytes before writing to disk.
// The fileFilter below runs on the raw buffer; the file is then passed on.
const memStorage = multer.memoryStorage();

// ── Multer instance (memory) — validates size and runs fileFilter ─────────────
const _upload = multer({
  storage: memStorage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    // Accept all here; magic-byte check happens after buffering (see middleware below)
    void file;
    cb(null, true);
  },
});

/**
 * Upload middleware — validates magic bytes then persists to disk (local dev)
 * or hands off to S3 (prod).
 *
 * Usage:  router.post('/upload', upload.single('file'), handler)
 */
const upload = {
  single: (fieldName) => [
    (req, res, next) => {
      _upload.single(fieldName)(req, res, (err) => {
        if (!err) {
          next();
          return;
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'File too large.' });
          return;
        }
        next(err);
      });
    },
    (req, res, next) => {
      if (!req.file) return next();

      const detectedMime = detectMime(req.file.buffer);
      if (!detectedMime) {
        return res.status(415).json({ error: 'Unsupported file type.' });
      }
      req.file.detectedMime = detectedMime;

      const driver = process.env.STORAGE_DRIVER || 'local';

      if (driver === 's3') {
        // TODO: implement S3 upload in F08 when AWS SDK is available
        return res.status(501).json({ error: 'S3 storage not yet configured.' });
      }

      // Local: write buffer to disk
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const ext = path.extname(req.file.originalname).toLowerCase();
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);

      fs.writeFile(filepath, req.file.buffer, (err) => {
        if (err) return next(err);
        req.file.filename = filename;
        req.file.path = filepath;
        req.file.destination = UPLOADS_DIR;
        next();
      });
    },
  ],
};

module.exports = { upload, detectMime, UPLOADS_DIR };
