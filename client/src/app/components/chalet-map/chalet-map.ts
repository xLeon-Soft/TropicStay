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
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  private userMarker: L.Marker | null = null;

  chaletService = inject(ChaletService);
  geoService = inject(GeolocationService);

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map) {
      if (changes['chalets']) {
        this.renderMarkers();
      }
      if (changes['selectedChalet'] && this.selectedChalet) {
        this.focusChalet(this.selectedChalet);
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

    // CartoDB Voyager tiles (Moderno, cálido y de alta legibilidad)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; OpenStreetMap',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);

    // Pintar posición del usuario
    if (this.showUserLocation) {
      this.renderUserLocationMarker();
    }

    // Pintar chalets
    this.renderMarkers();

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
        <p>Tu punto de partida actual para medir distancias.</p>
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
              <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="popup-btn-route" title="Cómo llegar con Google Maps">
                <i class="fa-solid fa-diamond-turn-right"></i> Cómo llegar
              </a>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300, minWidth: 260 });

      marker.on('click', () => {
        this.chaletSelected.emit(chalet);
      });

      this.markersLayer.addLayer(marker);
    });

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        this.map.setView(bounds[0], 12);
      } else {
        this.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 13 });
      }
    }
  }

  focusChalet(chalet: Chalet): void {
    if (!this.map || !chalet.coordinates) return;
    this.map.setView([chalet.coordinates.lat, chalet.coordinates.lng], 13, { animate: true });
  }

  recenter(): void {
    this.renderMarkers();
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
