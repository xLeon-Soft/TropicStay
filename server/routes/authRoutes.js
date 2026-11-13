const express = require('express');
const { googleLogin, register, login, getMe, updateProfile, getUserAvatar } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/google', googleLogin);
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/avatar/:userId', getUserAvatar);

module.exports = router;
