import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ChatWidgetService {
  private readonly router = inject(Router);

  readonly isOpen = signal(false);
  readonly activePartnerId = signal<string | null>(null);
  readonly activeChaletId = signal<string | null>(null);
  readonly prefillDraft = signal('');
  readonly isOnMessagesRoute = signal(false);
  readonly activeFullChatPartnerId = signal<string | null>(null);

  enterMessagesPage(partnerId: string | null = null): void {
    this.isOnMessagesRoute.set(true);
    this.isOpen.set(false);
    this.activeFullChatPartnerId.set(partnerId);
  }

  leaveMessagesPage(): void {
    this.isOnMessagesRoute.set(false);
    this.activeFullChatPartnerId.set(null);
  }

  openList(): void {
    if (this.isOnMessagesRoute()) {
      void this.router.navigate(['/messages']);
      return;
    }
    this.activePartnerId.set(null);
    this.isOpen.set(true);
  }

  openConversation(partnerId: string, chaletId?: string, prefill = ''): void {
    if (!partnerId) return;
    if (this.isOnMessagesRoute()) {
      void this.router.navigate(['/messages'], {
        queryParams: {
          userId: partnerId,
          ...(chaletId ? { chaletId } : {}),
        },
      });
      return;
    }

    this.activePartnerId.set(partnerId);
    this.activeChaletId.set(chaletId || null);
    this.prefillDraft.set(prefill);
    this.isOpen.set(true);
  }

  backToList(): void {
    this.activePartnerId.set(null);
    this.activeChaletId.set(null);
  }

  minimize(): void {
    this.isOpen.set(false);
  }

  expandToFullPage(partnerId?: string | null, chaletId?: string | null): void {
    const targetPartner = partnerId ?? this.activePartnerId();
    const targetChalet = chaletId ?? this.activeChaletId();
    this.isOpen.set(false);
    this.isOnMessagesRoute.set(true);
    if (targetPartner) {
      this.activeFullChatPartnerId.set(targetPartner);
    }

    void this.router.navigate(['/messages'], {
      queryParams: targetPartner
        ? {
            userId: targetPartner,
            ...(targetChalet ? { chaletId: targetChalet } : {}),
          }
        : undefined,
    });
  }
}

