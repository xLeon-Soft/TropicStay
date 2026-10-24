import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChaletService } from '../../services/chalet.service';
import { Host, Chalet } from '../../models/chalet.model';
import { ChaletCardComponent } from '../../components/chalet-card/chalet-card';
import { MessageService, ChatMessage } from '../../services/message.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-host-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ChaletCardComponent],
  templateUrl: './host-profile.html',
  styleUrl: './host-profile.css'
})
export class HostProfileComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private chaletService = inject(ChaletService);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private chatRefreshSubscription?: Subscription;

  host: (Host & { chalets: Chalet[]; chaletsCount: number }) | null = null;
  isLoading = true;

  // Direct Message Modal
  showMessageModal = false;
  messageText = '';
  messageSent = false;
  chatMessages: ChatMessage[] = [];
  isChatLoading = false;
  isSendingMessage = false;
  chatError = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadHost(id);
    } else {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  loadHost(id: string): void {
    this.isLoading = true;
    this.chaletService.getHostById(id).subscribe({
      next: (data) => {
        this.host = data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando perfil del anfitrión:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopChatRefresh();
  }

  openChat(): void {
    if (!this.host) return;
    this.showMessageModal = true;
    this.chatError = '';
    this.loadConversation();
    this.stopChatRefresh();
    this.chatRefreshSubscription = interval(8000).subscribe(() => this.loadConversation(true));
  }

  closeChat(): void {
    this.showMessageModal = false;
    this.stopChatRefresh();
  }

  loadConversation(silent = false): void {
    if (!this.host) return;
    if (!silent) this.isChatLoading = true;

    this.messageService.getConversation(this.host._id).subscribe({
      next: ({ messages }) => {
        this.chatMessages = messages;
        this.isChatLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.chatError = error?.error?.message || 'No se pudo cargar el chat.';
        this.isChatLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  sendChatMessage(): void {
    if (!this.host || !this.messageText.trim()) return;
    this.isSendingMessage = true;
    this.chatError = '';
    const content = this.messageText.trim();

    this.messageService.sendMessage(this.host._id, content).subscribe({
      next: (message) => {
        this.chatMessages = [...this.chatMessages, message];
        this.messageText = '';
        this.isSendingMessage = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.chatError = error?.error?.message || 'No se pudo enviar el mensaje.';
        this.isSendingMessage = false;
        this.cdr.markForCheck();
      },
    });
  }

  formatMessageTime(value: string): string {
    return new Date(value).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  private stopChatRefresh(): void {
    this.chatRefreshSubscription?.unsubscribe();
    this.chatRefreshSubscription = undefined;
  }

  sendMessage(): void {
    if (!this.host || !this.messageText.trim()) return;

    const cleanPhone = (this.host.phone || '+50255550000').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hola ${this.host.name}, te escribo desde TropicStay Guatemala. ${this.messageText.trim()}`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank', 'noopener');
    this.messageSent = true;
    setTimeout(() => {
      this.showMessageModal = false;
      this.messageSent = false;
      this.messageText = '';
    }, 2500);
  }

  getWhatsAppLink(): string {
    if (!this.host) return '#';
    const cleanPhone = (this.host.phone || '+50255550000').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hola ${this.host.name}, vi tus chalets en TropicStay Guatemala y me gustaría consultar disponibilidad.`);
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }
}
