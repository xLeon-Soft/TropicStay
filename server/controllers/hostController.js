const User = require('../models/User');
const Chalet = require('../models/Chalet');
const setPublicCache = (res) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');

// GET /api/hosts
exports.getHosts = async (req, res) => {
  try {
    setPublicCache(res);
    const hosts = await User.find({ role: 'host' }).lean();
    res.json({ success: true, count: hosts.length, data: hosts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener anfitriones' });
  }
};

// GET /api/hosts/:id
exports.getHostById = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const host = await User.findById(req.params.id).lean();
    if (!host) {
      return res.status(404).json({ success: false, message: 'Anfitrión no encontrado' });
    }

    const chalets = await Chalet.find({ host: host._id }).lean();

    res.json({
      success: true,
      data: {
        ...host,
        chalets,
        chaletsCount: chalets.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener anfitrión' });
  }
};
