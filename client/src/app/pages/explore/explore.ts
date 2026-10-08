import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';
import { Chalet, FilterParams } from '../../models/chalet.model';
import { ChaletCardComponent } from '../../components/chalet-card/chalet-card';
import { ChaletMapComponent } from '../../components/chalet-map/chalet-map';
import { ComparisonModalComponent } from '../../components/comparison-modal/comparison-modal';
import { GeolocationService } from '../../services/geolocation.service';
import { ComparisonService } from '../../services/comparison.service';
import { Subscription, timeout } from 'rxjs';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChaletCardComponent,
    ChaletMapComponent,
    ComparisonModalComponent
  ],
  templateUrl: './explore.html',
  styleUrl: './explore.css'
})
export class ExploreComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  chaletService = inject(ChaletService);
  geoService = inject(GeolocationService);
  compareService = inject(ComparisonService);

  chalets: Chalet[] = [];
  isLoading = true;
  loadError = '';
  private filtersRequest?: Subscription;

  // View Mode: 'split' (side-by-side list + map), 'grid' (traditional grid), 'map' (full-width interactive map)
  viewMode: 'split' | 'grid' | 'map' = 'split';
  selectedChalet: Chalet | null = null;

  // Filter state
  searchTerm = '';
  selectedDepartment = 'Todos';
  selectedCategory = 'Todas';
  selectedGuests = '';
  minRating: number | null = null;
  selectedSort = 'recommended';
  selectedAmenities: string[] = [];
  showFavoritesOnly = false;

  // Filter options
  departments: string[] = [
    'Todos',
    'Sololá',
    'Santa Rosa',
    'Sacatepéquez',
    'Izabal',
    'Chimaltenango',
    'Petén',
    'Escuintla',
    'Alta Verapaz'
  ];

  categories: string[] = ['Todas', 'Lago', 'Playa', 'Montaña', 'Colonial', 'Selva', 'Río'];

  amenitiesList = [
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
    'Kayaks y Paddleboards',
    'Parrilla BBQ'
  ];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchTerm = params['search'] || '';
      this.selectedDepartment = params['department'] || 'Todos';
      this.selectedCategory = params['category'] || 'Todas';
      this.selectedGuests = params['guests'] || '';
      this.minRating = params['minRating'] ? Number(params['minRating']) : null;
      this.selectedAmenities = params['amenities']
        ? String(params['amenities']).split(',').filter(Boolean)
        : [];
      this.showFavoritesOnly = params['favorites'] === 'true';

      this.applyFilters();
    });
  }

  toggleAmenity(amenity: string): void {
    if (this.selectedAmenities.includes(amenity)) {
      this.selectedAmenities = this.selectedAmenities.filter(a => a !== amenity);
    } else {
      this.selectedAmenities.push(amenity);
    }
    this.applyFilters();
  }

  toggleFavoritesFilter(): void {
    this.showFavoritesOnly = !this.showFavoritesOnly;
    const queryParams: any = { ...this.route.snapshot.queryParams };
    if (this.showFavoritesOnly) {
      queryParams['favorites'] = 'true';
    } else {
      delete queryParams['favorites'];
    }
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  applyFilters(): void {
    this.filtersRequest?.unsubscribe();
    this.isLoading = true;
    this.loadError = '';
    const params: FilterParams = {};

    if (this.searchTerm.trim()) params.search = this.searchTerm.trim();
    if (this.selectedDepartment !== 'Todos') params.department = this.selectedDepartment;
    if (this.selectedCategory !== 'Todas') params.category = this.selectedCategory;
    if (this.selectedGuests) params.guests = Number(this.selectedGuests);
    if (this.minRating) params.minRating = this.minRating;
    if (this.selectedAmenities.length > 0) params.amenities = this.selectedAmenities.join(',');
    if (this.selectedSort !== 'recommended' && this.selectedSort !== 'dist-asc') {
      params.sort = this.selectedSort;
    }

    this.filtersRequest = this.chaletService.getChalets(params).pipe(timeout(12000)).subscribe({
      next: (chalets) => {
        let list = chalets;
        if (this.showFavoritesOnly) {
          const favs = this.chaletService.favorites();
          list = list.filter(c => favs.includes(c._id));
        }
        this.chalets = list;
        if (this.selectedSort === 'dist-asc') {
          this.sortChaletsByDistance();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error filtrando chalets:', err);
        this.loadError = 'No pudimos actualizar los resultados. Mostramos los últimos chalets disponibles.';
        this.isLoading = false;
      }
    });
  }

  onSortChange(): void {
    if (this.selectedSort === 'dist-asc') {
      this.sortChaletsByDistance();
    } else {
      this.applyFilters();
    }
  }

  sortChaletsByDistance(): void {
    this.chalets = [...this.chalets].sort((a, b) => {
      const distA = (a.coordinates?.lat && a.coordinates?.lng)
        ? this.geoService.getDistanceToChalet(a.coordinates.lat, a.coordinates.lng)
        : 99999;
      const distB = (b.coordinates?.lat && b.coordinates?.lng)
        ? this.geoService.getDistanceToChalet(b.coordinates.lat, b.coordinates.lng)
        : 99999;
      return distA - distB;
    });
  }

  setViewMode(mode: 'split' | 'grid' | 'map'): void {
    this.viewMode = mode;
  }

  onChaletSelect(chalet: Chalet): void {
    this.selectedChalet = chalet;
  }

  setOriginCity(cityName: string): void {
    const city = this.geoService.referenceCities.find(c => c.name === cityName);
    if (city) {
      this.geoService.setReferenceCity(city);
      if (this.selectedSort === 'dist-asc') {
        this.sortChaletsByDistance();
      }
    }
  }

  async requestGps(): Promise<void> {
    await this.geoService.detectGPS();
    if (this.selectedSort === 'dist-asc') {
      this.sortChaletsByDistance();
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedDepartment = 'Todos';
    this.selectedCategory = 'Todas';
    this.selectedGuests = '';
    this.minRating = null;
    this.selectedSort = 'recommended';
    this.selectedAmenities = [];
    this.showFavoritesOnly = false;
    this.router.navigate(['/explore']);
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.searchTerm) count++;
    if (this.selectedDepartment !== 'Todos') count++;
    if (this.selectedCategory !== 'Todas') count++;
    if (this.selectedGuests) count++;
    if (this.minRating) count++;
    if (this.selectedAmenities.length > 0) count += this.selectedAmenities.length;
    if (this.showFavoritesOnly) count++;
    return count;
  }
}
