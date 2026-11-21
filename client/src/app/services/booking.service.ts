import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BookingItem, BookingPayload } from '../models/chalet.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/bookings`;

  createBooking(payload: BookingPayload): Observable<{ success: boolean; message: string; data: BookingItem }> {
    return this.http.post<{ success: boolean; message: string; data: BookingItem }>(this.apiUrl, payload);
  }

  getBookings(filters?: { status?: string; chaletId?: string }): Observable<{ success: boolean; count: number; data: BookingItem[] }> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.chaletId) params = params.set('chaletId', filters.chaletId);
    return this.http.get<{ success: boolean; count: number; data: BookingItem[] }>(this.apiUrl, { params });
  }

  getSummary(): Observable<{ success: boolean; data: { pendingHostCount: number; totalGuestCount: number } }> {
    return this.http.get<{ success: boolean; data: { pendingHostCount: number; totalGuestCount: number } }>(`${this.apiUrl}/summary`);
  }

  getBookingById(id: string): Observable<{ success: boolean; data: BookingItem }> {
    return this.http.get<{ success: boolean; data: BookingItem }>(`${this.apiUrl}/${id}`);
  }

  updateBookingStatus(id: string, status: 'confirmada' | 'pendiente' | 'cancelada'): Observable<{ success: boolean; message: string; data: BookingItem }> {
    return this.http.patch<{ success: boolean; message: string; data: BookingItem }>(`${this.apiUrl}/${id}/status`, { status });
  }

  deleteBooking(id: string): Observable<{ success: boolean; message: string; data: { _id: string } }> {
    return this.http.delete<{ success: boolean; message: string; data: { _id: string } }>(`${this.apiUrl}/${id}`);
  }
}
