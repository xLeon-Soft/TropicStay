import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingService } from '../../services/booking.service';
import { ChaletService } from '../../services/chalet.service';
import { AuthService } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { UiDialogService } from '../../services/ui-dialog.service';
import { BookingItem } from '../../models/chalet.model';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css',
})
export class BookingsComponent implements OnInit, OnDestroy {
  private readonly bookingService = inject(BookingService);
  readonly chaletService = inject(ChaletService);
  readonly auth = inject(AuthService);
  readonly realtime = inject(RealtimeService);
  private readonly chatWidget = inject(ChatWidgetService);
  private readonly uiDialog = inject(UiDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private realtimeSub?: Subscription;
  private highlightTimer?: ReturnType<typeof setTimeout>;

  allBookings: BookingItem[] = [];
  isLoading = true;
  error = '';
  updatingBookingId = '';
  highlightedBookingId = '';

  activeTab: 'guest' | 'host' = 'guest';
  statusFilter: 'all' | 'confirmada' | 'pendiente' | 'cancelada' = 'all';

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'host' || params['tab'] === 'guest') {
        this.activeTab = params['tab'];
      }
    });
    this.loadBookings();

    // Update bookings list in real time when a guest sends a request/appointment or host confirms
    this.realtimeSub = this.realtime.bookingEvents$.subscribe(({ booking }) => {
      if (!booking?._id) return;
      const exists = this.allBookings.some((b) => b._id === booking._id);
      if (!exists) {
        this.allBookings = [booking, ...this.allBookings];
        if (this.isMyHostedBooking(booking) && !this.route.snapshot.queryParams['tab']) {
          this.activeTab = 'host';
        }
      } else {
        this.allBookings = this.allBookings.map((item) => (item._id === booking._id ? booking : item));
      }

      this.highlightedBookingId = booking._id;
      clearTimeout(this.highlightTimer);
      this.highlightTimer = setTimeout(() => {
        if (this.highlightedBookingId === booking._id) {
          this.highlightedBookingId = '';
          this.cdr.markForCheck();
        }
      }, 4500);

      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.highlightTimer);
    this.realtimeSub?.unsubscribe();
  }

  loadBookings(): void {
    this.isLoading = true;
    this.error = '';
    this.bookingService.getBookings().subscribe({
      next: (res) => {
        this.allBookings = res.data || [];
        if (this.guestBookings.length === 0 && this.hostBookings.length > 0 && !this.route.snapshot.queryParams['tab']) {
          this.activeTab = 'host';
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar tus reservaciones.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  isMyGuestBooking(booking: BookingItem): boolean {
    const user = this.auth.user();
    if (!user || !booking) return false;
    const guestRef = booking.guest as any;
    const guestId = typeof guestRef === 'string' ? guestRef : guestRef?._id;
    if (user._id && guestId) {
      return String(guestId) === String(user._id);
    }
    const email = user.email?.toLowerCase();
    return Boolean(email && (guestRef?.email?.toLowerCase() === email || booking.guestEmail?.toLowerCase() === email));
  }

  isMyHostedBooking(booking: BookingItem): boolean {
    const user = this.auth.user();
    if (!user || !booking) return false;
    if (user.role === 'admin' && !this.isMyGuestBooking(booking)) {
      return true;
    }
    const hostRef = booking.chalet?.host as any;
    const hostId = typeof hostRef === 'string' ? hostRef : hostRef?._id;
    if (user._id && hostId) {
      return String(hostId) === String(user._id);
    }
    const email = user.email?.toLowerCase();
    return Boolean(email && hostRef?.email?.toLowerCase() === email);
  }

  get guestBookings(): BookingItem[] {
    return this.allBookings.filter((b) => this.isMyGuestBooking(b));
  }

  get hostBookings(): BookingItem[] {
    return this.allBookings.filter((b) => this.isMyHostedBooking(b));
  }

  get pendingHostCount(): number {
    return this.hostBookings.filter((b) => b.status === 'pendiente').length;
  }

  get filteredBookings(): BookingItem[] {
    const source = this.activeTab === 'guest' ? this.guestBookings : this.hostBookings;
    if (this.statusFilter === 'all') return source;
    return source.filter((b) => b.status === this.statusFilter);
  }

  setTab(tab: 'guest' | 'host'): void {
    this.activeTab = tab;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  changeStatus(booking: BookingItem, status: 'confirmada' | 'pendiente' | 'cancelada'): void {
    if (this.updatingBookingId) return;
    if (status === 'cancelada') {
      void this.confirmCancellation(booking);
      return;
    }

    this.executeStatusChange(booking, status);
  }

  private async confirmCancellation(booking: BookingItem): Promise<void> {
    const chaletTitle = booking.chalet?.title || 'este chalet';
    const isCita = booking.bookingType === 'cita';
    const accepted = await this.uiDialog.confirm({
      badge: isCita ? 'Cita / Visita al Chalet' : 'Solicitud de Alquiler',
      title: isCita ? '¿Cancelar esta cita programada?' : '¿Confirmas que deseas cancelar esta solicitud?',
      message: `Estás a punto de cancelar tu solicitud en "${chaletTitle}".`,
      subtitle: 'El cambio se reflejará en tiempo real para ti y para el propietario.',
      confirmText: 'Sí, cancelar solicitud',
      cancelText: 'Mantener solicitud',
      tone: 'danger',
      icon: 'fa-solid fa-calendar-xmark',
    });

    if (!accepted || this.updatingBookingId) return;
    this.executeStatusChange(booking, 'cancelada');
  }

  private executeStatusChange(booking: BookingItem, status: 'confirmada' | 'pendiente' | 'cancelada'): void {
    this.updatingBookingId = booking._id;
    this.bookingService.updateBookingStatus(booking._id, status).subscribe({
      next: (res) => {
        this.allBookings = this.allBookings.map((item) => (item._id === booking._id ? res.data : item));
        this.updatingBookingId = '';
        this.realtime.refreshCounts();
        this.uiDialog.notify({
          tone: status === 'cancelada' ? 'info' : 'success',
          title: status === 'confirmada'
            ? (booking.bookingType === 'cita' ? 'Cita aceptada' : 'Reserva confirmada')
            : status === 'cancelada'
              ? 'Solicitud cancelada'
              : 'Solicitud actualizada',
          message: status === 'confirmada' && booking.bookingType === 'cita'
            ? 'El chat en la página web ya quedó habilitado en tiempo real.'
            : `El estado de "${booking.chalet?.title || 'tu solicitud'}" se actualizó en tiempo real.`,
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.uiDialog.notify({
          tone: 'error',
          title: 'No se pudo actualizar',
          message: err?.error?.message || 'No se pudo actualizar el estado de la solicitud.',
        });
        this.updatingBookingId = '';
        this.cdr.markForCheck();
      },
    });
  }

  canChatForBooking(booking: BookingItem): boolean {
    if (booking.bookingType === 'cita' && booking.status === 'confirmada') {
      return true;
    }
    const guestId = booking.guest?._id;
    const hostId = booking.chalet?.host?._id;
    const chaletId = booking.chalet?._id;
    return this.allBookings.some((item) =>
      item.bookingType === 'cita' &&
      item.status === 'confirmada' &&
      (!chaletId || item.chalet?._id === chaletId) &&
      (!guestId || item.guest?._id === guestId) &&
      (!hostId || item.chalet?.host?._id === hostId)
    );
  }

  openInternalChat(partnerId?: string, chaletId?: string): void {
    if (!partnerId) return;
    this.chatWidget.openConversation(partnerId, chaletId);
  }

  formatDate(value: string): string {
    if (!value) return '';
    const datePart = String(value).trim().slice(0, 10);
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
      ? new Date(`${datePart}T00:00:00`)
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('es-GT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
