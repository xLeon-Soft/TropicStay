import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';
import { BookingService } from '../../services/booking.service';
import { GeolocationService } from '../../services/geolocation.service';
import { ComparisonService } from '../../services/comparison.service';
import { ComparisonModalComponent } from '../../components/comparison-modal/comparison-modal';
import { Chalet, Review } from '../../models/chalet.model';
import { ChaletMapComponent } from '../../components/chalet-map/chalet-map';
import { AuthService } from '../../services/auth.service';

interface CalendarDay {
  value: string;
  label: number;
}

@Component({
  selector: 'app-chalet-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChaletMapComponent, ComparisonModalComponent],
  templateUrl: './chalet-detail.html',
  styleUrl: './chalet-detail.css'
})
export class ChaletDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  chaletService = inject(ChaletService);
  bookingService = inject(BookingService);
  geoService = inject(GeolocationService);
  compareService = inject(ComparisonService);
  auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  chalet: Chalet | null = null;
  isLoading = true;
  selectedImage: string = '';

  // Booking Widget State
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
  bookingError = '';

  // New Review Form State
  newReviewAuthor: string = '';
  newReviewRating: number = 5;
  newReviewCleanliness: number = 5;
  newReviewLocation: number = 5;
  newReviewCommunication: number = 5;
  newReviewValue: number = 5;
  newReviewComment: string = '';
  isReviewSubmitting = false;
  reviewSuccessMessage = '';
  reviewError = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadChalet(id);
    }
    this.initDefaultDates();
    this.prefillAuthenticatedUser();
  }

  initDefaultDates(): void {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);

    this.checkInDate = this.toDateValue(today);
    this.checkOutDate = this.toDateValue(tomorrow);
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

  selectBookingDay(value: string): void {
    if (!value || this.isCalendarDayDisabled(value)) return;

    if (this.selectingBookingDate === 'checkIn') {
      this.checkInDate = value;
      if (!this.checkOutDate || this.checkOutDate <= value) {
        this.checkOutDate = this.toDateValue(this.addDays(value, 1));
      }
      this.selectingBookingDate = 'checkOut';
      return;
    }

    this.checkOutDate = value;
    this.showBookingCalendar = false;
  }

  isCalendarDayDisabled(value: string): boolean {
    if (!value || value < this.minBookingDate) return true;
    return this.selectingBookingDate === 'checkOut' && value <= this.checkInDate;
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
    this.newReviewAuthor = user.name;
  }

  loadChalet(id: string): void {
    this.isLoading = true;
    this.chaletService.getChaletById(id).subscribe({
      next: (data) => {
        this.chalet = data;
        this.selectedImage = data.thumbnail || data.images[0];
        this.isLoading = false;
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

  get nightsCount(): number {
    if (!this.checkInDate || !this.checkOutDate) return 1;
    const start = new Date(this.checkInDate);
    const end = new Date(this.checkOutDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }

  get baseTotal(): number {
    return this.chalet ? this.chalet.pricePerNight * this.nightsCount : 0;
  }

  get cleaningFee(): number {
    return this.chalet ? (this.chalet.cleaningFee || 150) : 150;
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

  get hostWhatsAppUrl(): string {
    if (!this.chalet?.host) return '#';
    const cleanPhone = (this.chalet.host.phone || '+50255550000').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hola ${this.chalet.host.name}, te escribo desde TropicStay Guatemala sobre tu chalet "${this.chalet.title}". ¿Podrías darme más información?`);
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }

  submitBooking(): void {
    this.bookingError = '';
    if (!this.chalet || !this.bookingName || !this.bookingEmail || !this.bookingPhone) {
      this.bookingError = 'Completa tu nombre, correo y teléfono para continuar.';
      return;
    }

    const checkIn = new Date(`${this.checkInDate}T00:00:00`);
    const checkOut = new Date(`${this.checkOutDate}T00:00:00`);
    const today = new Date(`${this.minBookingDate}T00:00:00`);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkIn < today || checkOut <= checkIn) {
      this.bookingError = 'Selecciona una llegada desde hoy y una salida posterior a la llegada.';
      return;
    }

    if (this.bookingGuests < 1 || this.bookingGuests > this.chalet.guestsMax) {
      this.bookingError = `Este chalet admite hasta ${this.chalet.guestsMax} huéspedes.`;
      return;
    }

    this.isBookingSubmitting = true;
    this.bookingService.createBooking({
      chaletId: this.chalet._id,
      guestName: this.bookingName,
      guestEmail: this.bookingEmail,
      guestPhone: this.bookingPhone,
      checkIn: this.checkInDate,
      checkOut: this.checkOutDate,
      guestsCount: this.bookingGuests,
      notes: this.bookingNotes,
    }).subscribe({
      next: () => {
        this.isBookingSubmitting = false;
        this.bookingSuccess = true;
      },
      error: (err) => {
        console.error('Error enviando reserva:', err);
        this.isBookingSubmitting = false;
        this.bookingError = err?.error?.message || 'No pudimos procesar la reserva. Inténtalo de nuevo.';
      }
    });
  }

  submitReview(): void {
    this.reviewError = '';
    if (!this.chalet || !this.newReviewAuthor.trim() || !this.newReviewComment.trim()) {
      alert('Por favor escribe tu nombre y un comentario para publicar tu calificación.');
      return;
    }

    this.isReviewSubmitting = true;
    this.chaletService.addReview(this.chalet._id, {
      authorName: this.newReviewAuthor.trim(),
      rating: this.newReviewRating,
      cleanliness: this.newReviewCleanliness,
      location: this.newReviewLocation,
      communication: this.newReviewCommunication,
      value: this.newReviewValue,
      comment: this.newReviewComment.trim(),
    }).subscribe({
      next: (res) => {
        this.isReviewSubmitting = false;
        this.reviewSuccessMessage = '¡Tu calificación fue guardada exitosamente en MongoDB!';
        // Reset form
        this.newReviewAuthor = '';
        this.newReviewComment = '';
        // Reload chalet to refresh ratings and review list
        this.loadChalet(this.chalet!._id);
        setTimeout(() => this.reviewSuccessMessage = '', 5000);
      },
      error: (err) => {
        console.error('Error enviando reseña:', err);
        this.isReviewSubmitting = false;
        alert('Error al guardar la reseña en la base de datos.');
      }
    });
  }
}
