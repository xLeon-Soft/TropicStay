const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const messageController = require('../controllers/messageController');
const Booking = require('../models/Booking');
const Chalet = require('../models/Chalet');
const User = require('../models/User');
const Message = require('../models/Message');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function mockFindOneChain(result) {
  return {
    sort() {
      return {
        populate() {
          return {
            lean: async () => result,
          };
        },
      };
    },
  };
}

describe('Módulo de Mensajería - Chat habilitado únicamente con cita aceptada', () => {
  const originals = {};

  beforeEach(() => {
    originals.userFindById = User.findById;
    originals.chaletFindById = Chalet.findById;
    originals.chaletFind = Chalet.find;
    originals.bookingFindOne = Booking.findOne;
    originals.messageCreate = Message.create;
  });

  afterEach(() => {
    User.findById = originals.userFindById;
    Chalet.findById = originals.chaletFindById;
    Chalet.find = originals.chaletFind;
    Booking.findOne = originals.bookingFindOne;
    Message.create = originals.messageCreate;
  });

  it('sendMessage() bloquea enviar mensajes (403) cuando no existe cita aceptada', async () => {
    const guestId = new mongoose.Types.ObjectId();
    const hostId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();

    User.findById = () => ({ select: () => ({ lean: async () => ({ _id: hostId, role: 'host' }) }) });
    Chalet.findById = () => ({ select: () => ({ lean: async () => ({ _id: chaletId }) }) });
    Chalet.find = ({ host }) => ({
      distinct: async () => (String(host) === String(hostId) ? [chaletId] : []),
    });
    Booking.findOne = (filter) => {
      if (filter.status === 'confirmada') return mockFindOneChain(null);
      return mockFindOneChain({ _id: new mongoose.Types.ObjectId(), bookingType: 'cita', status: 'pendiente' });
    };

    const req = {
      user: { _id: guestId },
      body: { recipientId: hostId.toString(), chaletId: chaletId.toString(), content: 'Hola propietario' },
    };
    const res = createMockRes();

    await messageController.sendMessage(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'APPOINTMENT_NOT_ACCEPTED');
    assert.equal(res.body.appointmentStatus, 'pendiente');
  });

  it('sendMessage() permite enviar mensaje (201) cuando la cita fue aceptada (confirmada)', async () => {
    const guestId = new mongoose.Types.ObjectId();
    const hostId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();
    const msgId = new mongoose.Types.ObjectId();

    User.findById = () => ({ select: () => ({ lean: async () => ({ _id: hostId, role: 'host' }) }) });
    Chalet.findById = () => ({ select: () => ({ lean: async () => ({ _id: chaletId }) }) });
    Chalet.find = ({ host }) => ({
      distinct: async () => (String(host) === String(hostId) ? [chaletId] : []),
    });
    Booking.findOne = (filter) => {
      if (filter.status === 'confirmada') {
        return mockFindOneChain({ _id: new mongoose.Types.ObjectId(), bookingType: 'cita', status: 'confirmada' });
      }
      return mockFindOneChain(null);
    };
    Message.create = async (payload) => ({
      _id: msgId,
      ...payload,
      createdAt: new Date().toISOString(),
      populate: async () => {},
      toObject() {
        return {
          _id: this._id,
          sender: this.sender,
          recipient: this.recipient,
          chalet: this.chalet,
          content: this.content,
          createdAt: this.createdAt,
        };
      },
    });

    const req = {
      user: { _id: guestId },
      body: { recipientId: hostId.toString(), chaletId: chaletId.toString(), content: 'Nos vemos el sábado a las 10 AM' },
    };
    const res = createMockRes();

    await messageController.sendMessage(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.content, 'Nos vemos el sábado a las 10 AM');
    assert.equal(res.body.data.isMine, true);
  });
});

