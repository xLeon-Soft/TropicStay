const express = require('express');
const router = express.Router();
const chaletController = require('../controllers/chaletController');
const reviewController = require('../controllers/reviewController');

router.get('/', chaletController.getChalets);
router.get('/meta/departments', chaletController.getDepartments);
router.get('/:id', chaletController.getChaletById);
router.post('/', chaletController.createChalet);

// Reviews sub-route
router.get('/:id/reviews', reviewController.getChaletReviews);
router.post('/:id/reviews', reviewController.addReview);

module.exports = router;
