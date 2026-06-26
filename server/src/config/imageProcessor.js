const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

/**
 * Express middleware — converts the multer-saved file to WebP after upload.
 * Replaces req.file.path / req.file.filename with the new .webp path.
 * Deletes the original file.
 *
 * @param {object} opts
 * @param {number} opts.maxWidth  - resize to this width (maintains aspect ratio, no upscale)
 * @param {number} opts.quality   - WebP quality 1-100
 */
function toWebp({ maxWidth = 900, quality = 78 } = {}) {
  return async (req, _res, next) => {
    if (!req.file) return next();

    const src  = req.file.path;
    const base = path.basename(src, path.extname(src));
    const dest = path.join(path.dirname(src), `${base}.webp`);

    try {
      await sharp(src)
        .resize(maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
        .webp({ quality })
        .toFile(dest);

      fs.unlinkSync(src);

      req.file.path     = dest;
      req.file.filename = path.basename(dest);
      req.file.mimetype = 'image/webp';

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { toWebp };
