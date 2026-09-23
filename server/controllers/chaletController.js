const Chalet = require('../models/Chalet');
const User = require('../models/User');
const Review = require('../models/Review');

// GET /api/chalets
exports.getChalets = async (req, res) => {
  try {
    const {
      search,
      department,
      category,
      minPrice,
      maxPrice,
      guests,
      minRating,
      amenities,
      sort,
    } = req.query;

    const filter = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { department: searchRegex },
        { municipality: searchRegex },
        { locationName: searchRegex },
        { description: searchRegex },
      ];
    }

    if (department && department !== 'Todos') {
      filter.department = new RegExp(`^${department.trim()}$`, 'i');
    }

    if (category && category !== 'Todas') {
      filter.category = category;
    }

    if (minPrice || maxPrice) {
      filter.pricePerNight = {};
      if (minPrice) filter.pricePerNight.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerNight.$lte = Number(maxPrice);
    }

    if (guests) {
      filter.guestsMax = { $gte: Number(guests) };
    }

    if (minRating) {
      filter.rating = { $gte: Number(minRating) };
    }

    if (amenities) {
      const amenitiesList = Array.isArray(amenities) ? amenities : amenities.split(',');
      filter.amenities = { $all: amenitiesList };
    }

    let query = Chalet.find(filter).populate('host', 'name avatar verified superhost rating responseTime memberSince location');

    if (sort === 'price-asc') {
      query = query.sort({ pricePerNight: 1 });
    } else if (sort === 'price-desc') {
      query = query.sort({ pricePerNight: -1 });
    } else if (sort === 'rating-desc') {
      query = query.sort({ rating: -1 });
    } else {
      query = query.sort({ featured: -1, createdAt: -1 });
    }

    const chalets = await query.exec();
    res.json({ success: true, count: chalets.length, data: chalets });
  } catch (error) {
    console.error('Error fetching chalets:', error);
    res.status(500).json({ success: false, message: 'Error al obtener chalets', error: error.message });
  }
};

// GET /api/chalets/:id
exports.getChaletById = async (req, res) => {
  try {
    const chalet = await Chalet.findById(req.params.id).populate('host');
    if (!chalet) {
      return res.status(404).json({ success: false, message: 'Chalet no encontrado' });
    }

    const reviews = await Review.find({ chalet: chalet._id }).sort({ date: -1 });

    res.json({
      success: true,
      data: {
        ...chalet.toObject(),
        reviews,
      },
    });
  } catch (error) {
    console.error('Error fetching chalet detail:', error);
    res.status(500).json({ success: false, message: 'Error al obtener detalle del chalet', error: error.message });
  }
};

// POST /api/chalets
exports.createChalet = async (req, res) => {
  try {
    const chaletData = { ...req.body };

    // Calculate USD price if not provided (approx 7.8 Q / USD)
    if (chaletData.pricePerNight && !chaletData.priceUSD) {
      chaletData.priceUSD = Math.round(chaletData.pricePerNight / 7.78);
    }

    // Default host if not provided
    if (!chaletData.host) {
      let defaultHost = await User.findOne({ role: 'host' });
      if (!defaultHost) {
        defaultHost = await User.create({
          name: 'Hospedajes de Guatemala',
          email: 'contacto@tropicstay.gt',
          phone: '+502 2333-8899',
          role: 'host',
          verified: true,
          superhost: true,
          bio: 'Red exclusiva de anfitriones de chalets premium en Guatemala.',
        });
      }
      chaletData.host = defaultHost._id;
    }

    if (!chaletData.thumbnail && chaletData.images && chaletData.images.length > 0) {
      chaletData.thumbnail = chaletData.images[0];
    }

    const newChalet = await Chalet.create(chaletData);
    const populatedChalet = await Chalet.findById(newChalet._id).populate('host');

    res.status(201).json({ success: true, message: 'Chalet publicado con éxito', data: populatedChalet });
  } catch (error) {
    console.error('Error creating chalet:', error);
    res.status(400).json({ success: false, message: 'Error al publicar chalet', error: error.message });
  }
};

// GET /api/chalets/meta/departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Chalet.distinct('department');
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener departamentos' });
  }
};
