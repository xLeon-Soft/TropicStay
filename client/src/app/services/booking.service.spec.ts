import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BookingService } from './booking.service';
import { BookingPayload } from '../models/chalet.model';

describe('BookingService (Módulo de Reservaciones)', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BookingService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe crear una reservación mediante POST /api/bookings', () => {
    const payload: BookingPayload = {
      chaletId: '665000000000000000000001',
      guestName: 'Carlos Ramírez',
      guestEmail: 'carlos@tropicstay.gt',
      guestPhone: '+502 5555-8888',
      checkIn: '2027-03-10',
      checkOut: '2027-03-13',
      guestsCount: 4,
      notes: 'Llegada por la tarde',
    };

    let responseData: any;
    service.createBooking(payload).subscribe((res) => {
      responseData = res;
    });

    const req = httpMock.expectOne('/api/bookings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({
      success: true,
      message: 'Reserva confirmada correctamente.',
      data: {
        _id: 'booking-123',
        ...payload,
        nights: 3,
        totalPriceGTQ: 4650,
        status: 'confirmada',
        createdAt: '2027-01-01T00:00:00.000Z',
      },
    });

    expect(responseData.success).toBe(true);
    expect(responseData.data._id).toBe('booking-123');
    expect(responseData.data.nights).toBe(3);
  });

  it('debe obtener reservaciones con filtros opcionales en GET /api/bookings', () => {
    let count = 0;
    service.getBookings({ status: 'confirmada', chaletId: 'chalet-1' }).subscribe((res) => {
      count = res.count;
    });

    const req = httpMock.expectOne(
      (r) => r.url === '/api/bookings' && r.params.get('status') === 'confirmada' && r.params.get('chaletId') === 'chalet-1'
    );
    expect(req.request.method).toBe('GET');

    req.flush({ success: true, count: 2, data: [] });
    expect(count).toBe(2);
  });

  it('debe actualizar el estado de una reservación mediante PATCH /api/bookings/:id/status', () => {
    let updatedStatus = '';
    service.updateBookingStatus('booking-99', 'cancelada').subscribe((res) => {
      updatedStatus = res.data.status;
    });

    const req = httpMock.expectOne('/api/bookings/booking-99/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'cancelada' });

    req.flush({
      success: true,
      message: 'Estado de reserva actualizado.',
      data: { _id: 'booking-99', status: 'cancelada' },
    });

    expect(updatedStatus).toBe('cancelada');
  });
});

