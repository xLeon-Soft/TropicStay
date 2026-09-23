import { Injectable, signal, computed } from '@angular/core';
import { Chalet } from '../models/chalet.model';
import { GeolocationService } from './geolocation.service';

export interface ComparisonVerdict {
  bestPriceId: string;
  highestRatingId: string;
  closestId: string;
  bestValueId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComparisonService {
  comparedChalets = signal<Chalet[]>([]);
  isOpenModal = signal<boolean>(false);

  maxComparison = 4;

  count = computed(() => this.comparedChalets().length);
  hasItems = computed(() => this.comparedChalets().length > 0);

  toggle(chalet: Chalet): boolean {
    const list = this.comparedChalets();
    const index = list.findIndex(c => c._id === chalet._id);

    if (index >= 0) {
      // Remover
      this.comparedChalets.set(list.filter(c => c._id !== chalet._id));
      return false;
    } else {
      // Agregar si no excede el límite
      if (list.length >= this.maxComparison) {
        alert(`Puedes comparar un máximo de ${this.maxComparison} chalets a la vez.`);
        return false;
      }
      this.comparedChalets.set([...list, chalet]);
      return true;
    }
  }

  remove(chaletId: string): void {
    this.comparedChalets.set(this.comparedChalets().filter(c => c._id !== chaletId));
    if (this.comparedChalets().length === 0) {
      this.isOpenModal.set(false);
    }
  }

  clear(): void {
    this.comparedChalets.set([]);
    this.isOpenModal.set(false);
  }

  isCompared(chaletId: string): boolean {
    return this.comparedChalets().some(c => c._id === chaletId);
  }

  open(): void {
    if (this.comparedChalets().length < 2) {
      alert('Selecciona al menos 2 chalets para iniciar la comparación.');
      return;
    }
    this.isOpenModal.set(true);
  }

  close(): void {
    this.isOpenModal.set(false);
  }

  // Análisis inteligente de veredictos
  getVerdicts(geoService: GeolocationService): ComparisonVerdict {
    const list = this.comparedChalets();
    if (list.length === 0) {
      return { bestPriceId: '', highestRatingId: '', closestId: '', bestValueId: '' };
    }

    // 1. Mejor Precio (menor precio por noche)
    let bestPriceChalet = list[0];
    for (const c of list) {
      if (c.pricePerNight < bestPriceChalet.pricePerNight) {
        bestPriceChalet = c;
      }
    }

    // 2. Mejor Calificado (mayor rating promedio)
    let highestRatingChalet = list[0];
    for (const c of list) {
      if (c.rating > highestRatingChalet.rating) {
        highestRatingChalet = c;
      }
    }

    // 3. Más Cercano (menor distancia en km)
    let closestChalet = list[0];
    let minDistance = geoService.getDistanceToChalet(closestChalet.coordinates?.lat, closestChalet.coordinates?.lng);
    for (const c of list) {
      const dist = geoService.getDistanceToChalet(c.coordinates?.lat, c.coordinates?.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestChalet = c;
      }
    }

    // 4. Mejor Valor (Relación entre Calidad, Amenidades y Precio)
    let bestValueChalet = list[0];
    let maxScore = -1;
    for (const c of list) {
      const amenitiesCount = c.amenities ? c.amenities.length : 0;
      // Puntuación: rating ponderado + amenidades por cada 500 Q
      const score = (c.rating * 10) + (amenitiesCount * 1.5) - (c.pricePerNight / 400);
      if (score > maxScore) {
        maxScore = score;
        bestValueChalet = c;
      }
    }

    return {
      bestPriceId: bestPriceChalet._id,
      highestRatingId: highestRatingChalet._id,
      closestId: closestChalet._id,
      bestValueId: bestValueChalet._id,
    };
  }
}
