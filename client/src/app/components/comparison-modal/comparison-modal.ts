import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComparisonService } from '../../services/comparison.service';
import { ChaletService } from '../../services/chalet.service';
import { GeolocationService } from '../../services/geolocation.service';
import { Chalet } from '../../models/chalet.model';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-comparison-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './comparison-modal.html',
  styleUrl: './comparison-modal.css'
})
export class ComparisonModalComponent {
  comparisonService = inject(ComparisonService);
  chaletService = inject(ChaletService);
  geoService = inject(GeolocationService);

  keyAmenities = [
    'Piscina privada',
    'Piscina infinita',
    'Jacuzzi climatizado',
    'Vista panorámica al lago',
    'Frente al mar',
    'Muelle privado',
    'Chimenea de leña',
    'Wifi de alta velocidad',
    'Pet Friendly',
    'Aire acondicionado',
    'Parrilla BBQ'
  ];

  get verdicts() {
    return this.comparisonService.getVerdicts(this.geoService);
  }

  hasAmenity(chalet: Chalet, amenityName: string): boolean {
    if (!chalet.amenities) return false;
    return chalet.amenities.some(a => a.toLowerCase().includes(amenityName.toLowerCase()));
  }

  getDistance(chalet: Chalet): string {
    const km = this.geoService.getDistanceToChalet(chalet.coordinates?.lat, chalet.coordinates?.lng);
    return this.geoService.formatDistance(km);
  }

  close(): void {
    this.comparisonService.close();
  }

  remove(id: string): void {
    this.comparisonService.remove(id);
  }

  clear(): void {
    this.comparisonService.clear();
  }
}
