const mongoose = require('mongoose');
const Review = require('../models/Review');
const Chalet = require('../models/Chalet');

const validChaletId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/chalets/:id/reviews
exports.addReview = async (req, res) => {
  try {
    const chaletId = req.params.id;
    const { rating, comment, cleanliness, accuracy, location, communication, value } = req.body;

    if (!validChaletId(chaletId)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: 'El comentario de la reseña es obligatorio.' });
    }

    const chalet = await Chalet.findById(chaletId);
    if (!chalet) return res.status(404).json({ success: false, message: 'Chalet no encontrado.' });

    if (String(chalet.host) === String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'No puedes dejar una reseña en tu propio chalet.' });
    }

    const review = await Review.create({
      chalet: chaletId,
      authorName: req.user.name,
      authorAvatar: req.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.user.name)}`,
      rating: Number(rating) || 5,
      comment: comment.trim(),
      cleanliness: Number(cleanliness) || 5,
      location: Number(location) || 5,
      communication: Number(communication) || 5,
      value: Number(value) || 5,
    });

    const allReviews = await Review.find({ chalet: chaletId });
    const average = (field) => Number((allReviews.reduce((sum, item) => sum + (item[field] || item.rating), 0) / allReviews.length).toFixed(1));

    chalet.rating = average('rating');
    chalet.reviewsCount = allReviews.length;
    chalet.ratingBreakdown = {
      cleanliness: average('cleanliness'),
      accuracy: Number(accuracy) ? Number((( (chalet.ratingBreakdown?.accuracy || 5) * (allReviews.length - 1) + Number(accuracy) ) / allReviews.length).toFixed(1)) : average('rating'),
      communication: average('communication'),
      location: average('location'),
      value: average('value'),
    };
    await chalet.save();

    return res.status(201).json({
      success: true,
      message: 'Reseña agregada correctamente.',
      data: review,
      updatedChaletRating: chalet.rating,
      updatedReviewsCount: chalet.reviewsCount,
    });
  } catch (error) {
    console.error('Error adding review:', error);
    return res.status(400).json({ success: false, message: 'Error al agregar reseña.', error: error.message });
  }
};

// GET /api/chalets/:id/reviews
exports.getChaletReviews = async (req, res) => {
  try {
    if (!validChaletId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    const reviews = await Review.find({ chalet: req.params.id }).sort({ date: -1 });
    return res.json({ success: true, count: reviews.length, data: reviews });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Error al obtener reseñas.' });
  }
};
