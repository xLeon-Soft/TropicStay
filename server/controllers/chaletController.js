const Chalet = require('../models/Chalet');
const User = require('../models/User');
const Review = require('../models/Review');
const mongoose = require('mongoose');
const { convertGtqToUsd } = require('../services/currencyService');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const canManageChalet = (user, chalet) => user.role === 'admin' || chalet.host.toString() === user._id.toString();
const setCatalogCache = (res) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/chalets
exports.getChalets = async (req, res) => {
  try {
    setCatalogCache(res);
    const {
      search,
      department,
      municipality,
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
        { location: searchRegex },
        { description: searchRegex },
      ];
    }

    if (department && department !== 'Todos') {
      filter.department = new RegExp(`^${escapeRegExp(department.trim())}$`, 'i');
    }

    if (municipality && municipality !== 'Todos') {
      filter.municipality = new RegExp(`^${escapeRegExp(municipality.trim())}$`, 'i');
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

    let query = Chalet.find(filter).populate('host', 'name avatar verified superhost rating responseTime memberSince');

    if (sort === 'price-asc') {
      query = query.sort({ pricePerNight: 1 });
    } else if (sort === 'price-desc') {
      query = query.sort({ pricePerNight: -1 });
    } else if (sort === 'rating-desc') {
      query = query.sort({ rating: -1 });
    } else {
      query = query.sort({ featured: -1, createdAt: -1 });
    }

    const chalets = await query.lean();
    res.json({ success: true, count: chalets.length, data: chalets });
  } catch (error) {
    console.error('Error fetching chalets:', error);
    res.status(500).json({ success: false, message: 'Error al obtener chalets', error: error.message });
  }
};

// GET /api/chalets/:id
exports.getChaletById = async (req, res) => {
  try {
    setCatalogCache(res);
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    const chalet = await Chalet.findById(req.params.id).populate('host').lean();
    if (!chalet) {
      return res.status(404).json({ success: false, message: 'Chalet no encontrado' });
    }

    const reviews = await Review.find({ chalet: chalet._id }).sort({ date: -1 }).lean();

    res.json({
      success: true,
      data: {
        ...chalet,
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

    // Compatibilidad temporal para clientes que todavía envían el campo anterior.
    if (!chaletData.location && chaletData.locationName) {
      chaletData.location = [chaletData.locationName];
    }
    delete chaletData.locationName;

    // El backend obtiene la tasa actual (con respaldo local si no hay internet).
    if (chaletData.pricePerNight !== undefined) {
      const conversion = await convertGtqToUsd(chaletData.pricePerNight);
      chaletData.priceUSD = conversion.amountUSD;
    }

    // The authenticated account is always the owner. Never trust a host sent
    // from the browser, as that would allow publishing in another user's name.
    chaletData.host = req.user._id;
    if (req.user.role === 'guest') {
      req.user.role = 'host';
      await req.user.save();
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

// PUT /api/chalets/:id - owner or administrator only
exports.updateChalet = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }

    const chalet = await Chalet.findById(req.params.id);
    if (!chalet) return res.status(404).json({ success: false, message: 'Chalet no encontrado.' });
    if (!canManageChalet(req.user, chalet)) {
      return res.status(403).json({ success: false, message: 'No puedes modificar este chalet.' });
    }

    const requestData = { ...req.body };
    if (!requestData.location && requestData.locationName) {
      requestData.location = [requestData.locationName];
    }

    const editableFields = [
      'title', 'category', 'department', 'municipality', 'location', 'description',
      'pricePerNight', 'deposit', 'cleaningFee', 'guestsMax', 'bedrooms',
      'beds', 'bathrooms', 'images', 'thumbnail', 'amenities', 'rules', 'featured',
      'status', 'coordinates',
    ];
    for (const field of editableFields) {
      if (requestData[field] !== undefined) chalet[field] = requestData[field];
    }
    if ((!chalet.thumbnail || !chalet.thumbnail.trim()) && chalet.images?.length) {
      chalet.thumbnail = chalet.images[0];
    }
    if (chalet.isModified('pricePerNight')) {
      const conversion = await convertGtqToUsd(chalet.pricePerNight);
      chalet.priceUSD = conversion.amountUSD;
    }

    await chalet.save();
    const data = await Chalet.findById(chalet._id).populate('host');
    return res.json({ success: true, message: 'Chalet actualizado correctamente.', data });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'No se pudo actualizar el chalet.', error: error.message });
  }
};

// DELETE /api/chalets/:id - owner or administrator only
exports.deleteChalet = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    const chalet = await Chalet.findById(req.params.id);
    if (!chalet) return res.status(404).json({ success: false, message: 'Chalet no encontrado.' });
    if (!canManageChalet(req.user, chalet)) {
      return res.status(403).json({ success: false, message: 'No puedes eliminar este chalet.' });
    }

    await Promise.all([
      Review.deleteMany({ chalet: chalet._id }),
      Chalet.deleteOne({ _id: chalet._id }),
    ]);
    return res.json({ success: true, message: 'Chalet y sus reseñas eliminados correctamente.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo eliminar el chalet.' });
  }
};

// GET /api/chalets/meta/departments
exports.getDepartments = async (req, res) => {
  try {
    setCatalogCache(res);
    const departments = await Chalet.distinct('department');
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener departamentos' });
  }
};

// GET /api/chalets/meta/destinations
exports.getDestinations = async (_req, res) => {
  try {
    setCatalogCache(res);
    const destinations = await Chalet.aggregate([
      {
        $match: {
          municipality: { $type: 'string', $ne: '' },
          category: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: '$municipality',
          categories: { $addToSet: '$category' },
        },
      },
    ]);

    res.json({
      success: true,
      data: destinations
        .map(({ _id, categories }) => ({
          name: _id,
          categories: categories.sort((first, second) => first.localeCompare(second, 'es')),
        }))
        .sort((first, second) => first.name.localeCompare(second.name, 'es')),
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Error al obtener destinos' });
  }
};
