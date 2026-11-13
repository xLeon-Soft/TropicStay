import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import {
  ChatChaletSummary,
  ChatMessage,
  ConversationSummary,
  MessageService,
} from '../../services/message.service';
import { ChaletService } from '../../services/chalet.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { Host } from '../../models/chalet.model';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class MessagesComponent implements OnInit, OnDestroy {
  private readonly messageService = inject(MessageService);
  readonly chaletService = inject(ChaletService);
  readonly realtime = inject(RealtimeService);
  private readonly chatWidget = inject(ChatWidgetService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('threadContainer') private threadContainer?: ElementRef<HTMLDivElement>;

  private readonly subs = new Subscription();
  private queryChaletId?: string;

  readonly conversations = signal<ConversationSummary[]>([]);
  readonly searchTerm = signal('');
  readonly filteredConversations = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const list = this.conversations();
    if (!query) return list;
    return list.filter((conv) => {
      const name = conv.partner?.name?.toLowerCase() || '';
      const chalet = conv.chalet?.title?.toLowerCase() || '';
      const lastMsg = conv.lastMessage?.content?.toLowerCase() || '';
      return name.includes(query) || chalet.includes(query) || lastMsg.includes(query);
    });
  });

  readonly selectedPartner = signal<Host | null>(null);
  readonly selectedChalet = signal<ChatChaletSummary | null>(null);
  readonly chatEnabled = signal(true);
  readonly appointmentStatus = signal<'none' | 'pendiente' | 'confirmada' | 'cancelada'>('confirmada');
  readonly messages = signal<ChatMessage[]>([]);
  readonly draft = signal('');
  readonly isLoading = signal(true);
  readonly isConversationLoading = signal(false);
  readonly isSending = signal(false);
  readonly error = signal('');
  readonly mobileView = signal<'list' | 'thread'>('list');

  constructor() {
    this.chatWidget.enterMessagesPage(this.chatWidget.activePartnerId());
  }

  ngOnInit(): void {
    this.chatWidget.enterMessagesPage(this.selectedPartner()?._id || null);

    this.subs.add(
      this.route.queryParams.subscribe((params) => {
        const targetUserId = params['userId'];
        this.queryChaletId = params['chaletId'];
        if (targetUserId) {
          this.chatWidget.activeFullChatPartnerId.set(targetUserId);
          this.mobileView.set('thread');
        }
        this.loadConversations(false, targetUserId);
      })
    );

    // Immediate real-time message delivery via SSE
    this.subs.add(
      this.realtime.messageEvents$.subscribe((incoming) => {
        const senderId = incoming.sender?._id;
        const recipientId = incoming.recipient?._id;
        const activePartnerId = this.selectedPartner()?._id;

        if (activePartnerId && (senderId === activePartnerId || recipientId === activePartnerId)) {
          this.chatEnabled.set(true);
          if (!this.messages().some((m) => m._id === incoming._id)) {
            this.messages.update((list) => [...list, incoming]);
            if (incoming.chalet && !this.selectedChalet()) {
              this.selectedChalet.set(incoming.chalet);
            }
            this.scrollToBottom();
          }
          if (senderId === activePartnerId) {
            this.loadConversation(activePartnerId, true, this.selectedChalet()?._id || this.queryChaletId);
          }
        }

        this.upsertConversationWithMessage(incoming);
        this.loadConversations(true);
      })
    );

    // Real-time read receipts sync
    this.subs.add(
      this.realtime.readEvents$.subscribe(({ partnerId }) => {
        const activePartnerId = this.selectedPartner()?._id;
        if (activePartnerId && activePartnerId === partnerId) {
          const nowIso = new Date().toISOString();
          this.messages.update((list) =>
            list.map((msg) => (msg.isMine && !msg.readAt ? { ...msg, readAt: nowIso } : msg))
          );
        }
        this.loadConversations(true);
      })
    );

    // Real-time refresh when an appointment is accepted/updated
    this.subs.add(
      this.realtime.bookingEvents$.subscribe(() => {
        this.loadConversations(true);
        const currentPartner = this.selectedPartner();
        if (currentPartner?._id) {
          this.loadConversation(currentPartner._id, true, this.selectedChalet()?._id || this.queryChaletId);
        }
      })
    );

    // Background safety sync
    this.subs.add(
      interval(15000).subscribe(() => {
        this.loadConversations(true);
        const currentPartner = this.selectedPartner();
        if (currentPartner?._id) {
          this.loadConversation(currentPartner._id, true, this.selectedChalet()?._id || this.queryChaletId);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.chatWidget.leaveMessagesPage();
  }

  loadConversations(silent = false, openUserId?: string): void {
    if (!silent && this.conversations().length === 0) {
      this.isLoading.set(true);
    }

    this.messageService.getConversations().subscribe({
      next: (conversations) => {
        const list = conversations || [];
        this.conversations.set(list);
        this.isLoading.set(false);

        const desiredPartnerId =
          openUserId ||
          this.selectedPartner()?._id ||
          this.chatWidget.activePartnerId() ||
          undefined;

        if (desiredPartnerId) {
          const found = list.find((c) => c.partner._id === desiredPartnerId);
          if (found) {
            if (openUserId || !this.selectedPartner()) {
              this.selectConversation(found);
            }
          } else if (openUserId) {
            this.loadConversation(openUserId, false, this.queryChaletId);
          } else if (list.length > 0 && !this.selectedPartner()) {
            this.selectConversation(list[0]);
          }
        } else if (!this.selectedPartner() && list.length > 0) {
          this.selectConversation(list[0]);
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudieron cargar tus conversaciones.');
        this.isLoading.set(false);
      },
    });
  }

  selectConversation(conversation: ConversationSummary): void {
    this.error.set('');
    this.selectedPartner.set(conversation.partner);
    this.selectedChalet.set(conversation.chalet || null);
    this.chatWidget.activeFullChatPartnerId.set(conversation.partner._id);
    this.chatWidget.activePartnerId.set(conversation.partner._id);
    this.chatWidget.activeChaletId.set(conversation.chalet?._id || this.queryChaletId || null);
    this.mobileView.set('thread');

    // Clear unread badge optimistically in left sidebar
    if (conversation.unreadCount > 0) {
      this.conversations.update((list) =>
        list.map((item) =>
          item.partner._id === conversation.partner._id ? { ...item, unreadCount: 0 } : item
        )
      );
    }

    this.loadConversation(conversation.partner._id, false, conversation.chalet?._id || this.queryChaletId);
  }

  loadConversation(userId: string, silent = false, chaletId?: string): void {
    if (!silent) {
      this.isConversationLoading.set(true);
    }

    this.messageService.getConversation(userId, chaletId).subscribe({
      next: ({ partner, chalet, chatEnabled, appointmentStatus, messages }) => {
        this.selectedPartner.set(partner);
        if (chalet) this.selectedChalet.set(chalet);
        const enabled = chatEnabled !== false;
        this.chatEnabled.set(enabled);
        this.appointmentStatus.set(appointmentStatus || (enabled ? 'confirmada' : 'none'));
        this.messages.set(messages || []);
        this.isConversationLoading.set(false);
        this.chatWidget.activeFullChatPartnerId.set(partner._id);
        this.realtime.refreshCounts();
        if (!silent) this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo cargar la conversación.');
        this.isConversationLoading.set(false);
      },
    });
  }

  backToConversationsList(): void {
    this.mobileView.set('list');
  }

  useQuickMessage(kind: 'visit' | 'payment' | 'arrival'): void {
    const partner = this.selectedPartner();
    if (!partner) return;
    const chaletTitle = this.selectedChalet()?.title || 'el chalet';
    if (kind === 'visit') {
      this.draft.set(
        `Hola ${partner.name}, ¡gracias por aceptar la cita! ¿Podrías confirmarme la dirección exacta para nuestra visita en "${chaletTitle}"?`
      );
    } else if (kind === 'payment') {
      this.draft.set(
        `Hola ${partner.name}, me encantó "${chaletTitle}". ¿Cómo coordinamos la reserva y el pago aquí por la plataforma?`
      );
    } else {
      this.draft.set(`Hola ${partner.name}, ¿qué horario de entrada y salida manejan en "${chaletTitle}"?`);
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const partner = this.selectedPartner();
    const content = this.draft().trim();
    if (!partner || !content || !this.chatEnabled() || this.isSending()) return;

    this.isSending.set(true);
    this.error.set('');
    const chaletId = this.selectedChalet()?._id || this.queryChaletId;

    this.messageService.sendMessage(partner._id, content, chaletId).subscribe({
      next: (message) => {
        if (!this.messages().some((m) => m._id === message._id)) {
          this.messages.update((list) => [...list, message]);
        }
        if (message.chalet) this.selectedChalet.set(message.chalet);
        this.draft.set('');
        this.isSending.set(false);
        this.upsertConversationWithMessage(message);
        this.loadConversations(true);
        this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo enviar el mensaje.');
        if (err?.status === 403) {
          this.chatEnabled.set(false);
        }
        this.isSending.set(false);
      },
    });
  }

  minimizeToFloatingDock(): void {
    const partnerId = this.selectedPartner()?._id || null;
    const chaletId = this.selectedChalet()?._id || null;
    this.chatWidget.leaveMessagesPage();
    if (partnerId) {
      this.chatWidget.activePartnerId.set(partnerId);
      this.chatWidget.activeChaletId.set(chaletId);
    }
    this.chatWidget.isOpen.set(true);
    const destination = chaletId ? ['/chalet', chaletId] : ['/explore'];
    void this.router.navigate(destination);
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('es-GT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatSidebarTime(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private upsertConversationWithMessage(incoming: ChatMessage): void {
    const partner = incoming.isMine ? incoming.recipient : incoming.sender;
    if (!partner?._id) return;

    const currentActiveId = this.selectedPartner()?._id;
    const list = this.conversations();
    const existing = list.find((item) => item.partner._id === partner._id);

    if (existing) {
      const updated: ConversationSummary = {
        ...existing,
        lastMessage: incoming,
        chalet: existing.chalet || incoming.chalet || null,
        unreadCount:
          incoming.isMine || currentActiveId === partner._id
            ? 0
            : (existing.unreadCount || 0) + 1,
      };
      this.conversations.set([
        updated,
        ...list.filter((item) => item.partner._id !== partner._id),
      ]);
      return;
    }

    const created: ConversationSummary = {
      partner,
      lastMessage: incoming,
      chalet: incoming.chalet || null,
      chatEnabled: true,
      unreadCount: incoming.isMine || currentActiveId === partner._id ? 0 : 1,
    };
    this.conversations.set([created, ...list]);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.threadContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }
}
