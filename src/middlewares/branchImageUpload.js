const multer = require('multer');
const { errorResponse } = require('../utils/responseUtils');

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
    }
    callback(null, true);
  },
});

const detectImageMimeType = (buffer) => {
  if (!buffer || buffer.length < 12) return null;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return 'image/jpeg';

  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (isPng) return 'image/png';

  const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (isWebp) return 'image/webp';

  return null;
};

const uploadBranchImage = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 'La foto no puede superar los 5 MB', [], 413);
      }
      return errorResponse(res, 'Selecciona una foto JPEG, PNG o WebP válida', [], 400);
    }

    if (!req.file) {
      return errorResponse(res, 'Debes adjuntar una imagen en el campo image', [], 400);
    }

    const detectedMimeType = detectImageMimeType(req.file.buffer);
    if (!detectedMimeType || detectedMimeType !== req.file.mimetype) {
      return errorResponse(res, 'El contenido del archivo no corresponde a una imagen permitida', [], 400);
    }

    return next();
  });
};

module.exports = { uploadBranchImage, MAX_IMAGE_SIZE_BYTES };
