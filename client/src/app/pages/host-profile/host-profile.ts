import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChaletService } from '../../services/chalet.service';
import { AuthService } from '../../services/auth.service';
import { BookingItem, Host, Chalet } from '../../models/chalet.model';
import { ChaletCardComponent } from '../../components/chalet-card/chalet-card';
import { ChatEligibility, MessageService } from '../../services/message.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { BookingService } from '../../services/booking.service';
import { UiDialogService } from '../../services/ui-dialog.service';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-host-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ChaletCardComponent, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './host-profile.html',
  styleUrl: './host-profile.css',
})
export class HostProfileComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chaletService = inject(ChaletService);
  readonly auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  readonly realtime = inject(RealtimeService);
  private chatWidget = inject(ChatWidgetService);
  private bookingService = inject(BookingService);
  private uiDialog = inject(UiDialogService);
  private subs = new Subscription();

  private readonly _host = signal<(Host & { chalets: Chalet[]; chaletsCount: number }) | null>(null);
  get host(): (Host & { chalets: Chalet[]; chaletsCount: number }) | null {
    return this._host();
  }
  set host(value: (Host & { chalets: Chalet[]; chaletsCount: number }) | null) {
    this._host.set(value);
  }
  isLoading = true;
  chatEligibility: ChatEligibility = { chatEnabled: false, appointmentStatus: 'none', appointment: null };
  hostChatLockHint = '';

  // Citas y reservas recibidas en el perfil del propietario
  hostBookings: BookingItem[] = [];
  isLoadingHostBookings = false;
  hostBookingFilter: 'pendiente' | 'confirmada' | 'all' = 'pendiente';
  updatingBookingId: string | null = null;
  bookingActionFeedback = '';
  bookingActionError = '';

  // Edit Own Host Profile Modal
  showEditProfileModal = false;
  editName = '';
  editPhone = '';
  editBio = '';
  editResponseTime = '';
  editRole: 'guest' | 'host' = 'guest';
  isSavingProfile = false;
  profileSaveError = '';

  ngOnInit(): void {
    this.subs.add(
      this.route.paramMap.subscribe((params) => {
        const id = params.get('id');
        if (id) {
          this.loadHost(id);
        } else {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      })
    );

    this.subs.add(
      this.realtime.bookingEvents$.subscribe(({ booking }) => {
        if (!this.host || !this.auth.isAuthenticated()) return;

        if (!this.isOwnProfile) {
          this.loadChatEligibility();
          return;
        }

        if (booking?._id && this.isHostedBookingForOwner(booking)) {
          const exists = this.hostBookings.some((item) => item._id === booking._id);
          if (!exists) {
            this.hostBookings = [booking, ...this.hostBookings];
          } else {
            this.hostBookings = this.hostBookings.map((item) => (item._id === booking._id ? booking : item));
          }
          this.cdr.markForCheck();
        }
      })
    );

    this.subs.add(
      this.realtime.chaletEvents$?.subscribe((event) => {
        const currentHost = this.host;
        if (!currentHost) return;

        if (event.type === 'updated' && event.chalet) {
          const updated = event.chalet;
          const exists = currentHost.chalets.some((c) => c._id === updated._id);
          if (exists) {
            this.host = {
              ...currentHost,
              chalets: currentHost.chalets.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
            };
            this.cdr.markForCheck();
          }
        } else if (event.type === 'deleted' && event.chaletId) {
          const filtered = currentHost.chalets.filter((c) => c._id !== event.chaletId);
          if (filtered.length !== currentHost.chalets.length) {
            this.host = {
              ...currentHost,
              chalets: filtered,
              chaletsCount: filtered.length,
            };
            this.cdr.markForCheck();
          }
        } else if (event.type === 'created' && event.chalet && event.chalet.host?._id === currentHost._id) {
          if (!currentHost.chalets.some((c) => c._id === event.chalet!._id)) {
            const nextChalets = [event.chalet, ...currentHost.chalets];
            this.host = {
              ...currentHost,
              chalets: nextChalets,
              chaletsCount: nextChalets.length,
            };
            this.cdr.markForCheck();
          }
        }
      })
    );
  }

  get isOwnProfile(): boolean {
    const user = this.auth.user();
    if (!user || !this.host) return false;
    if (user._id && this.host._id && user._id === this.host._id) return true;
    if (user.email && this.host.email && user.email.toLowerCase() === this.host.email.toLowerCase()) return true;
    return false;
  }

  get pendingHostBookingsCount(): number {
    return this.hostBookings.filter((booking) => booking.status === 'pendiente').length;
  }

  get confirmedHostBookingsCount(): number {
    return this.hostBookings.filter((booking) => booking.status === 'confirmada').length;
  }

  get filteredHostBookings(): BookingItem[] {
    if (this.hostBookingFilter === 'all') {
      return this.hostBookings;
    }
    return this.hostBookings.filter((booking) => booking.status === this.hostBookingFilter);
  }

  loadHost(id: string): void {
    this.isLoading = true;
    this.hostBookings = [];
    this.bookingActionFeedback = '';
    this.bookingActionError = '';

    this.chaletService.getHostById(id).subscribe({
      next: (data) => {
        this.host = data;
        this.isLoading = false;
        if (this.auth.isAuthenticated()) {
          if (this.isOwnProfile) {
            this.loadHostBookings();
          } else {
            this.loadChatEligibility();
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando perfil del anfitrión:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadHostBookings(): void {
    if (!this.isOwnProfile || !this.auth.isAuthenticated()) return;
    this.isLoadingHostBookings = true;
    this.bookingActionError = '';

    this.bookingService.getBookings().subscribe({
      next: (res) => {
        this.hostBookings = (res.data || []).filter((booking) => this.isHostedBookingForOwner(booking));
        if (this.pendingHostBookingsCount === 0 && this.hostBookings.length > 0 && this.hostBookingFilter === 'pendiente') {
          this.hostBookingFilter = 'all';
        }
        this.isLoadingHostBookings = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingHostBookings = false;
        this.bookingActionError = err?.error?.message || 'No se pudieron cargar tus citas y reservas.';
        this.cdr.markForCheck();
      },
    });
  }

  private isHostedBookingForOwner(booking: BookingItem): boolean {
    const ownerId = this.host?._id || this.auth.user()?._id;
    const ownerEmail = (this.host?.email || this.auth.user()?.email || '').toLowerCase();
    const hostRef = booking.chalet?.host as unknown as { _id?: string; email?: string } | string | undefined;
    const hostId = typeof hostRef === 'string' ? hostRef : hostRef?._id;
    const hostEmail = typeof hostRef === 'object' && hostRef?.email ? hostRef.email.toLowerCase() : '';

    if (ownerId && hostId) {
      return String(ownerId) === String(hostId);
    }
    if (ownerEmail && hostEmail) {
      return ownerEmail === hostEmail;
    }
    return false;
  }

  updateBookingStatus(booking: BookingItem, status: 'confirmada' | 'cancelada'): void {
    if (!booking._id || this.updatingBookingId) return;
    if (status === 'cancelada') {
      void this.confirmHostCancellation(booking);
      return;
    }

    this.executeHostStatusUpdate(booking, status);
  }

  private async confirmHostCancellation(booking: BookingItem): Promise<void> {
    const chaletTitle = booking.chalet?.title || 'tu chalet';
    const isCita = booking.bookingType === 'cita';
    const accepted = await this.uiDialog.confirm({
      badge: isCita ? 'Cita Recibida' : 'Reserva Recibida',
      title: isCita ? '¿Rechazar esta solicitud de cita?' : '¿Cancelar esta solicitud?',
      message: `Se cancelará la solicitud de ${booking.guestName} en "${chaletTitle}".`,
      subtitle: 'El huésped recibirá la actualización en tiempo real.',
      confirmText: 'Sí, rechazar / cancelar',
      cancelText: 'Volver',
      tone: 'danger',
      icon: 'fa-solid fa-calendar-xmark',
    });

    if (!accepted || !booking._id || this.updatingBookingId) return;
    this.executeHostStatusUpdate(booking, 'cancelada');
  }

  private executeHostStatusUpdate(booking: BookingItem, status: 'confirmada' | 'cancelada'): void {
    this.updatingBookingId = booking._id;
    this.bookingActionFeedback = '';
    this.bookingActionError = '';

    this.bookingService.updateBookingStatus(booking._id, status).subscribe({
      next: (res) => {
        const updated = res.data || { ...booking, status };
        this.hostBookings = this.hostBookings.map((item) => (item._id === booking._id ? updated : item));
        this.updatingBookingId = null;
        this.realtime.refreshCounts();

        if (status === 'confirmada') {
          this.bookingActionFeedback = updated.bookingType === 'cita'
            ? `Cita aceptada para ${updated.guestName}. El chat en la página web ya quedó habilitado.`
            : `Reserva confirmada para ${updated.guestName}.`;
          this.uiDialog.notify({
            tone: 'success',
            title: updated.bookingType === 'cita' ? 'Cita aceptada' : 'Reserva confirmada',
            message: this.bookingActionFeedback,
          });
        } else {
          this.bookingActionFeedback = `Solicitud de ${updated.guestName} cancelada.`;
          this.uiDialog.notify({
            tone: 'info',
            title: 'Solicitud actualizada',
            message: this.bookingActionFeedback,
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.updatingBookingId = null;
        this.bookingActionError = err?.error?.message || 'No se pudo actualizar el estado de la solicitud.';
        this.uiDialog.notify({
          tone: 'error',
          title: 'Error al actualizar',
          message: this.bookingActionError,
        });
        this.cdr.markForCheck();
      },
    });
  }

  openGuestChat(booking: BookingItem): void {
    const guestRef = booking.guest as unknown as { _id?: string } | string | undefined;
    const guestId = typeof guestRef === 'string' ? guestRef : guestRef?._id;
    if (!guestId) return;

    const chaletRef = booking.chalet as unknown as { _id?: string } | string | undefined;
    const chaletId = typeof chaletRef === 'string' ? chaletRef : chaletRef?._id;
    this.chatWidget.openConversation(guestId, chaletId);
  }

  formatCurrency(gtq: number): string {
    return this.chaletService.formatPrice(gtq || 0);
  }

  loadChatEligibility(): void {
    if (!this.host?._id || !this.auth.isAuthenticated()) return;
    this.messageService.getChatEligibility(this.host._id).subscribe({
      next: (eligibility) => {
        this.chatEligibility = eligibility;
        if (eligibility.chatEnabled) {
          this.hostChatLockHint = '';
        }
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  openEditProfile(): void {
    if (!this.host) return;
    this.editName = this.host.name;
    this.editPhone = this.host.phone || '+502 ';
    this.editBio = this.host.bio || '';
    this.editResponseTime = this.host.responseTime || 'menos de 15 min';
    const currentRole = this.auth.user()?.role ?? this.host.role;
    this.editRole = currentRole === 'host' ? 'host' : 'guest';
    this.profileSaveError = '';
    this.showEditProfileModal = true;
  }

  saveProfile(): void {
    if (!this.host || !this.editName.trim() || !this.editPhone.trim()) {
      this.profileSaveError = 'El nombre y el teléfono son obligatorios.';
      return;
    }
    this.isSavingProfile = true;
    this.profileSaveError = '';

    this.auth.updateProfile({
      name: this.editName.trim(),
      phone: this.editPhone.trim(),
      bio: this.editBio.trim(),
      responseTime: this.editResponseTime.trim(),
      ...(this.auth.user()?.role !== 'admin' ? { role: this.editRole } : {}),
    }).subscribe({
      next: () => {
        this.isSavingProfile = false;
        this.showEditProfileModal = false;
        this.chaletService.invalidateCatalogCache();
        this.loadHost(this.host!._id);
      },
      error: (err) => {
        this.isSavingProfile = false;
        this.profileSaveError = err?.error?.message || 'No se pudo actualizar tu perfil.';
        this.cdr.markForCheck();
      },
    });
  }

  openChat(): void {
    if (!this.host) return;
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.isOwnProfile) {
      void this.router.navigate(['/messages']);
      return;
    }
    if (this.chatEligibility.chatEnabled) {
      this.hostChatLockHint = '';
      const targetChaletId = typeof this.chatEligibility.appointment?.chalet === 'string'
        ? this.chatEligibility.appointment.chalet
        : this.chatEligibility.appointment?.chalet?._id || this.host.chalets?.[0]?._id;
      this.chatWidget.openConversation(this.host._id, targetChaletId);
      return;
    }

    this.hostChatLockHint = this.chatEligibility.appointmentStatus === 'pendiente'
      ? `Tu cita con ${this.host.name} está pendiente de aceptación. Cuando la acepte se habilitará el chat en la página web.`
      : `Para habilitar el chat con ${this.host.name}, selecciona uno de sus chalets abajo y solicita una cita. Cuando la acepte podrás chatear aquí.`;
  }
}
