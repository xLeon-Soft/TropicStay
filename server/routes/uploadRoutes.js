const express = require('express');
const { uploadImages, uploadMiddleware } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/images', protect, uploadMiddleware, uploadImages);

module.exports = router;
