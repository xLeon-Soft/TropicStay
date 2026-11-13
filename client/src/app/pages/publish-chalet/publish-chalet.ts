import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { ChaletService } from '../../services/chalet.service';
import { AuthService } from '../../services/auth.service';
import { GeolocationService } from '../../services/geolocation.service';

interface LocalImage {
  file: File;
  previewUrl: string;
}

const DEPARTMENT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Sololá': { lat: 14.7409, lng: -91.1591 },
  'Santa Rosa': { lat: 13.8962, lng: -90.4819 },
  'Sacatepéquez': { lat: 14.5586, lng: -90.7339 },
  'Izabal': { lat: 15.6584, lng: -88.9908 },
  'Chimaltenango': { lat: 14.7623, lng: -90.9927 },
  'Petén': { lat: 16.9247, lng: -89.8967 },
  'Escuintla': { lat: 13.9284, lng: -90.7858 },
  'Alta Verapaz': { lat: 15.5356, lng: -89.9614 },
  'Guatemala': { lat: 14.6349, lng: -90.5069 },
  'Retalhuleu': { lat: 14.5361, lng: -91.6778 },
  'Quetzaltenango': { lat: 14.8347, lng: -91.5181 },
  'Huehuetenango': { lat: 15.3197, lng: -91.4711 },
  'San Marcos': { lat: 14.9639, lng: -91.7944 },
  'Chiquimula': { lat: 14.7981, lng: -89.5458 },
  'Zacapa': { lat: 14.9722, lng: -89.5306 },
  'Baja Verapaz': { lat: 15.1028, lng: -90.3186 },
  'Suchitepéquez': { lat: 14.5342, lng: -91.5033 },
  'Totonicapán': { lat: 14.9117, lng: -91.3611 },
  'Quiché': { lat: 15.0306, lng: -91.1489 },
  'Jalapa': { lat: 14.6347, lng: -89.9889 },
  'Jutiapa': { lat: 14.2917, lng: -89.8958 },
  'El Progreso': { lat: 14.8542, lng: -90.0694 },
};

@Component({
  selector: 'app-publish-chalet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publish-chalet.html',
  styleUrl: './publish-chalet.css'
})
export class PublishChaletComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pickerMapContainer') pickerMapContainer?: ElementRef<HTMLDivElement>;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  chaletService = inject(ChaletService);
  auth = inject(AuthService);
  geoService = inject(GeolocationService);

  private pickerMap: L.Map | null = null;
  private pickerMarker: L.Marker | null = null;

  editChaletId = '';
  isEditMode = false;
  isLoadingChalet = false;

  // Form Model
  title = '';
  category = 'Lago';
  department = 'Sololá';
  municipality = 'San Marcos La Laguna';
  locationsText = 'Lago de Atitlán, Sololá';
  description = '';
  pricePerNight: number = 2200;
  deposit: number = 500;
  cleaningFee: number = 150;
  guestsMax: number = 6;
  bedrooms: number = 3;
  beds: number = 4;
  bathrooms: number = 2;
  status = 'disponible';
  lat: number = 14.7409;
  lng: number = -91.1591;
  mainImageUrl = 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80';
  additionalImages = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80\nhttps://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80';

  // Host Info (Quien da en alquiler el chalet)
  hostName = '';
  hostPhone = '';
  hostBio = '';

  // Amenities available
  allAmenities = [
    'Piscina privada',
    'Piscina infinita',
    'Jacuzzi climatizado',
    'Vista panorámica al lago',
    'Frente al mar',
    'Muelle privado',
    'Kayaks y Paddleboards',
    'Chimenea de leña',
    'Wifi de alta velocidad',
    'Wifi Starlink',
    'Cocina equipada',
    'Sauna temazcal',
    'Parrilla BBQ',
    'Pet Friendly',
    'Aire acondicionado',
    'Seguridad 24h',
    'Parqueo privado'
  ];
  selectedAmenities: string[] = ['Piscina privada', 'Wifi de alta velocidad', 'Parrilla BBQ'];

  newRule = '';
  rulesList: string[] = ['No fumar en habitaciones', 'Música moderada después de las 22:00'];

  isSubmitting = false;
  publishSuccess = false;
  createdChaletId = '';
  publishError = '';
  imageError = '';
  selectedLocalImages: LocalImage[] = [];

  departmentsList = Object.keys(DEPARTMENT_COORDINATES);

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.hostName = user.name || '';
      this.hostPhone = user.phone && user.phone !== '+502 5555-0000' ? user.phone : '+502 ';
      this.hostBio = user.bio || 'Apasionado por brindar la mejor experiencia en chalets guatemaltecos.';
    }

    const editId = this.route.snapshot.queryParamMap.get('edit');
    if (editId) {
      this.editChaletId = editId;
      this.isEditMode = true;
      this.loadChaletForEdit(editId);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initPickerMap(), 150);
  }

  ngOnDestroy(): void {
    if (this.pickerMap) {
      this.pickerMap.remove();
      this.pickerMap = null;
    }
  }

  private loadChaletForEdit(id: string): void {
    this.isLoadingChalet = true;
    this.chaletService.getChaletById(id).subscribe({
      next: (chalet) => {
        this.title = chalet.title;
        this.category = chalet.category;
        this.department = chalet.department;
        this.municipality = chalet.municipality;
        this.locationsText = (chalet.location || []).join('\n');
        this.description = chalet.description;
        this.pricePerNight = chalet.pricePerNight;
        this.deposit = chalet.deposit ?? 500;
        this.cleaningFee = chalet.cleaningFee ?? 150;
        this.guestsMax = chalet.guestsMax;
        this.bedrooms = chalet.bedrooms;
        this.beds = chalet.beds;
        this.bathrooms = chalet.bathrooms;
        this.status = chalet.status || 'disponible';
        this.mainImageUrl = chalet.thumbnail || chalet.images?.[0] || '';
        this.additionalImages = (chalet.images || []).slice(1).join('\n');
        this.selectedAmenities = [...(chalet.amenities || [])];
        this.rulesList = [...(chalet.rules || [])];

        if (chalet.coordinates?.lat && chalet.coordinates?.lng) {
          this.lat = chalet.coordinates.lat;
          this.lng = chalet.coordinates.lng;
        }
        if (chalet.host) {
          this.hostName = chalet.host.name || this.hostName;
          this.hostPhone = chalet.host.phone || this.hostPhone;
          this.hostBio = chalet.host.bio || this.hostBio;
        }

        this.isLoadingChalet = false;
        this.cdr.markForCheck();
        setTimeout(() => this.initPickerMap(), 150);
      },
      error: (err) => {
        this.publishError = err?.error?.message || 'No se pudo cargar el chalet para editar.';
        this.isLoadingChalet = false;
        this.cdr.markForCheck();
      }
    });
  }

  private initPickerMap(): void {
    if (!this.pickerMapContainer?.nativeElement) return;
    if (this.pickerMap) {
      this.pickerMap.setView([this.lat, this.lng], 11);
      this.updatePickerMarker();
      return;
    }

    this.pickerMap = L.map(this.pickerMapContainer.nativeElement, {
      center: [this.lat, this.lng],
      zoom: 10,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.pickerMap);

    this.updatePickerMarker();

    this.pickerMap.on('click', (e: L.LeafletMouseEvent) => {
      this.lat = Number(e.latlng.lat.toFixed(5));
      this.lng = Number(e.latlng.lng.toFixed(5));
      this.updatePickerMarker();
      this.cdr.markForCheck();
    });

    setTimeout(() => this.pickerMap?.invalidateSize(), 200);
  }

  updatePickerMarker(): void {
    if (!this.pickerMap) return;
    const pinIcon = L.divIcon({
      className: 'custom-chalet-pin',
      html: `<div class="chalet-price-pin pin-selected"><span class="pin-category-icon">📍</span><span class="pin-price">Ubicación</span></div>`,
      iconSize: [100, 36],
      iconAnchor: [50, 36],
    });

    if (this.pickerMarker) {
      this.pickerMarker.setLatLng([this.lat, this.lng]);
    } else {
      this.pickerMarker = L.marker([this.lat, this.lng], { icon: pinIcon }).addTo(this.pickerMap);
    }
  }

  onDepartmentChange(): void {
    const coords = DEPARTMENT_COORDINATES[this.department];
    if (coords) {
      this.lat = coords.lat;
      this.lng = coords.lng;
      if (this.pickerMap) {
        this.pickerMap.setView([this.lat, this.lng], 11, { animate: true });
        this.updatePickerMarker();
      }
    }
  }

  onCoordinatesManualChange(): void {
    if (Number.isFinite(Number(this.lat)) && Number.isFinite(Number(this.lng)) && this.pickerMap) {
      this.pickerMap.setView([Number(this.lat), Number(this.lng)], 13);
      this.updatePickerMarker();
    }
  }

  async useCurrentGpsForChalet(): Promise<void> {
    const ok = await this.geoService.detectGPS();
    if (ok) {
      const loc = this.geoService.userLocation();
      this.lat = Number(loc.lat.toFixed(5));
      this.lng = Number(loc.lng.toFixed(5));
      if (this.pickerMap) {
        this.pickerMap.setView([this.lat, this.lng], 14, { animate: true });
        this.updatePickerMarker();
      }
      this.cdr.markForCheck();
    }
  }

  toggleAmenity(amenity: string): void {
    if (this.selectedAmenities.includes(amenity)) {
      this.selectedAmenities = this.selectedAmenities.filter(a => a !== amenity);
    } else {
      this.selectedAmenities.push(amenity);
    }
  }

  addRule(): void {
    if (this.newRule.trim()) {
      this.rulesList.push(this.newRule.trim());
      this.newRule = '';
    }
  }

  removeRule(index: number): void {
    this.rulesList.splice(index, 1);
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.imageError = '';

    if (this.selectedLocalImages.length + files.length > 10) {
      this.imageError = 'Puedes seleccionar un máximo de 10 imágenes.';
      input.value = '';
      return;
    }

    const invalidFile = files.find(file => !/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024);
    if (invalidFile) {
      this.imageError = 'Usa imágenes JPG, PNG, WEBP o GIF de hasta 8 MB cada una.';
      input.value = '';
      return;
    }

    this.selectedLocalImages.push(...files.map(file => ({ file, previewUrl: URL.createObjectURL(file) })));
    input.value = '';
  }

  removeLocalImage(index: number): void {
    const [removed] = this.selectedLocalImages.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
  }

  private clearLocalImages(): void {
    this.selectedLocalImages.forEach(image => URL.revokeObjectURL(image.previewUrl));
    this.selectedLocalImages = [];
  }

  onSubmit(): void {
    this.publishError = '';
    if (!this.mainImageUrl.trim() && this.selectedLocalImages.length === 0) {
      this.publishError = 'Agrega una URL de imagen o selecciona al menos una fotografía desde tu computadora.';
      return;
    }
    if (!this.title.trim() || !this.description.trim() || !this.pricePerNight) {
      this.publishError = 'Por favor completa el título, descripción y precio por noche del chalet.';
      return;
    }

    if (this.selectedLocalImages.length > 0) {
      this.isSubmitting = true;
      this.chaletService.uploadImages(this.selectedLocalImages.map(image => image.file)).subscribe({
        next: ({ urls }) => {
          const existingUrls = [this.mainImageUrl.trim(), ...this.additionalImages.split('\n').map(url => url.trim())].filter(Boolean);
          this.mainImageUrl = urls[0];
          this.additionalImages = [...urls.slice(1), ...existingUrls].join('\n');
          this.clearLocalImages();
          this.isSubmitting = false;
          this.onSubmit();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.publishError = err?.error?.message || 'No pudimos subir las imágenes. Inténtalo nuevamente.';
          this.cdr.markForCheck();
        }
      });
      return;
    }

    const imgs = [this.mainImageUrl.trim()];
    if (this.additionalImages.trim()) {
      const extra = this.additionalImages.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      imgs.push(...extra);
    }

    this.isSubmitting = true;

    const payload = {
      title: this.title.trim(),
      category: this.category,
      department: this.department,
      municipality: this.municipality.trim(),
      location: this.locationsText.split('\n').map(location => location.trim()).filter(Boolean).length
        ? this.locationsText.split('\n').map(location => location.trim()).filter(Boolean)
        : [`${this.municipality}, ${this.department}`],
      description: this.description.trim(),
      pricePerNight: Number(this.pricePerNight),
      deposit: Number(this.deposit),
      cleaningFee: Number(this.cleaningFee),
      guestsMax: Number(this.guestsMax),
      bedrooms: Number(this.bedrooms),
      beds: Number(this.beds),
      bathrooms: Number(this.bathrooms),
      images: imgs,
      thumbnail: imgs[0],
      amenities: this.selectedAmenities,
      rules: this.rulesList,
      status: this.status,
      coordinates: {
        lat: Number(this.lat),
        lng: Number(this.lng),
      },
      hostName: this.hostName.trim(),
      hostPhone: this.hostPhone.trim(),
      hostBio: this.hostBio.trim(),
    };

    const request$ = this.isEditMode
      ? this.chaletService.updateChalet(this.editChaletId, payload)
      : this.chaletService.createChalet(payload);

    request$.subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.publishSuccess = true;
        this.createdChaletId = res.data._id;
        void this.auth.refreshProfile();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error guardando chalet:', err);
        this.isSubmitting = false;
        this.publishError = err?.error?.message || 'Ocurrió un error al guardar el chalet en MongoDB.';
        this.cdr.markForCheck();
      }
    });
  }

  viewPublishedChalet(): void {
    if (this.createdChaletId) {
      void this.router.navigate(['/chalet', this.createdChaletId]);
    } else {
      void this.router.navigate(['/explore']);
    }
  }

  resetForm(): void {
    this.isEditMode = false;
    this.editChaletId = '';
    this.title = '';
    this.category = 'Lago';
    this.department = 'Sololá';
    this.municipality = 'San Marcos La Laguna';
    this.locationsText = 'Lago de Atitlán, Sololá';
    this.description = '';
    this.pricePerNight = 2200;
    this.deposit = 500;
    this.cleaningFee = 150;
    this.guestsMax = 6;
    this.bedrooms = 3;
    this.beds = 4;
    this.bathrooms = 2;
    this.status = 'disponible';
    this.lat = 14.7409;
    this.lng = -91.1591;
    this.selectedAmenities = ['Piscina privada', 'Wifi de alta velocidad', 'Parrilla BBQ'];
    this.rulesList = ['No fumar en habitaciones', 'Música moderada después de las 22:00'];
    this.publishSuccess = false;
    this.createdChaletId = '';
    this.publishError = '';
    this.imageError = '';
    this.clearLocalImages();
    setTimeout(() => this.initPickerMap(), 150);
  }
}
