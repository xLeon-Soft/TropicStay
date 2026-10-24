import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { Chalet, FilterParams, Review, Host } from '../models/chalet.model';
import { environment } from '../../environments/environment';

export interface DestinationOption {
  name: string;
  categories: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ChaletService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;
  private allChalets$?: Observable<Chalet[]>;
  private destinations$?: Observable<DestinationOption[]>;
  private hosts$?: Observable<Host[]>;

  // State signals
  currency = signal<'GTQ' | 'USD'>('GTQ');
  favorites = signal<string[]>(this.loadFavorites());

  // Toggle favorite
  toggleFavorite(chaletId: string): void {
    const current = this.favorites();
    if (current.includes(chaletId)) {
      const updated = current.filter(id => id !== chaletId);
      this.favorites.set(updated);
      localStorage.setItem('tropicstay_favs', JSON.stringify(updated));
    } else {
      const updated = [...current, chaletId];
      this.favorites.set(updated);
      localStorage.setItem('tropicstay_favs', JSON.stringify(updated));
    }
  }

  isFavorite(chaletId: string): boolean {
    return this.favorites().includes(chaletId);
  }

  private loadFavorites(): string[] {
    try {
      const saved = localStorage.getItem('tropicstay_favs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  // Currency switcher
  setCurrency(curr: 'GTQ' | 'USD'): void {
    this.currency.set(curr);
  }

  formatPrice(priceGTQ: number, priceUSD?: number): string {
    if (this.currency() === 'USD') {
      const usd = priceUSD || Math.round(priceGTQ / 7.78);
      return `$${usd.toLocaleString('en-US')}`;
    }
    return `Q${priceGTQ.toLocaleString('es-GT')}`;
  }

  // API Methods
  getChalets(params?: FilterParams): Observable<Chalet[]> {
    if (!params || Object.keys(params).length === 0) {
      this.allChalets$ ??= this.fetchChalets().pipe(shareReplay({ bufferSize: 1, refCount: false }));
      return this.allChalets$;
    }

    return this.fetchChalets(params);
  }

  private fetchChalets(params?: FilterParams): Observable<Chalet[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.department && params.department !== 'Todos') httpParams = httpParams.set('department', params.department);
      if (params.municipality && params.municipality !== 'Todos') httpParams = httpParams.set('municipality', params.municipality);
      if (params.category && params.category !== 'Todas') httpParams = httpParams.set('category', params.category);
      if (params.minPrice) httpParams = httpParams.set('minPrice', params.minPrice.toString());
      if (params.maxPrice) httpParams = httpParams.set('maxPrice', params.maxPrice.toString());
      if (params.guests) httpParams = httpParams.set('guests', params.guests.toString());
      if (params.minRating) httpParams = httpParams.set('minRating', params.minRating.toString());
      if (params.amenities) httpParams = httpParams.set('amenities', params.amenities);
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
    }

    return this.http.get<{ success: boolean; count: number; data: Chalet[] }>(`${this.apiUrl}/chalets`, { params: httpParams })
      .pipe(map(res => res.data));
  }

  getChaletById(id: string): Observable<Chalet> {
    return this.http.get<{ success: boolean; data: Chalet }>(`${this.apiUrl}/chalets/${id}`)
      .pipe(map(res => res.data));
  }

  createChalet(chaletData: any): Observable<{ success: boolean; data: Chalet }> {
    return this.http.post<{ success: boolean; data: Chalet }>(`${this.apiUrl}/chalets`, chaletData)
      .pipe(tap(() => this.invalidateCatalogCache()));
  }

  uploadImages(files: File[]): Observable<{ success: boolean; urls: string[] }> {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    return this.http.post<{ success: boolean; urls: string[] }>(`${this.apiUrl}/uploads/images`, formData);
  }

  addReview(chaletId: string, review: Partial<Review>): Observable<any> {
    return this.http.post(`${this.apiUrl}/chalets/${chaletId}/reviews`, review);
  }

  getDepartments(): Observable<string[]> {
    return this.http.get<{ success: boolean; data: string[] }>(`${this.apiUrl}/chalets/meta/departments`)
      .pipe(map(res => res.data));
  }

  getDestinations(): Observable<DestinationOption[]> {
    this.destinations$ ??= this.http
      .get<{ success: boolean; data: DestinationOption[] }>(`${this.apiUrl}/chalets/meta/destinations`)
      .pipe(map(res => res.data), shareReplay({ bufferSize: 1, refCount: false }));
    return this.destinations$;
  }

  getHostById(hostId: string): Observable<Host & { chalets: Chalet[]; chaletsCount: number }> {
    return this.http.get<{ success: boolean; data: Host & { chalets: Chalet[]; chaletsCount: number } }>(`${this.apiUrl}/hosts/${hostId}`)
      .pipe(map(res => res.data));
  }

  getHosts(): Observable<Host[]> {
    this.hosts$ ??= this.http.get<{ success: boolean; data: Host[] }>(`${this.apiUrl}/hosts`)
      .pipe(map(res => res.data), shareReplay({ bufferSize: 1, refCount: false }));
    return this.hosts$;
  }

  private invalidateCatalogCache(): void {
    this.allChalets$ = undefined;
    this.destinations$ = undefined;
    this.hosts$ = undefined;
  }
}
