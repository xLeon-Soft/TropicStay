import { Injectable, signal } from '@angular/core';

export interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
  isGPS?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  // Ciudades guatemaltecas de referencia habituales
  readonly referenceCities: LocationPoint[] = [
    { name: 'Ciudad de Guatemala', lat: 14.6349, lng: -90.5069 },
    { name: 'Antigua Guatemala', lat: 14.5586, lng: -90.7339 },
    { name: 'Quetzaltenango (Xela)', lat: 14.8347, lng: -91.5181 },
    { name: 'Escuintla', lat: 14.3009, lng: -90.7858 },
    { name: 'Cobán, Alta Verapaz', lat: 15.4714, lng: -90.3708 },
    { name: 'Chiquimula / Oriente', lat: 14.7981, lng: -89.5458 },
    { name: 'Flores, Petén', lat: 16.9247, lng: -89.8967 },
  ];

  // Ubicación activa del usuario (Por defecto: Ciudad de Guatemala)
  userLocation = signal<LocationPoint>({
    name: 'Ciudad de Guatemala',
    lat: 14.6349,
    lng: -90.5069,
    isGPS: false,
  });

  isLocating = signal<boolean>(false);

  constructor() {
    this.tryDetectGPSOnStart();
  }

  private tryDetectGPSOnStart(): void {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      // Intento silencioso de leer la posición
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLocation.set({
            name: 'Mi ubicación actual (GPS)',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            isGPS: true,
          });
        },
        () => {
          // Si el usuario no otorga permiso, se mantiene Ciudad de Guatemala por defecto
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
  }

  detectGPS(): Promise<boolean> {
    this.isLocating.set(true);
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.userLocation.set({
              name: 'Mi ubicación actual (GPS)',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              isGPS: true,
            });
            this.isLocating.set(false);
            resolve(true);
          },
          (err) => {
            console.warn('No se pudo obtener GPS:', err.message);
            this.isLocating.set(false);
            resolve(false);
          },
          { timeout: 8000, enableHighAccuracy: true }
        );
      } else {
        this.isLocating.set(false);
        resolve(false);
      }
    });
  }

  setReferenceCity(city: LocationPoint): void {
    this.userLocation.set({ ...city, isGPS: false });
  }

  // Fórmula de Haversine para calcular distancia esférica en km
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  getDistanceToChalet(chaletLat?: number, chaletLng?: number): number {
    if (!chaletLat || !chaletLng) return 0;
    const current = this.userLocation();
    return this.calculateDistance(current.lat, current.lng, chaletLat, chaletLng);
  }

  formatDistance(km: number): string {
    if (km <= 0) return 'Misma zona';
    if (km < 1) return 'Menos de 1 km';
    return `${km} km`;
  }

  getGoogleMapsDirectionsUrl(destLat: number, destLng: number): string {
    const current = this.userLocation();
    return `https://www.google.com/maps/dir/?api=1&origin=${current.lat},${current.lng}&destination=${destLat},${destLng}&travelmode=driving`;
  }
}
