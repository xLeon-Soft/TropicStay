const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.use(protect);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/eligibility/:userId', messageController.getChatEligibility);
router.get('/conversations', messageController.getConversations);
router.get('/with/:userId', messageController.getConversation);
router.post('/', messageController.sendMessage);

module.exports = router;
