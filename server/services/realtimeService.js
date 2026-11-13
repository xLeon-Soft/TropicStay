/**
 * Lightweight Server-Sent Events (SSE) hub to push bookings, appointment requests,
 * and chat messages in real time to connected users (owners and guests).
 */
class RealtimeService {
  constructor() {
    this.clients = new Map(); // userId -> Set<Response>
    this.publicClients = new Set(); // Set<Response> for unauthenticated catalog/chalet viewers
  }

  addClient(userId, res) {
    const key = String(userId);
    if (!this.clients.has(key)) {
      this.clients.set(key, new Set());
    }
    this.clients.get(key).add(res);
  }

  removeClient(userId, res) {
    const key = String(userId);
    const set = this.clients.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) {
      this.clients.delete(key);
    }
  }

  addPublicClient(res) {
    this.publicClients.add(res);
  }

  removePublicClient(res) {
    this.publicClients.delete(res);
  }

  writeToSet(set, frame, onDisconnect) {
    if (!set || set.size === 0) return 0;
    let delivered = 0;

    for (const res of [...set]) {
      try {
        res.write(frame);
        delivered += 1;
      } catch (_err) {
        onDisconnect(res);
      }
    }
    return delivered;
  }

  emitToUser(userId, eventName, payload) {
    if (!userId) return 0;
    const set = this.clients.get(String(userId));
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    return this.writeToSet(set, frame, (res) => this.removeClient(userId, res));
  }

  emitToAll(eventName, payload) {
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    let delivered = this.writeToSet(this.publicClients, frame, (res) => this.removePublicClient(res));

    for (const [userId, set] of [...this.clients.entries()]) {
      delivered += this.writeToSet(set, frame, (res) => this.removeClient(userId, res));
    }
    return delivered;
  }

  getConnectedUserCount() {
    return this.clients.size + this.publicClients.size;
  }
}

module.exports = new RealtimeService();

