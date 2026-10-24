import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BookingPayload } from '../models/chalet.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/bookings`;

  createBooking(payload: BookingPayload): Observable<any> {
    return this.http.post(this.apiUrl, payload);
  }

  getBookings(): Observable<any> {
    return this.http.get(this.apiUrl);
  }
}
