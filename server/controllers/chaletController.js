const Chalet = require('../models/Chalet');
const User = require('../models/User');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { convertGtqToUsd } = require('../services/currencyService');
const realtimeService = require('../services/realtimeService');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const canManageChalet = (user, chalet) => {
  const hostId = chalet.host?._id || chalet.host;
  return user.role === 'admin' || String(hostId) === String(user._id);
};
const setCatalogCache = (res) => res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLocationArray = (doc) => {
  if (Array.isArray(doc?.location)) {
    const cleaned = doc.location.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
    if (cleaned.length > 0) return cleaned;
  } else if (typeof doc?.location === 'string' && doc.location.trim()) {
    return doc.location.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (typeof doc?.locationName === 'string' && doc.locationName.trim()) {
    return [doc.locationName.trim()];
  }
  const fallback = [doc?.municipality, doc?.department]
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());
  return fallback.length > 0 ? fallback : ['Guatemala'];
};

const normalizeChaletDoc = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const images = Array.isArray(plain.images) ? plain.images.filter(Boolean) : [];
  const { locationName, ...rest } = plain;
  return {
    ...rest,
    location: normalizeLocationArray(plain),
    images,
    thumbnail: plain.thumbnail || images[0] || '',
    amenities: Array.isArray(plain.amenities) ? plain.amenities.filter(Boolean) : [],
    rules: Array.isArray(plain.rules) ? plain.rules.filter(Boolean) : [],
    rating: Number.isFinite(Number(plain.rating)) ? Number(plain.rating) : 4.9,
    reviewsCount: Number.isFinite(Number(plain.reviewsCount)) ? Number(plain.reviewsCount) : 0,
    pricePerNight: Number.isFinite(Number(plain.pricePerNight)) ? Number(plain.pricePerNight) : 0,
  };
};

// GET /api/chalets
exports.getChalets = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
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
      checkIn,
      checkOut,
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
      const amenitiesList = Array.isArray(amenities) ? amenities : amenities.split(',').filter(Boolean);
      if (amenitiesList.length > 0) {
        filter.amenities = { $all: amenitiesList };
      }
    }

    if (checkIn && checkOut) {
      const start = new Date(`${checkIn}T00:00:00`);
      const end = new Date(`${checkOut}T00:00:00`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        const occupiedChaletIds = await Booking.find({
          bookingType: { $ne: 'cita' },
          status: { $in: ['confirmada', 'pendiente'] },
          checkIn: { $lt: end },
          checkOut: { $gt: start },
        }).distinct('chalet');

        filter._id = { $nin: occupiedChaletIds };
        filter.status = { $ne: 'mantenimiento' };
      }
    }

    let query = Chalet.find(filter).populate('host', 'name email phone avatar role verified superhost rating reviewsCount responseTime memberSince bio');

    if (sort === 'price-asc') {
      query = query.sort({ pricePerNight: 1 });
    } else if (sort === 'price-desc') {
      query = query.sort({ pricePerNight: -1 });
    } else if (sort === 'rating-desc') {
      query = query.sort({ rating: -1 });
    } else {
      query = query.sort({ featured: -1, createdAt: -1 });
    }

    const chalets = (await query.lean()).map(normalizeChaletDoc);
    res.json({ success: true, count: chalets.length, data: chalets });
  } catch (error) {
    console.error('Error fetching chalets:', error);
    res.status(500).json({ success: false, message: 'Error al obtener chalets', error: error.message });
  }
};

// GET /api/chalets/:id
exports.getChaletById = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    const chalet = await Chalet.findById(req.params.id).populate('host').lean();
    if (!chalet) {
      return res.status(404).json({ success: false, message: 'Chalet no encontrado' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [reviews, bookedDates] = await Promise.all([
      Review.find({ chalet: chalet._id }).sort({ date: -1 }).lean(),
      Booking.find({
        chalet: chalet._id,
        bookingType: { $ne: 'cita' },
        status: { $in: ['confirmada', 'pendiente'] },
        checkOut: { $gte: today },
      })
        .select('_id checkIn checkOut status')
        .sort({ checkIn: 1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        ...normalizeChaletDoc(chalet),
        reviews,
        bookedDates,
      },
    });
  } catch (error) {
    console.error('Error fetching chalet detail:', error);
    res.status(500).json({ success: false, message: 'Error al obtener detalle del chalet', error: error.message });
  }
};

// GET /api/chalets/:id/booked-dates
exports.getBookedDates = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookedDates = await Booking.find({
      chalet: req.params.id,
      bookingType: { $ne: 'cita' },
      status: { $in: ['confirmada', 'pendiente'] },
      checkOut: { $gte: today },
    })
      .select('_id checkIn checkOut status')
      .sort({ checkIn: 1 })
      .lean();

    return res.json({ success: true, count: bookedDates.length, data: bookedDates });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al consultar fechas ocupadas.' });
  }
};

// POST /api/chalets
exports.createChalet = async (req, res) => {
  try {
    const requestData = { ...req.body };

    // Compatibilidad temporal para clientes que todavía envían el campo anterior.
    if (!requestData.location && requestData.locationName) {
      requestData.location = [requestData.locationName];
    }

    // Actualizar datos de contacto del anfitrión si los proporcionó en el formulario
    let userModified = false;
    if (req.user.role === 'guest') {
      req.user.role = 'host';
      userModified = true;
    }
    if (typeof requestData.hostPhone === 'string' && requestData.hostPhone.trim()) {
      req.user.phone = requestData.hostPhone.trim();
      userModified = true;
    }
    if (typeof requestData.hostBio === 'string' && requestData.hostBio.trim()) {
      req.user.bio = requestData.hostBio.trim();
      userModified = true;
    }
    if (typeof requestData.hostName === 'string' && requestData.hostName.trim() && requestData.hostName.trim() !== 'Propietario Anfitrión') {
      req.user.name = requestData.hostName.trim();
      userModified = true;
    }
    if (userModified) {
      await req.user.save();
    }

    const chaletData = {
      title: requestData.title,
      category: requestData.category,
      department: requestData.department,
      municipality: requestData.municipality,
      location: requestData.location,
      description: requestData.description,
      pricePerNight: requestData.pricePerNight,
      deposit: requestData.deposit ?? 500,
      cleaningFee: requestData.cleaningFee ?? 150,
      guestsMax: requestData.guestsMax,
      bedrooms: requestData.bedrooms,
      beds: requestData.beds,
      bathrooms: requestData.bathrooms,
      images: requestData.images,
      thumbnail: requestData.thumbnail || (requestData.images && requestData.images[0]) || '',
      amenities: requestData.amenities || [],
      rules: requestData.rules || [],
      host: req.user._id,
      featured: req.user.role === 'admin' ? Boolean(requestData.featured) : false,
      status: ['disponible', 'reservado', 'mantenimiento'].includes(requestData.status) ? requestData.status : 'disponible',
      rating: 5.0,
      reviewsCount: 0,
      ratingBreakdown: {
        cleanliness: 5.0,
        accuracy: 5.0,
        communication: 5.0,
        location: 5.0,
        value: 5.0,
      },
    };

    if (
      requestData.coordinates &&
      Number.isFinite(Number(requestData.coordinates.lat)) &&
      Number.isFinite(Number(requestData.coordinates.lng))
    ) {
      chaletData.coordinates = {
        lat: Number(requestData.coordinates.lat),
        lng: Number(requestData.coordinates.lng),
      };
    }

    if (chaletData.pricePerNight !== undefined) {
      const conversion = await convertGtqToUsd(chaletData.pricePerNight);
      chaletData.priceUSD = conversion.amountUSD;
    }

    const newChalet = await Chalet.create(chaletData);
    const populatedChalet = await Chalet.findById(newChalet._id).populate('host');
    const normalized = normalizeChaletDoc(populatedChalet);
    realtimeService.emitToAll('chalet:created', { chalet: normalized });

    res.status(201).json({ success: true, message: 'Chalet publicado con éxito', data: normalized });
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

    let userModified = false;
    if (typeof requestData.hostPhone === 'string' && requestData.hostPhone.trim()) {
      req.user.phone = requestData.hostPhone.trim();
      userModified = true;
    }
    if (typeof requestData.hostBio === 'string' && requestData.hostBio.trim()) {
      req.user.bio = requestData.hostBio.trim();
      userModified = true;
    }
    if (userModified) {
      await req.user.save();
    }

    const editableFields = [
      'title', 'category', 'department', 'municipality', 'location', 'description',
      'pricePerNight', 'deposit', 'cleaningFee', 'guestsMax', 'bedrooms',
      'beds', 'bathrooms', 'images', 'thumbnail', 'amenities', 'rules',
      'status', 'coordinates',
    ];
    if (req.user.role === 'admin') {
      editableFields.push('featured');
    }

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
    const populated = await Chalet.findById(chalet._id).populate('host');
    const data = normalizeChaletDoc(populated);
    realtimeService.emitToAll('chalet:updated', { chalet: data });
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
    realtimeService.emitToAll('chalet:deleted', { chaletId: String(chalet._id) });
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
