const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Chalet = require('../models/Chalet');

const publicUserFields = 'name avatar role verified superhost responseTime';

const isValidUserId = (value) => mongoose.Types.ObjectId.isValid(value);

const serializeMessage = (message, currentUserId) => {
  const data = message.toObject ? message.toObject() : message;
  const senderId = data.sender?._id || data.sender;
  return {
    ...data,
    isMine: String(senderId) === String(currentUserId),
  };
};

const getPartner = (message, currentUserId) => {
  const senderId = message.sender?._id || message.sender;
  return String(senderId) === String(currentUserId) ? message.recipient : message.sender;
};

exports.getConversations = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { recipient: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .populate('sender recipient', publicUserFields)
      .lean();

    const conversations = new Map();
    for (const message of messages) {
      const partner = getPartner(message, req.user._id);
      if (!partner?._id) continue;

      const partnerId = String(partner._id);
      const existing = conversations.get(partnerId);
      if (!existing) {
        conversations.set(partnerId, {
          partner,
          lastMessage: serializeMessage(message, req.user._id),
          unreadCount: 0,
        });
      }
      if (String(message.recipient?._id || message.recipient) === String(req.user._id) && !message.readAt) {
        conversations.get(partnerId).unreadCount += 1;
      }
    }

    res.json({ success: true, data: [...conversations.values()] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron cargar las conversaciones.' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId) || String(req.user._id) === userId) {
      return res.status(400).json({ success: false, message: 'Conversación no válida.' });
    }

    const partner = await User.findById(userId).select(publicUserFields).lean();
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    await Message.updateMany(
      { sender: userId, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender recipient', publicUserFields);

    res.json({
      success: true,
      data: {
        partner,
        messages: messages.map((message) => serializeMessage(message, req.user._id)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo cargar la conversación.' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content, chaletId } = req.body;
    const cleanContent = typeof content === 'string' ? content.trim() : '';

    if (!isValidUserId(recipientId) || String(req.user._id) === recipientId) {
      return res.status(400).json({ success: false, message: 'Destinatario no válido.' });
    }
    if (!cleanContent || cleanContent.length > 2000) {
      return res.status(400).json({ success: false, message: 'El mensaje debe tener entre 1 y 2000 caracteres.' });
    }

    const recipient = await User.findById(recipientId).select('role').lean();
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Destinatario no encontrado.' });
    }
    if (req.user.role !== 'host' && recipient.role !== 'host') {
      return res.status(403).json({ success: false, message: 'El chat está disponible entre huéspedes y anfitriones.' });
    }

    let chalet = null;
    if (chaletId) {
      if (!mongoose.Types.ObjectId.isValid(chaletId)) {
        return res.status(400).json({ success: false, message: 'Chalet no válido.' });
      }
      chalet = await Chalet.findById(chaletId).select('_id').lean();
      if (!chalet) {
        return res.status(404).json({ success: false, message: 'Chalet no encontrado.' });
      }
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      chalet: chalet?._id || null,
      content: cleanContent,
    });
    await message.populate('sender recipient', publicUserFields);

    res.status(201).json({ success: true, data: serializeMessage(message, req.user._id) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo enviar el mensaje.' });
  }
};
