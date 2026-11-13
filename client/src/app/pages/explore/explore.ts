import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { RealtimeService } from '../../services/realtime.service';
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
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private realtime = inject(RealtimeService);
  chaletService = inject(ChaletService);
  geoService = inject(GeolocationService);
  compareService = inject(ComparisonService);

  private readonly _chalets = signal<Chalet[]>([]);
  private readonly _isLoading = signal(true);
  private readonly _selectedChalet = signal<Chalet | null>(null);

  get chalets(): Chalet[] {
    return this._chalets();
  }
  set chalets(value: Chalet[]) {
    this._chalets.set(value);
  }

  get isLoading(): boolean {
    return this._isLoading();
  }
  set isLoading(value: boolean) {
    this._isLoading.set(value);
  }

  loadError = '';
  private filtersRequest?: Subscription;

  // View Mode: 'split' (side-by-side list + map), 'grid' (traditional grid), 'map' (full-width interactive map)
  viewMode: 'split' | 'grid' | 'map' = 'grid';

  get selectedChalet(): Chalet | null {
    return this._selectedChalet();
  }
  set selectedChalet(value: Chalet | null) {
    this._selectedChalet.set(value);
  }

  // Filter state
  searchTerm = '';
  selectedDepartment = 'Todos';
  selectedDestination = 'Todos';
  selectedCategory = 'Todas';
  selectedGuests = '';
  minPrice: number | null = null;
  maxPrice: number | null = null;
  checkIn = '';
  checkOut = '';
  minRating: number | null = null;
  selectedSort = 'recommended';
  selectedAmenities: string[] = [];
  showFavoritesOnly = false;

  // Filter options
  departments: string[] = ['Todos'];
  destinations: string[] = ['Todos'];
  categories: string[] = ['Todas'];
  amenitiesList: string[] = [];
  guestOptions: number[] = [];
  ratingOptions: number[] = [];

  ngOnInit(): void {
    this.loadFilterOptions();
    this.route.queryParams.subscribe(params => {
      this.searchTerm = params['search'] || '';
      this.selectedDepartment = params['department'] || 'Todos';
      this.selectedDestination = params['destination'] || 'Todos';
      this.selectedCategory = params['category'] || 'Todas';
      this.selectedGuests = params['guests'] || '';
      this.minPrice = params['minPrice'] ? Number(params['minPrice']) : null;
      this.maxPrice = params['maxPrice'] ? Number(params['maxPrice']) : null;
      this.checkIn = params['checkIn'] || '';
      this.checkOut = params['checkOut'] || '';
      this.minRating = params['minRating'] ? Number(params['minRating']) : null;
      this.selectedAmenities = params['amenities']
        ? String(params['amenities']).split(',').filter(Boolean)
        : [];
      this.showFavoritesOnly = params['favorites'] === 'true';

      this.applyFilters();
    });

    this.realtime.chaletEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.type === 'updated' && event.chalet) {
          const updated = event.chalet;
          this.chalets = this.chalets.map((c) => (c._id === updated._id ? { ...c, ...updated } : c));
          if (this.selectedChalet?._id === updated._id) {
            this.selectedChalet = { ...this.selectedChalet, ...updated };
          }
          this.cdr.markForCheck();
        } else if (event.type === 'deleted' && event.chaletId) {
          this.chalets = this.chalets.filter((c) => c._id !== event.chaletId);
          if (this.selectedChalet?._id === event.chaletId) {
            this.selectedChalet = null;
          }
          this.cdr.markForCheck();
        } else if (event.type === 'created') {
          this.applyFilters();
        }
      });
  }

  private loadFilterOptions(): void {
    this.chaletService.getChalets().pipe(timeout(12000)).subscribe({
      next: (chalets) => {
        this.departments = ['Todos', ...this.uniqueSorted(chalets.map((chalet) => chalet.department))];
        this.destinations = ['Todos', ...this.uniqueSorted(chalets.map((chalet) => chalet.municipality))];
        this.categories = ['Todas', ...this.uniqueSorted(chalets.map((chalet) => chalet.category))];
        this.amenitiesList = this.uniqueSorted(chalets.flatMap((chalet) => chalet.amenities || []));
        this.guestOptions = [...new Set(chalets.map((chalet) => chalet.guestsMax))].sort((first, second) => first - second);
        this.ratingOptions = [...new Set(chalets.map((chalet) => Number(chalet.rating.toFixed(1))))]
          .sort((first, second) => second - first);

        const previousDepartment = this.selectedDepartment;
        const previousDestination = this.selectedDestination;
        const previousCategory = this.selectedCategory;
        const previousAmenities = this.selectedAmenities;
        if (!this.departments.includes(this.selectedDepartment)) this.selectedDepartment = 'Todos';
        if (!this.destinations.includes(this.selectedDestination)) this.selectedDestination = 'Todos';
        if (!this.categories.includes(this.selectedCategory)) this.selectedCategory = 'Todas';
        this.selectedAmenities = this.selectedAmenities.filter((amenity) => this.amenitiesList.includes(amenity));

        const filtersChanged = previousDepartment !== this.selectedDepartment
          || previousDestination !== this.selectedDestination
          || previousCategory !== this.selectedCategory
          || previousAmenities.length !== this.selectedAmenities.length;
        if (filtersChanged) {
          this.applyFilters();
          return;
        }
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error cargando opciones de filtros:', error),
    });
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((first, second) => first.localeCompare(second, 'es'));
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
    if (this.selectedDestination !== 'Todos') params.municipality = this.selectedDestination;
    if (this.selectedCategory !== 'Todas') params.category = this.selectedCategory;
    if (this.selectedGuests) params.guests = Number(this.selectedGuests);
    if (this.minPrice && this.minPrice > 0) params.minPrice = Number(this.minPrice);
    if (this.maxPrice && this.maxPrice > 0) params.maxPrice = Number(this.maxPrice);
    if (this.checkIn && this.checkOut && this.checkOut > this.checkIn) {
      params.checkIn = this.checkIn;
      params.checkOut = this.checkOut;
    }
    if (this.minRating) params.minRating = this.minRating;
    if (this.selectedAmenities.length > 0) params.amenities = this.selectedAmenities.join(',');
    if (this.selectedSort !== 'recommended' && this.selectedSort !== 'dist-asc') {
      params.sort = this.selectedSort;
    }

    const requestParams = Object.keys(params).length > 0 ? params : undefined;
    this.filtersRequest = this.chaletService.getChalets(requestParams).pipe(timeout(12000)).subscribe({
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
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error filtrando chalets:', err);
        this.loadError = 'No pudimos actualizar los resultados. Mostramos los últimos chalets disponibles.';
        this.isLoading = false;
        this.cdr.markForCheck();
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
    this.selectedDestination = 'Todos';
    this.selectedCategory = 'Todas';
    this.selectedGuests = '';
    this.minPrice = null;
    this.maxPrice = null;
    this.checkIn = '';
    this.checkOut = '';
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
    if (this.selectedDestination !== 'Todos') count++;
    if (this.selectedCategory !== 'Todas') count++;
    if (this.selectedGuests) count++;
    if (this.minPrice) count++;
    if (this.maxPrice) count++;
    if (this.checkIn && this.checkOut) count++;
    if (this.minRating) count++;
    if (this.selectedAmenities.length > 0) count += this.selectedAmenities.length;
    if (this.showFavoritesOnly) count++;
    return count;
  }
}
