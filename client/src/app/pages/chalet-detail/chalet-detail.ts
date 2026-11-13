import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChaletService } from '../../services/chalet.service';
import { BookingService } from '../../services/booking.service';
import { GeolocationService } from '../../services/geolocation.service';
import { ComparisonService } from '../../services/comparison.service';
import { ComparisonModalComponent } from '../../components/comparison-modal/comparison-modal';
import { BookedDateRange, Chalet } from '../../models/chalet.model';
import { ChaletMapComponent } from '../../components/chalet-map/chalet-map';
import { AuthService } from '../../services/auth.service';
import { ChatEligibility, MessageService } from '../../services/message.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { UiDialogService } from '../../services/ui-dialog.service';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

interface CalendarDay {
  value: string;
  label: number;
}

@Component({
  selector: 'app-chalet-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChaletMapComponent, ComparisonModalComponent, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './chalet-detail.html',
  styleUrl: './chalet-detail.css'
})
export class ChaletDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  chaletService = inject(ChaletService);
  bookingService = inject(BookingService);
  geoService = inject(GeolocationService);
  compareService = inject(ComparisonService);
  auth = inject(AuthService);
  private messageService = inject(MessageService);
  private realtime = inject(RealtimeService);
  private chatWidget = inject(ChatWidgetService);
  private uiDialog = inject(UiDialogService);
  private cdr = inject(ChangeDetectorRef);
  private bookingRealtimeSub?: Subscription;
  private chaletRealtimeSub?: Subscription;

  private readonly _chalet = signal<Chalet | null>(null);
  readonly mapChalets = computed(() => {
    const current = this._chalet();
    return current ? [current] : [];
  });
  private readonly _bookedDates = signal<BookedDateRange[]>([]);
  private readonly _isLoading = signal(true);
  private readonly _isUpdatingStatus = signal(false);

  @ViewChild(ChaletMapComponent) chaletMap?: ChaletMapComponent;

  get chalet(): Chalet | null {
    return this._chalet();
  }
  set chalet(value: Chalet | null) {
    this._chalet.set(value);
  }

  get bookedDates(): BookedDateRange[] {
    return this._bookedDates();
  }
  set bookedDates(value: BookedDateRange[]) {
    this._bookedDates.set(value);
  }

  get isLoading(): boolean {
    return this._isLoading();
  }
  set isLoading(value: boolean) {
    this._isLoading.set(value);
  }

  get isUpdatingStatus(): boolean {
    return this._isUpdatingStatus();
  }
  set isUpdatingStatus(value: boolean) {
    this._isUpdatingStatus.set(value);
  }

  selectedImage: string = '';

  // Owner Management State
  isDeletingChalet = false;

  // Booking Widget State
  bookingMode: 'reserva' | 'cita' = 'reserva';
  visitTime: string = '10:00 AM';
  readonly visitTimeSlots = ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'];
  checkInDate: string = '';
  checkOutDate: string = '';
  bookingGuests: number = 2;
  bookingName: string = '';
  bookingEmail: string = '';
  bookingPhone: string = '';
  bookingNotes: string = '';
  showBookingCalendar = false;
  selectingBookingDate: 'checkIn' | 'checkOut' = 'checkIn';
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  readonly calendarWeekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  isBookingSubmitting = false;
  bookingSuccess = false;
  lastCreatedType: 'reserva' | 'cita' = 'reserva';
  bookingError = '';

  // Chat Eligibility State (chat is only enabled once an appointment is accepted by the owner)
  chatEligibility: ChatEligibility = { chatEnabled: false, appointmentStatus: 'none', appointment: null };
  chatLockNotice = '';

  // New Review Form State
  newReviewAuthor: string = '';
  newReviewRating: number = 5;
  newReviewCleanliness: number = 5;
  newReviewAccuracy: number = 5;
  newReviewLocation: number = 5;
  newReviewCommunication: number = 5;
  newReviewValue: number = 5;
  newReviewComment: string = '';
  isReviewSubmitting = false;
  reviewSuccessMessage = '';
  reviewError = '';

  ngOnInit(): void {
    this.initDefaultDates();
    this.prefillAuthenticatedUser();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadChalet(id);
    }

    this.bookingRealtimeSub = this.realtime.bookingEvents$.subscribe(({ booking }) => {
      if (!this.chalet) return;
      if (this.auth.isAuthenticated() && !this.isOwnChalet) {
        this.loadChatEligibility();
      }
        if (booking?.chalet?._id === this.chalet._id) {
        this.chaletService.getChaletById(this.chalet._id).subscribe({
          next: (fresh) => {
            if (fresh?.bookedDates) {
              this.bookedDates = fresh.bookedDates;
              this.cdr.markForCheck();
            }
          },
          error: () => undefined,
        });
      }
    });

    this.chaletRealtimeSub = this.realtime.chaletEvents$?.subscribe((event) => {
      if (!this.chalet) return;
      if (event.type === 'updated' && event.chalet && event.chalet._id === this.chalet._id) {
        this.chalet = {
          ...this.chalet,
          ...event.chalet,
          bookedDates: this.chalet.bookedDates,
          reviews: this.chalet.reviews,
        };
        if (event.chalet.thumbnail || event.chalet.images?.length) {
          const validImages = event.chalet.images || this.chalet.images || [];
          if (!this.selectedImage || (validImages.length > 0 && !validImages.includes(this.selectedImage))) {
            this.selectedImage = event.chalet.thumbnail || validImages[0] || '';
          }
        }
        this.cdr.markForCheck();
      } else if (event.type === 'deleted' && event.chaletId === this.chalet._id) {
        this.router.navigate(['/explore']);
      }
    });
  }

  ngOnDestroy(): void {
    this.bookingRealtimeSub?.unsubscribe();
    this.chaletRealtimeSub?.unsubscribe();
  }

  initDefaultDates(): void {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);

    this.checkInDate = this.toDateValue(today);
    this.checkOutDate = this.toDateValue(tomorrow);
  }

  ensureValidInitialDates(): void {
    if (!this.isDateBooked(this.checkInDate) && !this.hasBookedDaysBetween(this.checkInDate, this.checkOutDate)) {
      return;
    }
    const cursor = new Date();
    for (let offset = 0; offset < 90; offset++) {
      const start = new Date(cursor);
      start.setDate(cursor.getDate() + offset);
      const end = new Date(start);
      end.setDate(start.getDate() + 2);
      const startStr = this.toDateValue(start);
      const endStr = this.toDateValue(end);
      if (!this.isDateBooked(startStr) && !this.hasBookedDaysBetween(startStr, endStr)) {
        this.checkInDate = startStr;
        this.checkOutDate = endStr;
        return;
      }
    }
  }

  resetBookingForAnother(): void {
    this.bookingSuccess = false;
    this.bookingNotes = '';
    this.ensureValidInitialDates();
  }

  get guestOptions(): number[] {
    const max = Math.max(1, this.chalet?.guestsMax || 2);
    return Array.from({ length: max }, (_, idx) => idx + 1);
  }

  get formattedLocation(): string {
    const chalet = this.chalet as (Chalet & { locationName?: string }) | null;
    if (!chalet) return '';
    if (Array.isArray(chalet.location) && chalet.location.length > 0) {
      return chalet.location.filter(Boolean).join(', ');
    }
    if (typeof (chalet as { location?: unknown }).location === 'string' && String(chalet.location).trim()) {
      return String(chalet.location).trim();
    }
    if (typeof chalet.locationName === 'string' && chalet.locationName.trim()) {
      return chalet.locationName.trim();
    }
    return [chalet.municipality, chalet.department].filter(Boolean).join(', ');
  }

  get minBookingDate(): string {
    return this.toDateValue(new Date());
  }

  get calendarMonthLabel(): string {
    return this.calendarMonth.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
  }

  get calendarDays(): CalendarDay[] {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const leadingDays = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: CalendarDay[] = Array.from({ length: leadingDays }, () => ({ value: '', label: 0 }));

    for (let day = 1; day <= totalDays; day++) {
      days.push({ value: this.toDateValue(new Date(year, month, day)), label: day });
    }

    while (days.length % 7 !== 0) days.push({ value: '', label: 0 });
    return days;
  }

  openBookingCalendar(type: 'checkIn' | 'checkOut'): void {
    this.selectingBookingDate = type;
    const selectedDate = type === 'checkIn' ? this.checkInDate : this.checkOutDate;
    const [year, month] = selectedDate.split('-').map(Number);
    this.calendarMonth = new Date(year, month - 1, 1);
    this.showBookingCalendar = true;
  }

  changeCalendarMonth(offset: number): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + offset, 1);
  }

  setBookingMode(mode: 'reserva' | 'cita'): void {
    this.bookingMode = mode;
    this.bookingError = '';
    if (mode === 'cita') {
      this.selectingBookingDate = 'checkIn';
    }
  }

  selectBookingDay(value: string): void {
    if (!value || this.isCalendarDayDisabled(value)) return;

    if (this.bookingMode === 'cita') {
      this.checkInDate = value;
      this.showBookingCalendar = false;
      return;
    }

    if (this.selectingBookingDate === 'checkIn') {
      this.checkInDate = value;
      const nextDay = this.toDateValue(this.addDays(value, 1));
      if (!this.checkOutDate || this.checkOutDate <= value || this.hasBookedDaysBetween(value, this.checkOutDate)) {
        this.checkOutDate = nextDay;
      }
      this.selectingBookingDate = 'checkOut';
      return;
    }

    this.checkOutDate = value;
    this.showBookingCalendar = false;
  }

  isDateBooked(value: string): boolean {
    if (!value || this.bookedDates.length === 0) return false;
    for (const range of this.bookedDates) {
      const start = String(range.checkIn).slice(0, 10);
      const end = String(range.checkOut).slice(0, 10);
      if (value >= start && value < end) {
        return true;
      }
    }
    return false;
  }

  hasBookedDaysBetween(startValue: string, endValue: string): boolean {
    if (!startValue || !endValue || endValue <= startValue) return false;
    for (const range of this.bookedDates) {
      const start = String(range.checkIn).slice(0, 10);
      const end = String(range.checkOut).slice(0, 10);
      if (start < endValue && end > startValue) {
        return true;
      }
    }
    return false;
  }

  isCalendarDayDisabled(value: string): boolean {
    if (!value || value < this.minBookingDate) return true;
    if (this.bookingMode === 'cita') {
      return false;
    }
    if (this.selectingBookingDate === 'checkIn') {
      return this.isDateBooked(value);
    }
    if (value <= this.checkInDate) return true;
    return this.hasBookedDaysBetween(this.checkInDate, value);
  }

  isDateInSelectedRange(value: string): boolean {
    return Boolean(value && this.checkInDate && this.checkOutDate && value > this.checkInDate && value < this.checkOutDate);
  }

  formatBookingDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-GT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  private addDays(value: string, days: number): Date {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date;
  }

  private toDateValue(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private prefillAuthenticatedUser(): void {
    const user = this.auth.user();
    if (!user) return;
    this.bookingName = user.name;
    this.bookingEmail = user.email;
    if (user.phone && user.phone !== '+502 5555-0000') {
      this.bookingPhone = user.phone;
    }
    this.newReviewAuthor = user.name;
  }

  loadChalet(id: string): void {
    this.isLoading = true;
    this.chaletService.getChaletById(id).subscribe({
      next: (data) => {
        const legacyData = data as Chalet & { locationName?: string };
        const rawLoc = (legacyData as { location?: string[] | string }).location;
        const normalizedLocation = Array.isArray(rawLoc) && rawLoc.length > 0
          ? rawLoc.filter(Boolean)
          : typeof rawLoc === 'string' && rawLoc.trim()
            ? rawLoc.split(',').map(part => part.trim()).filter(Boolean)
            : typeof legacyData.locationName === 'string' && legacyData.locationName.trim()
              ? [legacyData.locationName.trim()]
              : [data.municipality, data.department].filter(Boolean);
        const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
        this.chalet = {
          ...data,
          location: normalizedLocation,
          images,
          thumbnail: data.thumbnail || images[0] || '',
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          rules: Array.isArray(data.rules) ? data.rules : [],
        };
        this.bookedDates = data.bookedDates || [];
        this.selectedImage = this.chalet.thumbnail || this.chalet.images[0] || '';
        this.bookingGuests = Math.min(this.bookingGuests, Math.max(1, data.guestsMax || 1));
        this.ensureValidInitialDates();
        this.isLoading = false;
        if (this.auth.isAuthenticated() && !this.isOwnChalet) {
          this.loadChatEligibility();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando chalet:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectImage(img: string): void {
    this.selectedImage = img;
  }

  get canManageChalet(): boolean {
    const user = this.auth.user();
    if (!user || !this.chalet?.host) return false;
    if (user.role === 'admin') return true;
    if (user._id && this.chalet.host._id && user._id === this.chalet.host._id) return true;
    if (user.email && this.chalet.host.email && user.email.toLowerCase() === this.chalet.host.email.toLowerCase()) return true;
    return false;
  }

  get isOwnChalet(): boolean {
    const user = this.auth.user();
    if (!user || !this.chalet?.host) return false;
    if (user._id && this.chalet.host._id && user._id === this.chalet.host._id) return true;
    if (user.email && this.chalet.host.email && user.email.toLowerCase() === this.chalet.host.email.toLowerCase()) return true;
    return false;
  }

  updateChaletStatus(newStatus: string): void {
    if (!this.chalet || this.isUpdatingStatus) return;
    this.isUpdatingStatus = true;
    this.chaletService.updateChalet(this.chalet._id, { status: newStatus }).subscribe({
      next: (res) => {
        this.chalet = { ...this.chalet!, status: res.data.status };
        this.isUpdatingStatus = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isUpdatingStatus = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteCurrentChalet(): void {
    if (!this.chalet || this.isDeletingChalet) return;
    void this.confirmDeleteCurrentChalet();
  }

  private async confirmDeleteCurrentChalet(): Promise<void> {
    if (!this.chalet || this.isDeletingChalet) return;
    const accepted = await this.uiDialog.confirm({
      badge: 'Gestión de Propiedad',
      title: '¿Eliminar este chalet permanentemente?',
      message: `Estás a punto de eliminar "${this.chalet.title}". Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar chalet',
      cancelText: 'Cancelar',
      tone: 'danger',
      icon: 'fa-solid fa-trash-can',
    });

    if (!accepted || !this.chalet || this.isDeletingChalet) return;

    this.isDeletingChalet = true;
    this.chaletService.deleteChalet(this.chalet._id).subscribe({
      next: () => {
        this.isDeletingChalet = false;
        this.uiDialog.notify({
          tone: 'success',
          title: 'Chalet eliminado',
          message: 'La propiedad fue eliminada correctamente.',
        });
        void this.router.navigate(['/explore']);
      },
      error: (err) => {
        this.isDeletingChalet = false;
        this.uiDialog.notify({
          tone: 'error',
          title: 'No se pudo eliminar el chalet',
          message: err?.error?.message || 'Ocurrió un error al intentar eliminar el chalet.',
        });
        this.cdr.markForCheck();
      }
    });
  }

  get nightsCount(): number {
    if (!this.checkInDate || !this.checkOutDate) return 1;
    const start = new Date(`${this.checkInDate}T00:00:00`);
    const end = new Date(`${this.checkOutDate}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }

  get baseTotal(): number {
    return this.chalet ? this.chalet.pricePerNight * this.nightsCount : 0;
  }

  get cleaningFee(): number {
    return this.chalet ? (this.chalet.cleaningFee ?? 150) : 150;
  }

  get grandTotal(): number {
    return this.baseTotal + this.cleaningFee;
  }

  get isFav(): boolean {
    return this.chalet ? this.chaletService.isFavorite(this.chalet._id) : false;
  }

  toggleFavorite(): void {
    if (this.chalet) {
      this.chaletService.toggleFavorite(this.chalet._id);
    }
  }

  get isCompared(): boolean {
    return this.chalet ? this.compareService.isCompared(this.chalet._id) : false;
  }

  toggleCompare(): void {
    if (this.chalet) {
      this.compareService.toggle(this.chalet);
    }
  }

  get distanceFormatted(): string | null {
    if (!this.chalet?.coordinates?.lat || !this.chalet.coordinates?.lng) return null;
    const km = this.geoService.getDistanceToChalet(this.chalet.coordinates.lat, this.chalet.coordinates.lng);
    return this.geoService.formatDistance(km);
  }

  get googleMapsDirectionsUrl(): string {
    if (!this.chalet?.coordinates?.lat || !this.chalet?.coordinates?.lng) return '#';
    return this.geoService.getGoogleMapsDirectionsUrl(this.chalet.coordinates.lat, this.chalet.coordinates.lng);
  }

  toggleMapRoute(): void {
    if (!this.chaletMap || !this.chalet) return;
    if (this.chaletMap.activeRouteInfo) {
      this.chaletMap.clearRoute();
      return;
    }
    void this.chaletMap.drawRoute(this.chalet);
  }

  loadChatEligibility(): void {
    const hostId = this.chalet?.host?._id;
    const chaletId = this.chalet?._id;
    if (!hostId || !this.auth.isAuthenticated()) return;

    this.messageService.getChatEligibility(hostId, chaletId).subscribe({
      next: (eligibility) => {
        this.chatEligibility = eligibility;
        if (eligibility.chatEnabled) {
          this.chatLockNotice = '';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Ignore silent eligibility check errors
      },
    });
  }

  openHostChat(): void {
    if (!this.chalet?.host) return;
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.isOwnChalet) {
      void this.router.navigate(['/messages']);
      return;
    }

    if (this.chatEligibility.chatEnabled) {
      this.chatLockNotice = '';
      this.chatWidget.openConversation(this.chalet.host._id, this.chalet._id);
      return;
    }

    if (this.chatEligibility.appointmentStatus === 'pendiente') {
      this.chatLockNotice = `Tu cita con ${this.chalet.host.name} está pendiente de aceptación. En cuanto el propietario la acepte, se habilitará tu chat directo en la página web.`;
    } else {
      this.bookingMode = 'cita';
      this.bookingSuccess = false;
      this.chatLockNotice = `Para chatear con ${this.chalet.host.name} dentro de TropicStay, primero solicita una cita en el panel de reserva. Al ser aceptada se habilitará el chat.`;
    }

    const widgetEl = document.querySelector('.booking-widget');
    if (widgetEl && typeof widgetEl.scrollIntoView === 'function') {
      widgetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.cdr.markForCheck();
  }

  openFullHostChat(): void {
    if (!this.chalet?.host || !this.chatEligibility.chatEnabled) return;
    this.chatWidget.expandToFullPage(this.chalet.host._id, this.chalet._id);
  }

  submitBooking(): void {
    this.bookingError = '';
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    if (!this.chalet || !this.bookingName.trim() || !this.bookingEmail.trim() || !this.bookingPhone.trim()) {
      this.bookingError = 'Completa tu nombre, correo y teléfono para continuar.';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.bookingEmail.trim())) {
      this.bookingError = 'El formato del correo electrónico no es válido.';
      return;
    }

    if (this.bookingPhone.replace(/\D/g, '').length < 7) {
      this.bookingError = 'Ingresa un número de teléfono válido (al menos 7 dígitos).';
      return;
    }

    const checkIn = new Date(`${this.checkInDate}T00:00:00`);
    const today = new Date(`${this.minBookingDate}T00:00:00`);

    if (this.bookingMode === 'cita') {
      if (Number.isNaN(checkIn.getTime()) || checkIn < today) {
        this.bookingError = 'Selecciona una fecha válida desde hoy para tu cita.';
        return;
      }
    } else {
      const checkOut = new Date(`${this.checkOutDate}T00:00:00`);
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkIn < today || checkOut <= checkIn) {
        this.bookingError = 'Selecciona una llegada desde hoy y una salida posterior a la llegada.';
        return;
      }
      if (this.hasBookedDaysBetween(this.checkInDate, this.checkOutDate)) {
        this.bookingError = 'Algunas de las fechas seleccionadas ya están reservadas. Elige otro rango en el calendario.';
        return;
      }
    }

    if (this.bookingGuests < 1 || this.bookingGuests > this.chalet.guestsMax) {
      this.bookingError = `Este chalet admite hasta ${this.chalet.guestsMax} huéspedes.`;
      return;
    }

    this.isBookingSubmitting = true;
    const payload = this.bookingMode === 'cita'
      ? {
          chaletId: this.chalet._id,
          bookingType: 'cita' as const,
          visitTime: this.visitTime,
          status: 'pendiente' as const,
          guestName: this.bookingName.trim(),
          guestEmail: this.bookingEmail.trim(),
          guestPhone: this.bookingPhone.trim(),
          checkIn: this.checkInDate,
          guestsCount: Number(this.bookingGuests),
          notes: this.bookingNotes.trim(),
        }
      : {
          chaletId: this.chalet._id,
          bookingType: 'reserva' as const,
          status: 'pendiente' as const,
          guestName: this.bookingName.trim(),
          guestEmail: this.bookingEmail.trim(),
          guestPhone: this.bookingPhone.trim(),
          checkIn: this.checkInDate,
          checkOut: this.checkOutDate,
          guestsCount: Number(this.bookingGuests),
          notes: this.bookingNotes.trim(),
        };

    this.bookingService.createBooking(payload).subscribe({
      next: (res) => {
        this.isBookingSubmitting = false;
        this.lastCreatedType = this.bookingMode;
        this.bookingSuccess = true;
        if (this.bookingMode === 'cita') {
          this.chatEligibility = {
            chatEnabled: false,
            appointmentStatus: 'pendiente',
            appointment: null,
          };
          this.chatLockNotice = '';
        }
        if (this.bookingMode === 'reserva' && res.data) {
          this.bookedDates = [
            ...this.bookedDates,
            { _id: res.data._id, checkIn: res.data.checkIn, checkOut: res.data.checkOut, status: res.data.status as 'confirmada' | 'pendiente' }
          ];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error enviando solicitud:', err);
        this.isBookingSubmitting = false;
        this.bookingError = err?.error?.message || 'No pudimos procesar la solicitud. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      }
    });
  }

  submitReview(): void {
    this.reviewError = '';
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    if (!this.chalet || !this.newReviewComment.trim()) {
      this.reviewError = 'Por favor escribe un comentario para publicar tu calificación.';
      return;
    }

    this.isReviewSubmitting = true;
    this.chaletService.addReview(this.chalet._id, {
      authorName: (this.newReviewAuthor || this.auth.user()?.name || 'Huésped Verificado').trim(),
      rating: this.newReviewRating,
      cleanliness: this.newReviewCleanliness,
      accuracy: this.newReviewAccuracy,
      location: this.newReviewLocation,
      communication: this.newReviewCommunication,
      value: this.newReviewValue,
      comment: this.newReviewComment.trim(),
    }).subscribe({
      next: () => {
        this.isReviewSubmitting = false;
        this.reviewSuccessMessage = '¡Tu calificación fue guardada exitosamente!';
        this.newReviewComment = '';
        this.loadChalet(this.chalet!._id);
        setTimeout(() => {
          this.reviewSuccessMessage = '';
          this.cdr.markForCheck();
        }, 5000);
      },
      error: (err) => {
        console.error('Error enviando reseña:', err);
        this.isReviewSubmitting = false;
        this.reviewError = err?.error?.message || 'Error al guardar la reseña.';
        this.cdr.markForCheck();
      }
    });
  }
}
