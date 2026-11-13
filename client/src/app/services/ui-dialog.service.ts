import { Injectable, signal } from '@angular/core';

export type UiDialogTone = 'primary' | 'danger' | 'warning';
export type UiToastTone = 'success' | 'error' | 'info' | 'warning';

export interface UiConfirmOptions {
  badge?: string;
  title: string;
  message: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: UiDialogTone;
  icon?: string;
}

export interface UiToastOptions {
  title: string;
  message: string;
  tone?: UiToastTone;
  icon?: string;
  durationMs?: number;
}

export interface ActiveUiConfirm extends Required<Omit<UiConfirmOptions, 'subtitle'>> {
  subtitle: string;
  resolve: (result: boolean) => void;
}

export interface ActiveUiToast extends Required<UiToastOptions> {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class UiDialogService {
  readonly activeConfirm = signal<ActiveUiConfirm | null>(null);
  readonly toasts = signal<ActiveUiToast[]>([]);

  confirm(options: UiConfirmOptions): Promise<boolean> {
    const current = this.activeConfirm();
    if (current) {
      current.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      const tone = options.tone || 'primary';
      const defaultIcon =
        tone === 'danger'
          ? 'fa-solid fa-triangle-exclamation'
          : tone === 'warning'
            ? 'fa-solid fa-circle-exclamation'
            : 'fa-solid fa-circle-check';

      this.activeConfirm.set({
        badge: options.badge || 'TropicStay',
        title: options.title,
        message: options.message,
        subtitle: options.subtitle || '',
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        tone,
        icon: options.icon || defaultIcon,
        resolve,
      });
    });
  }

  resolveConfirm(accepted: boolean): void {
    const current = this.activeConfirm();
    if (!current) return;
    this.activeConfirm.set(null);
    current.resolve(accepted);
  }

  notify(options: UiToastOptions): void {
    const tone = options.tone || 'info';
    const defaultIcon =
      tone === 'success'
        ? 'fa-solid fa-circle-check'
        : tone === 'error'
          ? 'fa-solid fa-circle-xmark'
          : tone === 'warning'
            ? 'fa-solid fa-triangle-exclamation'
            : 'fa-solid fa-circle-info';

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const durationMs = options.durationMs ?? 5500;

    const item: ActiveUiToast = {
      id,
      title: options.title,
      message: options.message,
      tone,
      icon: options.icon || defaultIcon,
      durationMs,
    };

    this.toasts.update((list) => [item, ...list].slice(0, 4));
    if (durationMs > 0) {
      setTimeout(() => this.dismissToast(id), durationMs);
    }
  }

  dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}

