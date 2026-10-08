import { Component, OnInit, inject } from '@angular/core';
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

    this.checkInDate = today.toISOString().split('T')[0];
    this.checkOutDate = tomorrow.toISOString().split('T')[0];
  }

  get minBookingDate(): string {
    return new Date().toISOString().split('T')[0];
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
      },
      error: (err) => {
        console.error('Error cargando chalet:', err);
        this.isLoading = false;
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

  get googleMapsDirectionsUrl(): string {
    if (!this.chalet?.coordinates?.lat || !this.chalet.coordinates?.lng) return '';
    return this.geoService.getGoogleMapsDirectionsUrl(this.chalet.coordinates.lat, this.chalet.coordinates.lng);
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
