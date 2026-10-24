import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
  effect,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Chalet } from '../../models/chalet.model';
import { ChaletService } from '../../services/chalet.service';
import { GeolocationService } from '../../services/geolocation.service';

@Component({
  selector: 'app-chalet-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chalet-map.html',
  styleUrl: './chalet-map.css'
})
export class ChaletMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() chalets: Chalet[] = [];
  @Input() selectedChalet: Chalet | null = null;
  @Input() height: string = '520px';
  @Input() interactive: boolean = true;
  @Input() showUserLocation: boolean = true;

  @Output() chaletSelected = new EventEmitter<Chalet>();

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup = L.layerGroup();
  private routeLayer: L.LayerGroup = L.layerGroup();
  private userMarker: L.Marker | null = null;
  private currentRouteBounds: L.LatLngBounds | null = null;
  private activeRouteChalet: Chalet | null = null;
  private lastOriginSignature = '';
  private pendingRouteKey: string | null = null;
  private routeRequestId = 0;

  activeRouteInfo: {
    chaletTitle: string;
    distanceKm: string;
    durationFormatted: string;
    originName: string;
  } | null = null;

  isLoadingRoute: boolean = false;

  chaletService = inject(ChaletService);
  geoService = inject(GeolocationService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      // Reaccionar cuando cambie la ubicación de partida del usuario (GPS o Ciudad)
      const user = this.geoService.userLocation();
      const originSignature = `${user.lat},${user.lng}`;
      const originChanged = Boolean(this.lastOriginSignature) && this.lastOriginSignature !== originSignature;
      this.lastOriginSignature = originSignature;
      if (this.map && this.showUserLocation) {
        this.renderUserLocationMarker();
        if (originChanged && this.activeRouteChalet) {
          this.drawRoute(this.activeRouteChalet);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map) {
      if (changes['chalets']) {
        this.renderMarkers();
      }
      if (changes['selectedChalet']) {
        if (this.selectedChalet) {
          this.focusChalet(this.selectedChalet);
          this.drawRoute(this.selectedChalet);
        } else {
          this.clearRoute();
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    // Coordenadas centrales de Guatemala
    const defaultLat = 14.85;
    const defaultLng = -90.55;
    const defaultZoom = 8;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [defaultLat, defaultLng],
      zoom: defaultZoom,
      zoomControl: false,
      scrollWheelZoom: this.interactive,
    });

    // Controles de zoom elegantes en la esquina superior derecha
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // OpenStreetMap tiles (100% gratuito, público y sin requerir API key)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.routeLayer.addTo(this.map);
    this.markersLayer.addTo(this.map);

    // Pintar posición del usuario
    if (this.showUserLocation) {
      this.renderUserLocationMarker();
    }

    // Pintar chalets
    this.renderMarkers();

    // Si ya viene seleccionado un chalet, trazar la ruta de inmediato
    if (this.selectedChalet) {
      this.drawRoute(this.selectedChalet);
    }

    // Reajustar tamaño tras render
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  renderUserLocationMarker(): void {
    if (!this.map) return;

    const user = this.geoService.userLocation();
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="user-pulse-marker" title="${user.name}">
          <div class="pulse-ring"></div>
          <div class="pulse-dot"><i class="fa-solid fa-location-crosshairs"></i></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (this.userMarker) {
      this.userMarker.remove();
    }

    this.userMarker = L.marker([user.lat, user.lng], { icon: userIcon }).addTo(this.map);
    this.userMarker.bindPopup(`
      <div class="user-location-popup">
        <strong>📍 ${user.name}</strong>
        <p>Tu punto de partida actual para trazar rutas.</p>
      </div>
    `);
  }

  renderMarkers(): void {
    if (!this.map) return;

    this.markersLayer.clearLayers();

    if (!this.chalets || this.chalets.length === 0) return;

    const bounds: L.LatLngTuple[] = [];

    this.chalets.forEach(chalet => {
      if (!chalet.coordinates || !chalet.coordinates.lat || !chalet.coordinates.lng) return;

      const lat = chalet.coordinates.lat;
      const lng = chalet.coordinates.lng;
      bounds.push([lat, lng]);

      const formattedPrice = this.chaletService.formatPrice(chalet.pricePerNight, chalet.priceUSD);
      const distanceKm = this.geoService.getDistanceToChalet(lat, lng);
      const distanceFormatted = this.geoService.formatDistance(distanceKm);
      const googleMapsUrl = this.geoService.getGoogleMapsDirectionsUrl(lat, lng);

      const isSelected = this.selectedChalet?._id === chalet._id;

      const icon = L.divIcon({
        className: 'custom-chalet-pin',
        html: `
          <div class="chalet-price-pin ${isSelected ? 'pin-selected' : ''}" data-id="${chalet._id}">
            <span class="pin-category-icon">${this.getCategoryEmoji(chalet.category)}</span>
            <span class="pin-price">${formattedPrice}</span>
          </div>
        `,
        iconSize: [96, 36],
        iconAnchor: [48, 36],
      });

      const marker = L.marker([lat, lng], { icon });

      // Popup informativo interactivo
      const popupContent = `
        <div class="map-chalet-popup">
          <div class="popup-image-box">
            <img src="${chalet.thumbnail || chalet.images[0]}" alt="${chalet.title}" class="popup-img" />
            <span class="popup-rating">★ ${chalet.rating.toFixed(1)} (${chalet.reviewsCount})</span>
          </div>
          <div class="popup-body">
            <span class="popup-tag">${chalet.municipality}, ${chalet.department}</span>
            <h4 class="popup-title">${chalet.title}</h4>
            <div class="popup-meta">
              <span class="popup-distance"><i class="fa-solid fa-route"></i> A ${distanceFormatted} de ti</span>
              <span class="popup-price"><strong>${formattedPrice}</strong> / noche</span>
            </div>
            <div class="popup-actions">
              <a href="/chalet/${chalet._id}" class="popup-btn-view">Ver Chalet</a>



            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300, minWidth: 260 });

      marker.on('popupopen', () => {
        const viewChaletLink = marker.getPopup()?.getElement()?.querySelector<HTMLAnchorElement>('.popup-btn-view');
        viewChaletLink?.addEventListener('click', (event) => {
          event.preventDefault();
          this.router.navigate(['/chalet', chalet._id]);
        }, { once: true });
      });

      marker.on('click', () => {
        this.chaletSelected.emit(chalet);
      });

      this.markersLayer.addLayer(marker);
    });

    // Si no hay un chalet seleccionado con ruta activa, ajustar a los chalets visibles
    if (!this.selectedChalet && bounds.length > 0) {
      if (bounds.length === 1) {
        this.map.setView(bounds[0], 12);
      } else {
        this.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 13 });
      }
    }
  }

  async drawRoute(chalet: Chalet): Promise<void> {
    if (!this.map || !chalet.coordinates?.lat || !chalet.coordinates?.lng) return;

    const user = this.geoService.userLocation();
    const destLat = chalet.coordinates.lat;
    const destLng = chalet.coordinates.lng;
    const routeKey = `${user.lat},${user.lng}:${chalet._id}`;

    if (this.pendingRouteKey === routeKey) return;

    const requestId = ++this.routeRequestId;
    this.pendingRouteKey = routeKey;
    this.activeRouteChalet = chalet;

    this.routeLayer.clearLayers();
    this.isLoadingRoute = true;
    this.showEstimatedRoute(chalet, user);
    this.cdr.markForCheck();

    if (this.showUserLocation) {
      this.renderUserLocationMarker();
    }

    try {
      // Consultar trazado de carretera real en Guatemala a OSRM
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${user.lng},${user.lat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const response = await fetch(osrmUrl, { signal: AbortSignal.timeout(3500) });
      const data = await response.json();

      if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
        if (requestId !== this.routeRequestId) return;

        const route = data.routes[0];
        const coordinates = route.geometry.coordinates as [number, number][];
        const latLngs: L.LatLngTuple[] = coordinates.map(([lng, lat]) => [lat, lng]);

        this.routeLayer.clearLayers();

        // Casing / línea sombra de profundidad
        const casing = L.polyline(latLngs, {
          color: '#083E33',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        });

        // Línea principal de ruta (Terracota cálido de TropicStay)
        const polyline = L.polyline(latLngs, {
          color: '#D97736',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        });

        this.routeLayer.addLayer(casing);
        this.routeLayer.addLayer(polyline);

        const distKm = (route.distance / 1000).toFixed(1);
        const totalMinutes = Math.round(route.duration / 60);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

        this.activeRouteInfo = {
          chaletTitle: chalet.title,
          distanceKm: distKm,
          durationFormatted: durationText,
          originName: user.name
        };

        const bounds = L.latLngBounds(latLngs);
        this.currentRouteBounds = bounds;
        this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true });
        this.isLoadingRoute = false;
        this.pendingRouteKey = null;
        this.cdr.markForCheck();
        return;
      }
    } catch (e) {
      if (requestId !== this.routeRequestId) return;
      console.warn('Ruta OSRM no disponible, usando trazado directo:', e);
    }

    // Fallback: Trazado directo con línea punteada
    if (requestId !== this.routeRequestId) return;

    this.routeLayer.clearLayers();
    const directPoints: L.LatLngTuple[] = [
      [user.lat, user.lng],
      [destLat, destLng]
    ];

    const fallbackLine = L.polyline(directPoints, {
      color: '#D97736',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.9
    });

    this.routeLayer.addLayer(fallbackLine);

    const distKm = this.geoService.getDistanceToChalet(destLat, destLng);
    const estMinutes = Math.round((distKm / 65) * 60);
    const hours = Math.floor(estMinutes / 60);
    const mins = estMinutes % 60;

    this.activeRouteInfo = {
      chaletTitle: chalet.title,
      distanceKm: `${distKm}`,
      durationFormatted: hours > 0 ? `${hours}h ${mins}m` : `${mins} min`,
      originName: user.name
    };

    const fallbackBounds = L.latLngBounds(directPoints);
    this.currentRouteBounds = fallbackBounds;
    this.map.fitBounds(fallbackBounds, { padding: [60, 60], maxZoom: 14, animate: true });
    this.isLoadingRoute = false;
    this.pendingRouteKey = null;
    this.cdr.markForCheck();
  }

  private showEstimatedRoute(chalet: Chalet, user: { lat: number; lng: number; name: string }): void {
    if (!this.map || !chalet.coordinates?.lat || !chalet.coordinates?.lng) return;

    const destination = chalet.coordinates;
    const directPoints: L.LatLngTuple[] = [
      [user.lat, user.lng],
      [destination.lat, destination.lng]
    ];
    const estimatedLine = L.polyline(directPoints, {
      color: '#D97736',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.9
    });

    this.routeLayer.addLayer(estimatedLine);

    const distanceKm = this.geoService.getDistanceToChalet(destination.lat, destination.lng);
    const estimatedMinutes = Math.round((distanceKm / 65) * 60);
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;

    this.activeRouteInfo = {
      chaletTitle: chalet.title,
      distanceKm: `${distanceKm}`,
      durationFormatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`,
      originName: user.name
    };

    this.currentRouteBounds = L.latLngBounds(directPoints);
    this.map.fitBounds(this.currentRouteBounds, { padding: [60, 60], maxZoom: 14, animate: true });
  }

  fitRoute(): void {
    if (this.currentRouteBounds && this.map) {
      this.map.fitBounds(this.currentRouteBounds, { padding: [60, 60], maxZoom: 14, animate: true });
    }
  }

  clearRoute(): void {
    this.routeRequestId++;
    this.pendingRouteKey = null;
    this.activeRouteChalet = null;
    this.isLoadingRoute = false;
    this.routeLayer.clearLayers();
    this.activeRouteInfo = null;
    this.currentRouteBounds = null;
    this.cdr.markForCheck();
  }

  focusChalet(chalet: Chalet): void {
    if (!this.map || !chalet.coordinates) return;
    this.map.setView([chalet.coordinates.lat, chalet.coordinates.lng], 13, { animate: true });
  }

  recenter(): void {
    if (!this.map) return;
    // Bounding box geográfico completo que encuadra toda la República de Guatemala
    // De Petén (Norte) al Océano Pacífico (Sur), y de San Marcos (Oeste) a Izabal (Este)
    const guatemalaBounds = L.latLngBounds(
      [13.73, -92.24], // Suroeste
      [17.82, -88.22]  // Noreste
    );
    this.map.fitBounds(guatemalaBounds, { padding: [25, 25], animate: true });
  }

  private getCategoryEmoji(cat: string): string {
    switch (cat) {
      case 'Lago': return '🌊';
      case 'Playa': return '🏖️';
      case 'Montaña': return '🌲';
      case 'Colonial': return '☕';
      case 'Río': return '🛶';
      case 'Selva': return '🐒';
      default: return '🏡';
    }
  }
}
