import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import {
  ChatChaletSummary,
  ChatMessage,
  ConversationSummary,
  MessageService,
} from '../../services/message.service';
import { RealtimeService } from '../../services/realtime.service';
import { Host } from '../../models/chalet.model';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-chat-dock',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './chat-dock.html',
  styleUrl: './chat-dock.css',
})
export class ChatDockComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly chatWidget = inject(ChatWidgetService);
  readonly realtime = inject(RealtimeService);
  private readonly messageService = inject(MessageService);

  @ViewChild('dockThread') private threadRef?: ElementRef<HTMLDivElement>;

  readonly conversations = signal<ConversationSummary[]>([]);
  readonly selectedPartner = signal<Host | null>(null);
  readonly selectedChalet = signal<ChatChaletSummary | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly chatEnabled = signal(true);
  readonly appointmentStatus = signal<'none' | 'pendiente' | 'confirmada' | 'cancelada'>('confirmada');
  readonly isListLoading = signal(false);
  readonly isThreadLoading = signal(false);
  readonly isSending = signal(false);
  readonly error = signal('');
  readonly avatarPreviews = computed(() => this.conversations().slice(0, 3));

  draft = '';

  private messageSub: Subscription;
  private bookingSub: Subscription;
  private readSub: Subscription;
  private loadedPartnerKey: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      const isOpen = this.chatWidget.isOpen();
      const partnerId = this.chatWidget.activePartnerId();
      const chaletId = this.chatWidget.activeChaletId();
      const onMessages = this.chatWidget.isOnMessagesRoute();

      if (!user || onMessages) {
        this.loadedPartnerKey = null;
        return;
      }

      this.loadConversations(true);

      if (isOpen && partnerId) {
        const key = `${partnerId}:${chaletId || ''}`;
        if (this.loadedPartnerKey !== key) {
          this.loadedPartnerKey = key;
          const prefill = this.chatWidget.prefillDraft();
          if (prefill) {
            this.draft = prefill;
            this.chatWidget.prefillDraft.set('');
          }
          this.loadThread(partnerId, chaletId || undefined);
        }
      } else {
        this.loadedPartnerKey = null;
      }
    });

    this.messageSub = this.realtime.messageEvents$.subscribe((incoming) => {
      if (!this.auth.isAuthenticated() || this.chatWidget.isOnMessagesRoute()) {
        return;
      }

      const activePartnerId = this.chatWidget.activePartnerId();
      const senderId = incoming.sender?._id;
      const recipientId = incoming.recipient?._id;

      if (
        this.chatWidget.isOpen() &&
        activePartnerId &&
        (senderId === activePartnerId || recipientId === activePartnerId)
      ) {
        this.chatEnabled.set(true);
        if (!this.messages().some((m) => m._id === incoming._id)) {
          this.messages.update((list) => [...list, incoming]);
          this.scrollToBottom();
        }
        if (senderId === activePartnerId) {
          this.loadThread(
            activePartnerId,
            this.selectedChalet()?._id || this.chatWidget.activeChaletId() || undefined,
            true
          );
        }
      }

      this.loadConversations(true);
    });

    this.bookingSub = this.realtime.bookingEvents$.subscribe(() => {
      if (!this.auth.isAuthenticated() || this.chatWidget.isOnMessagesRoute()) {
        return;
      }
      this.loadConversations(true);
      const activePartnerId = this.chatWidget.activePartnerId();
      if (this.chatWidget.isOpen() && activePartnerId) {
        this.loadThread(activePartnerId, this.chatWidget.activeChaletId() || undefined, true);
      }
    });

    this.readSub = this.realtime.readEvents$.subscribe(({ partnerId }) => {
      if (this.chatWidget.isOnMessagesRoute()) return;
      if (this.chatWidget.isOpen() && this.chatWidget.activePartnerId() === partnerId) {
        const nowIso = new Date().toISOString();
        this.messages.update((list) =>
          list.map((msg) => (msg.isMine && !msg.readAt ? { ...msg, readAt: nowIso } : msg))
        );
      }
      if (this.auth.isAuthenticated()) {
        this.loadConversations(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.messageSub.unsubscribe();
    this.bookingSub.unsubscribe();
    this.readSub.unsubscribe();
  }

  get shouldShowDock(): boolean {
    return this.auth.isAuthenticated() && !this.chatWidget.isOnMessagesRoute();
  }

  toggleDock(): void {
    if (this.chatWidget.isOpen()) {
      this.chatWidget.minimize();
    } else {
      this.chatWidget.openList();
      this.loadConversations();
    }
  }

  openConversation(conv: ConversationSummary): void {
    this.error.set('');
    this.chatWidget.openConversation(conv.partner._id, conv.chalet?._id);
  }

  backToList(): void {
    this.error.set('');
    this.loadedPartnerKey = null;
    this.chatWidget.backToList();
    this.loadConversations(true);
  }

  expandFullChat(): void {
    this.chatWidget.expandToFullPage(
      this.chatWidget.activePartnerId(),
      this.selectedChalet()?._id || this.chatWidget.activeChaletId()
    );
  }

  loadConversations(silent = false): void {
    if (!this.auth.isAuthenticated() || this.chatWidget.isOnMessagesRoute()) return;
    if (!silent) this.isListLoading.set(true);
    this.messageService.getConversations().subscribe({
      next: (list) => {
        this.conversations.set(list);
        this.isListLoading.set(false);
      },
      error: () => {
        this.isListLoading.set(false);
      },
    });
  }

  loadThread(partnerId: string, chaletId?: string, silent = false): void {
    if (!silent) {
      this.isThreadLoading.set(true);
      this.error.set('');
    }
    this.messageService.getConversation(partnerId, chaletId).subscribe({
      next: ({ partner, chalet, chatEnabled, appointmentStatus, messages }) => {
        this.selectedPartner.set(partner);
        this.selectedChalet.set(chalet || null);
        this.chatEnabled.set(chatEnabled !== false);
        this.appointmentStatus.set(appointmentStatus || (this.chatEnabled() ? 'confirmada' : 'none'));
        this.messages.set(messages || []);
        this.isThreadLoading.set(false);
        this.realtime.refreshCounts();
        this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo cargar la conversación.');
        this.isThreadLoading.set(false);
      },
    });
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const partnerId = this.chatWidget.activePartnerId();
    const content = this.draft.trim();
    if (!partnerId || !content || this.isSending() || !this.chatEnabled()) return;

    this.isSending.set(true);
    this.error.set('');
    const chaletId = this.selectedChalet()?._id || this.chatWidget.activeChaletId() || undefined;

    this.messageService.sendMessage(partnerId, content, chaletId).subscribe({
      next: (msg) => {
        if (!this.messages().some((m) => m._id === msg._id)) {
          this.messages.update((list) => [...list, msg]);
        }
        if (msg.chalet) this.selectedChalet.set(msg.chalet);
        this.draft = '';
        this.isSending.set(false);
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

  formatShortTime(value: string): string {
    return new Date(value).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.threadRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }
}
