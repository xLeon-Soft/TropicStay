import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ConversationSummary, ChatMessage, MessageService } from '../../services/message.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class MessagesComponent implements OnInit, OnDestroy {
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private refreshSubscription?: Subscription;

  conversations: ConversationSummary[] = [];
  selectedConversation: ConversationSummary | null = null;
  messages: ChatMessage[] = [];
  draft = '';
  isLoading = true;
  isConversationLoading = false;
  isSending = false;
  error = '';

  ngOnInit(): void {
    this.loadConversations();
    this.refreshSubscription = interval(8000).subscribe(() => {
      this.loadConversations(true);
      if (this.selectedConversation) this.loadConversation(this.selectedConversation.partner._id, true);
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  loadConversations(silent = false): void {
    if (!silent) this.isLoading = true;
    this.messageService.getConversations().subscribe({
      next: (conversations) => {
        this.conversations = conversations;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.error = error?.error?.message || 'No se pudieron cargar tus conversaciones.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  selectConversation(conversation: ConversationSummary): void {
    this.selectedConversation = conversation;
    this.loadConversation(conversation.partner._id);
  }

  loadConversation(userId: string, silent = false): void {
    if (!silent) this.isConversationLoading = true;
    this.messageService.getConversation(userId).subscribe({
      next: ({ messages }) => {
        this.messages = messages;
        this.isConversationLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.error = error?.error?.message || 'No se pudo cargar la conversación.';
        this.isConversationLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  send(): void {
    if (!this.selectedConversation || !this.draft.trim()) return;
    const content = this.draft.trim();
    this.isSending = true;
    this.messageService.sendMessage(this.selectedConversation.partner._id, content).subscribe({
      next: (message) => {
        this.messages = [...this.messages, message];
        this.draft = '';
        this.isSending = false;
        this.loadConversations(true);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.error = error?.error?.message || 'No se pudo enviar el mensaje.';
        this.isSending = false;
        this.cdr.markForCheck();
      },
    });
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
