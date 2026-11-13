const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Chalet = require('../models/Chalet');
const Booking = require('../models/Booking');
const realtimeService = require('../services/realtimeService');

const publicUserFields = 'name email phone avatar role verified superhost responseTime';
const publicChaletFields = 'title thumbnail pricePerNight priceUSD municipality department';

const isValidUserId = (value) => mongoose.Types.ObjectId.isValid(value);

async function getAcceptedPartnersForUser(userId) {
  const hostedChaletIds = await Chalet.find({ host: userId }).distinct('_id');
  const acceptedAppointments = await Booking.find({
    bookingType: 'cita',
    status: 'confirmada',
    $or: [
      { guest: userId },
      ...(hostedChaletIds.length ? [{ chalet: { $in: hostedChaletIds } }] : []),
    ],
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate('guest', publicUserFields)
    .populate({
      path: 'chalet',
      select: `${publicChaletFields} host`,
      populate: { path: 'host', select: publicUserFields },
    })
    .lean();

  const partnerMap = new Map();
  for (const appointment of acceptedAppointments) {
    const guest = appointment.guest;
    const host = appointment.chalet?.host;
    if (!guest?._id || !host?._id) continue;

    const partner = String(guest._id) === String(userId) ? host : guest;
    const partnerId = String(partner._id);
    if (partnerId === String(userId)) continue;

    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        partner,
        chalet: appointment.chalet || null,
        appointment,
      });
    }
  }
  return partnerMap;
}

async function getChatEligibilityBetween(userAId, userBId, chaletId = null) {
  const [chaletsHostedByA, chaletsHostedByB] = await Promise.all([
    Chalet.find({ host: userAId }).distinct('_id'),
    Chalet.find({ host: userBId }).distinct('_id'),
  ]);

  const rolePairs = [];
  if (chaletsHostedByB.length) {
    rolePairs.push({ guest: userAId, chalet: { $in: chaletsHostedByB } });
  }
  if (chaletsHostedByA.length) {
    rolePairs.push({ guest: userBId, chalet: { $in: chaletsHostedByA } });
  }

  if (rolePairs.length === 0) {
    return { chatEnabled: false, appointmentStatus: 'none', appointment: null };
  }

  const baseFilter = {
    bookingType: 'cita',
    $or: rolePairs,
  };
  if (chaletId && mongoose.Types.ObjectId.isValid(chaletId)) {
    baseFilter.chalet = chaletId;
  }

  const accepted = await Booking.findOne({ ...baseFilter, status: 'confirmada' })
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate('chalet', publicChaletFields)
    .lean();
  if (accepted) {
    return { chatEnabled: true, appointmentStatus: 'confirmada', appointment: accepted };
  }

  const latest = await Booking.findOne(baseFilter)
    .sort({ createdAt: -1 })
    .populate('chalet', publicChaletFields)
    .lean();
  if (!latest) {
    return { chatEnabled: false, appointmentStatus: 'none', appointment: null };
  }

  return {
    chatEnabled: false,
    appointmentStatus: latest.status || 'pendiente',
    appointment: latest,
  };
}

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

exports.getUnreadCount = async (req, res) => {
  try {
    const partnerMap = await getAcceptedPartnersForUser(req.user._id);
    const enabledPartnerIds = [...partnerMap.keys()];
    if (enabledPartnerIds.length === 0) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }

    const unreadCount = await Message.countDocuments({
      recipient: req.user._id,
      sender: { $in: enabledPartnerIds },
      readAt: null,
    });
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo consultar mensajes no leídos.' });
  }
};

exports.getChatEligibility = async (req, res) => {
  try {
    const { userId } = req.params;
    const { chaletId } = req.query;

    if (!isValidUserId(userId) || String(req.user._id) === userId) {
      return res.status(400).json({ success: false, message: 'Usuario no válido.' });
    }

    const eligibility = await getChatEligibilityBetween(req.user._id, userId, chaletId);
    res.json({ success: true, data: eligibility });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo verificar el estado del chat.' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const partnerMap = await getAcceptedPartnersForUser(req.user._id);
    const enabledPartnerIds = [...partnerMap.keys()];
    if (enabledPartnerIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: { $in: enabledPartnerIds } },
        { recipient: req.user._id, sender: { $in: enabledPartnerIds } },
      ],
    })
      .sort({ createdAt: -1 })
      .populate('sender recipient', publicUserFields)
      .populate('chalet', publicChaletFields)
      .lean();

    const conversations = new Map();
    for (const [partnerId, entry] of partnerMap.entries()) {
      conversations.set(partnerId, {
        partner: entry.partner,
        lastMessage: null,
        chalet: entry.chalet || null,
        appointment: entry.appointment || null,
        chatEnabled: true,
        unreadCount: 0,
      });
    }

    for (const message of messages) {
      const partner = getPartner(message, req.user._id);
      if (!partner?._id) continue;

      const partnerId = String(partner._id);
      const existing = conversations.get(partnerId);
      if (!existing) continue;

      if (!existing.lastMessage) {
        existing.lastMessage = serializeMessage(message, req.user._id);
      }
      if (!existing.chalet && message.chalet) {
        existing.chalet = message.chalet;
      }

      if (String(message.recipient?._id || message.recipient) === String(req.user._id) && !message.readAt) {
        existing.unreadCount += 1;
      }
    }

    const sorted = [...conversations.values()].sort((a, b) => {
      const dateA = new Date(a.lastMessage?.createdAt || a.appointment?.updatedAt || a.appointment?.createdAt || 0).getTime();
      const dateB = new Date(b.lastMessage?.createdAt || b.appointment?.updatedAt || b.appointment?.createdAt || 0).getTime();
      return dateB - dateA;
    });

    res.json({ success: true, data: sorted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron cargar las conversaciones.' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { chaletId } = req.query;

    if (!isValidUserId(userId) || String(req.user._id) === userId) {
      return res.status(400).json({ success: false, message: 'Conversación no válida.' });
    }

    const partner = await User.findById(userId).select(publicUserFields).lean();
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const eligibility = await getChatEligibilityBetween(req.user._id, userId, chaletId);

    let contextChalet = null;
    if (chaletId && mongoose.Types.ObjectId.isValid(chaletId)) {
      contextChalet = await Chalet.findById(chaletId).select(publicChaletFields).lean();
    } else if (eligibility.appointment?.chalet) {
      contextChalet = eligibility.appointment.chalet;
    }

    if (!eligibility.chatEnabled) {
      return res.json({
        success: true,
        data: {
          partner,
          chalet: contextChalet,
          chatEnabled: false,
          appointmentStatus: eligibility.appointmentStatus,
          appointment: eligibility.appointment,
          messages: [],
        },
      });
    }

    const markResult = await Message.updateMany(
      { sender: userId, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    if (markResult?.modifiedCount > 0) {
      realtimeService.emitToUser(req.user._id, 'messages:read', { partnerId: userId });
      realtimeService.emitToUser(userId, 'messages:read', { partnerId: String(req.user._id) });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender recipient', publicUserFields)
      .populate('chalet', publicChaletFields);

    if (!contextChalet) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].chalet) {
          contextChalet = messages[i].chalet;
          break;
        }
      }
    }

    res.json({
      success: true,
      data: {
        partner,
        chalet: contextChalet,
        chatEnabled: true,
        appointmentStatus: eligibility.appointmentStatus,
        appointment: eligibility.appointment,
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

    const eligibility = await getChatEligibilityBetween(req.user._id, recipientId, chalet?._id || null);
    if (!eligibility.chatEnabled) {
      return res.status(403).json({
        success: false,
        code: 'APPOINTMENT_NOT_ACCEPTED',
        appointmentStatus: eligibility.appointmentStatus,
        message: 'El chat se habilita únicamente cuando solicitas una cita con el propietario y este la acepta.',
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      chalet: chalet?._id || null,
      content: cleanContent,
    });
    await message.populate('sender recipient', publicUserFields);
    await message.populate('chalet', publicChaletFields);

    const serializedForSender = serializeMessage(message, req.user._id);
    const serializedForRecipient = serializeMessage(message, recipientId);

    // Push in real time to recipient and other tabs of sender
    realtimeService.emitToUser(recipientId, 'message:new', { message: serializedForRecipient });
    realtimeService.emitToUser(req.user._id, 'message:new', { message: serializedForSender });

    res.status(201).json({ success: true, data: serializedForSender });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo enviar el mensaje.' });
  }
};
