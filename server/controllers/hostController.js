const User = require('../models/User');
const Chalet = require('../models/Chalet');

// GET /api/hosts
exports.getHosts = async (req, res) => {
  try {
    const hosts = await User.find({ role: 'host' });
    res.json({ success: true, count: hosts.length, data: hosts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener anfitriones' });
  }
};

// GET /api/hosts/:id
exports.getHostById = async (req, res) => {
  try {
    const host = await User.findById(req.params.id);
    if (!host) {
      return res.status(404).json({ success: false, message: 'Anfitrión no encontrado' });
    }

    const chalets = await Chalet.find({ host: host._id });

    res.json({
      success: true,
      data: {
        ...host.toObject(),
        chalets,
        chaletsCount: chalets.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener anfitrión' });
  }
};
