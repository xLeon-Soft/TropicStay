const express = require('express');
const router = express.Router();
const chaletController = require('../controllers/chaletController');
const reviewController = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', chaletController.getChalets);
router.get('/meta/departments', chaletController.getDepartments);
router.get('/meta/destinations', chaletController.getDestinations);
router.get('/:id', chaletController.getChaletById);
router.post('/', protect, chaletController.createChalet);
router.put('/:id', protect, chaletController.updateChalet);
router.delete('/:id', protect, chaletController.deleteChalet);

// Reviews sub-route
router.get('/:id/reviews', reviewController.getChaletReviews);
router.post('/:id/reviews', protect, reviewController.addReview);

module.exports = router;
