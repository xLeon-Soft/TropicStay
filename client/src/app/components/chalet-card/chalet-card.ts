import { Component, Input, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Chalet } from '../../models/chalet.model';
import { ChaletService } from '../../services/chalet.service';
import { GeolocationService } from '../../services/geolocation.service';
import { ComparisonService } from '../../services/comparison.service';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-chalet-card',
  standalone: true,
  imports: [RouterLink, CommonModule, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './chalet-card.html',
  styleUrl: './chalet-card.css'
})
export class ChaletCardComponent {
  @Input({ required: true }) chalet!: Chalet;
  private router = inject(Router);
  chaletService = inject(ChaletService);
  geoService = inject(GeolocationService);
  compareService = inject(ComparisonService);

  goToHost(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.chalet.host?._id) {
      this.router.navigate(['/host', this.chalet.host._id]);
    }
  }

  toggleFavorite(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.chaletService.toggleFavorite(this.chalet._id);
  }

  toggleCompare(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.compareService.toggle(this.chalet);
  }

  get isCompared(): boolean {
    return this.compareService.isCompared(this.chalet._id);
  }

  get isFav(): boolean {
    return this.chaletService.isFavorite(this.chalet._id);
  }

  get formattedPrice(): string {
    return this.chaletService.formatPrice(this.chalet.pricePerNight, this.chalet.priceUSD);
  }

  get distanceFormatted(): string | null {
    if (!this.chalet.coordinates?.lat || !this.chalet.coordinates?.lng) return null;
    const km = this.geoService.getDistanceToChalet(this.chalet.coordinates.lat, this.chalet.coordinates.lng);
    return this.geoService.formatDistance(km);
  }
}

