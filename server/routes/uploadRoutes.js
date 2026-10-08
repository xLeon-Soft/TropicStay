const express = require('express');
const { uploadImages, uploadMiddleware } = require('../controllers/uploadController');

const router = express.Router();

router.post('/images', uploadMiddleware, uploadImages);

module.exports = router;
