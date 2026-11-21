const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, bookingController.createBooking);
router.get('/', protect, bookingController.getBookings);
router.get('/summary', protect, bookingController.getBookingSummary);
router.get('/:id', protect, bookingController.getBookingById);
router.patch('/:id/status', protect, bookingController.updateBookingStatus);
router.delete('/:id', protect, bookingController.deleteBooking);

module.exports = router;
