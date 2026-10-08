const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadsDirectory = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'images'));
    }
    callback(null, true);
  },
});

const uploadImages = (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, message: 'Selecciona al menos una imagen.' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return res.status(201).json({
    success: true,
    urls: files.map(file => `${baseUrl}/uploads/${file.filename}`),
  });
};

const uploadMiddleware = (req, res, next) => {
  upload.array('images', 10)(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Cada imagen puede pesar como máximo 8 MB.' });
    }
    return res.status(400).json({ success: false, message: 'Solo se permiten imágenes JPG, PNG, WEBP o GIF (máximo 10).' });
  });
};

module.exports = { uploadImages, uploadMiddleware };
