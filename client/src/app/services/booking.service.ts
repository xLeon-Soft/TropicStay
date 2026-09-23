import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BookingPayload } from '../models/chalet.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/bookings';

  createBooking(payload: BookingPayload): Observable<any> {
    return this.http.post(this.apiUrl, payload);
  }

  getBookings(): Observable<any> {
    return this.http.get(this.apiUrl);
  }
}
