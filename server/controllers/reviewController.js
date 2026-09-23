const Review = require('../models/Review');
const Chalet = require('../models/Chalet');

// POST /api/chalets/:id/reviews
exports.addReview = async (req, res) => {
  try {
    const chaletId = req.params.id;
    const { authorName, authorAvatar, rating, comment, cleanliness, location, communication, value } = req.body;

    const chalet = await Chalet.findById(chaletId);
    if (!chalet) {
      return res.status(404).json({ success: false, message: 'Chalet no encontrado' });
    }

    const review = await Review.create({
      chalet: chaletId,
      authorName: authorName || 'Huésped Satisfecho',
      authorAvatar: authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authorName || 'Guest')}`,
      rating: Number(rating) || 5,
      comment: comment || 'Excelente experiencia, el chalet superó nuestras expectativas.',
      cleanliness: Number(cleanliness) || 5,
      location: Number(location) || 5,
      communication: Number(communication) || 5,
      value: Number(value) || 5,
    });

    // Recalculate average rating & breakdown
    const allReviews = await Review.find({ chalet: chaletId });
    const count = allReviews.length;
    const avgRating = (allReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1);

    const avgCleanliness = (allReviews.reduce((sum, r) => sum + (r.cleanliness || r.rating), 0) / count).toFixed(1);
    const avgLocation = (allReviews.reduce((sum, r) => sum + (r.location || r.rating), 0) / count).toFixed(1);
    const avgCommunication = (allReviews.reduce((sum, r) => sum + (r.communication || r.rating), 0) / count).toFixed(1);
    const avgValue = (allReviews.reduce((sum, r) => sum + (r.value || r.rating), 0) / count).toFixed(1);

    chalet.rating = Number(avgRating);
    chalet.reviewsCount = count;
    chalet.ratingBreakdown = {
      cleanliness: Number(avgCleanliness),
      accuracy: 4.9,
      communication: Number(avgCommunication),
      location: Number(avgLocation),
      value: Number(avgValue),
    };

    await chalet.save();

    res.status(201).json({
      success: true,
      message: 'Reseña agregada con éxito',
      data: review,
      updatedChaletRating: chalet.rating,
      updatedReviewsCount: chalet.reviewsCount,
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(400).json({ success: false, message: 'Error al agregar reseña', error: error.message });
  }
};

// GET /api/chalets/:id/reviews
exports.getChaletReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ chalet: req.params.id }).sort({ date: -1 });
    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener reseñas' });
  }
};
