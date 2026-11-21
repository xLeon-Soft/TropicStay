import { Injectable, NgZone, OnDestroy, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BookingService } from './booking.service';
import { ChatMessage, MessageService } from './message.service';
import { ChatWidgetService } from './chat-widget.service';
import { BookingItem, Chalet } from '../models/chalet.model';

export interface ChaletRealtimeEvent {
  type: 'created' | 'updated' | 'deleted';
  chalet?: Chalet;
  chaletId?: string;
}

export interface RealtimeNotification {
  id: string;
  kind: 'booking' | 'message';
  title: string;
  body: string;
  route: string[];
  queryParams?: Record<string, string>;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly messageService = inject(MessageService);
  private readonly chatWidget = inject(ChatWidgetService);
  private readonly zone = inject(NgZone);

  private eventSource: EventSource | null = null;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private activeUserId: string | null = null;
  private streamMode: 'auth' | 'public' | null = null;

  readonly isConnected = signal(false);
  readonly unreadMessages = signal(0);
  readonly pendingHostBookings = signal(0);
  readonly notifications = signal<RealtimeNotification[]>([]);

  readonly messageEvents$ = new Subject<ChatMessage>();
  readonly readEvents$ = new Subject<{ partnerId: string }>();
  readonly bookingEvents$ = new Subject<{ type: 'created' | 'updated'; booking: BookingItem }>();
  readonly bookingDeleted$ = new Subject<{ bookingId: string }>();
  readonly chaletEvents$ = new Subject<ChaletRealtimeEvent>();

  constructor() {
    effect(() => {
      const user = this.auth.user();
      const userId = user?._id || user?.email || null;
      if (userId && this.auth.getToken()) {
        if (this.activeUserId !== userId || this.streamMode !== 'auth' || !this.eventSource) {
          this.activeUserId = userId;
          this.connect('auth');
          this.refreshCounts();
        }
      } else {
        this.activeUserId = null;
        this.unreadMessages.set(0);
        this.pendingHostBookings.set(0);
        this.notifications.set([]);
        if (this.streamMode !== 'public' || !this.eventSource) {
          this.connect('public');
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  refreshCounts(): void {
    if (!this.auth.isAuthenticated()) return;

    this.messageService.getUnreadCount().subscribe({
      next: (count) => this.unreadMessages.set(count),
      error: () => undefined,
    });

    this.bookingService.getSummary().subscribe({
      next: (res) => this.pendingHostBookings.set(res.data?.pendingHostCount || 0),
      error: () => undefined,
    });
  }

  dismissNotification(id: string): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private pushNotification(notification: Omit<RealtimeNotification, 'id' | 'createdAt'>): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: RealtimeNotification = {
      ...notification,
      id,
      createdAt: new Date(),
    };
    this.notifications.update((list) => [item, ...list].slice(0, 4));
    setTimeout(() => this.dismissNotification(id), 10000);
  }

  private connect(mode: 'auth' | 'public' = 'auth'): void {
    if (typeof EventSource === 'undefined') return;
    this.disconnect();

    let streamUrl = `${environment.apiBaseUrl}/events/public-stream`;
    if (mode === 'auth') {
      const token = this.auth.getToken();
      if (!token) {
        mode = 'public';
      } else {
        void this.openAuthenticatedStream(token);
        return;
      }
    }

    this.openEventSource(streamUrl, mode);
  }

  private async openAuthenticatedStream(token: string): Promise<void> {
    const expectedUserId = this.activeUserId;
    const ticket = await this.auth.createStreamTicket?.();
    if (this.activeUserId !== expectedUserId) return;

    const streamUrl = ticket
      ? `${environment.apiBaseUrl}/events/stream?ticket=${encodeURIComponent(ticket)}`
      : `${environment.apiBaseUrl}/events/stream?token=${encodeURIComponent(token)}`;
    this.openEventSource(streamUrl, 'auth');
  }

  private openEventSource(streamUrl: string, mode: 'auth' | 'public'): void {
    this.streamMode = mode;
    const source = new EventSource(streamUrl);
    this.eventSource = source;

    source.addEventListener('connected', () => {
      this.zone.run(() => {
        this.isConnected.set(true);
      });
    });

    source.addEventListener('message:new', (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse(event.data);
          const msg: ChatMessage = payload.message;
          this.messageEvents$.next(msg);

          if (!msg.isMine) {
            this.refreshCounts();
            const readingInFullChat =
              this.chatWidget.isOnMessagesRoute() &&
              this.chatWidget.activeFullChatPartnerId() === msg.sender?._id;
            const readingInMiniDock =
              this.chatWidget.isOpen() &&
              this.chatWidget.activePartnerId() === msg.sender?._id;

            if (!readingInFullChat && !readingInMiniDock && !msg.content.startsWith('🗓️ ¡Hola! Quisiera pedir una CITA')) {
              const senderName = msg.sender?.name || 'Nuevo usuario';
              const chaletName = msg.chalet?.title ? ` (${msg.chalet.title})` : '';
              this.pushNotification({
                kind: 'message',
                title: `Nuevo mensaje de ${senderName}${chaletName}`,
                body: msg.content.length > 90 ? `${msg.content.slice(0, 90)}...` : msg.content,
                route: ['/messages'],
                queryParams: {
                  userId: msg.sender?._id || '',
                  ...(msg.chalet?._id ? { chaletId: msg.chalet._id } : {}),
                },
              });
            }
          }
        } catch {
          // ignore malformed payload
        }
      });
    });

    source.addEventListener('messages:read', (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse(event.data || '{}');
          if (payload?.partnerId) {
            this.readEvents$.next({ partnerId: String(payload.partnerId) });
          }
        } catch {
          // ignore
        }
        this.refreshCounts();
      });
    });

    source.addEventListener('booking:created', (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse(event.data);
          const booking: BookingItem = payload.booking;
          this.bookingEvents$.next({ type: 'created', booking });
          this.refreshCounts();

          const currentUserId = this.auth.user()?._id;
          const hostId = booking.chalet?.host?._id;
          if (currentUserId && hostId && String(currentUserId) === String(hostId)) {
            const kindText = booking.bookingType === 'cita' ? 'Solicitud de cita / visita' : 'Nueva solicitud de alquiler';
            const chaletTitle = booking.chalet?.title || 'tu chalet';
            this.pushNotification({
              kind: 'booking',
              title: `${kindText} en ${chaletTitle}`,
              body: `${booking.guestName} solicita atención. Haz clic para revisar y confirmar.`,
              route: ['/bookings'],
              queryParams: { tab: 'host' },
            });
          }
        } catch {
          // ignore
        }
      });
    });

    source.addEventListener('booking:updated', (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse(event.data);
          const booking: BookingItem = payload.booking;
          this.bookingEvents$.next({ type: 'updated', booking });
          this.refreshCounts();

          const currentUserId = this.auth.user()?._id;
          const guestId = booking.guest?._id;
          if (currentUserId && guestId && String(currentUserId) === String(guestId)) {
            const chaletTitle = booking.chalet?.title || 'tu chalet';
            const isAcceptedCita = booking.bookingType === 'cita' && booking.status === 'confirmada';
            const statusText = booking.status === 'confirmada' ? 'CONFIRMADA ✅' : booking.status === 'cancelada' ? 'CANCELADA ❌' : 'PENDIENTE ⏳';
            this.pushNotification({
              kind: isAcceptedCita ? 'message' : 'booking',
              title: isAcceptedCita
                ? `¡Cita aceptada en ${chaletTitle}!`
                : `Actualización en ${chaletTitle}`,
              body: isAcceptedCita
                ? 'El propietario aceptó tu cita. Tu chat directo ya está habilitado.'
                : `El propietario actualizó tu solicitud a: ${statusText}`,
              route: isAcceptedCita ? ['/messages'] : ['/bookings'],
              queryParams: isAcceptedCita && booking.chalet?.host?._id
                ? { userId: booking.chalet.host._id, ...(booking.chalet._id ? { chaletId: booking.chalet._id } : {}) }
                : { tab: 'guest' },
            });
          }
        } catch {
          // ignore
        }
      });
    });

    source.addEventListener('booking:deleted', (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse(event.data || '{}');
          const bookingId = payload?.bookingId ? String(payload.bookingId) : '';
          if (bookingId) {
            this.bookingDeleted$.next({ bookingId });
            this.refreshCounts();
          }
        } catch {
          // ignore
        }
      });
    });

    const bindChaletEvent = (eventName: 'chalet:created' | 'chalet:updated' | 'chalet:deleted', type: ChaletRealtimeEvent['type']) => {
      source.addEventListener(eventName, (event: MessageEvent) => {
        this.zone.run(() => {
          try {
            const payload = JSON.parse(event.data || '{}');
            this.chaletEvents$.next({
              type,
              chalet: payload.chalet,
              chaletId: payload.chaletId || payload.chalet?._id,
            });
          } catch {
            // ignore
          }
        });
      });
    };

    bindChaletEvent('chalet:created', 'created');
    bindChaletEvent('chalet:updated', 'updated');
    bindChaletEvent('chalet:deleted', 'deleted');

    source.onerror = () => {
      this.zone.run(() => {
        this.isConnected.set(false);
        this.disconnect();
        const nextMode: 'auth' | 'public' =
          this.auth.isAuthenticated() && this.auth.getToken() ? 'auth' : 'public';
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(nextMode), 5000);
      });
    };
  }

  private disconnect(): void {
    clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.streamMode = null;
    this.isConnected.set(false);
  }
}

