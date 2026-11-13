import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { BookingsComponent } from './bookings';
import { BookingService } from '../../services/booking.service';
import { ChaletService } from '../../services/chalet.service';
import { AuthService, AuthenticatedUser } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { UiDialogService } from '../../services/ui-dialog.service';
import { BookingItem } from '../../models/chalet.model';

describe('BookingsComponent (Panel de Reservaciones de Huésped y Anfitrión)', () => {
  let component: BookingsComponent;
  let fixture: ComponentFixture<BookingsComponent>;
  let mockBookings: BookingItem[];
  let currentUserSignal = signal<AuthenticatedUser | null>({
    _id: 'user-guest-1',
    name: 'Lucía Morales',
    email: 'lucia@tropicstay.gt',
    role: 'guest',
  });

  const bookingServiceMock = {
    getBookings: () => of({ success: true, count: mockBookings.length, data: mockBookings }),
    updateBookingStatus: (id: string, status: 'confirmada' | 'pendiente' | 'cancelada') => {
      const target = mockBookings.find((b) => b._id === id)!;
      const updated: BookingItem = { ...target, status };
      return of({ success: true, message: 'Actualizado', data: updated });
    },
  };

  const chaletServiceMock = {
    formatPrice: (gtq: number) => `Q${gtq.toLocaleString('es-GT')}`,
  };

  const authServiceMock = {
    user: currentUserSignal,
    isAuthenticated: () => currentUserSignal() !== null,
  };

  const bookingEvents$ = new Subject<{ type: 'created' | 'updated'; booking: BookingItem }>();
  const realtimeServiceMock = {
    isConnected: signal(true),
    bookingEvents$,
    messageEvents$: new Subject(),
    refreshCounts: () => {},
  };

  beforeEach(async () => {
    mockBookings = [
      {
        _id: 'b-guest-1',
        guest: { _id: 'user-guest-1', name: 'Lucía Morales', email: 'lucia@tropicstay.gt' },
        chalet: {
          _id: 'chalet-10',
          title: 'Chalet Lago Atitlán',
          thumbnail: 'img.jpg',
          pricePerNight: 1500,
          priceUSD: 190,
          department: 'Sololá',
          municipality: 'Panajachel',
          host: {
            _id: 'host-99',
            name: 'Sofía Méndez',
            email: 'sofia@tropicstay.gt',
            phone: '+502 5481-2290',
            avatar: 'avatar.jpg',
            verified: true,
            superhost: true,
            rating: 4.9,
            reviewsCount: 20,
            responseTime: '10 min',
            memberSince: '2022',
            bio: '',
          },
        },
        guestName: 'Lucía Morales',
        guestEmail: 'lucia@tropicstay.gt',
        guestPhone: '+502 5555-1234',
        checkIn: '2027-05-10T00:00:00.000Z',
        checkOut: '2027-05-12T00:00:00.000Z',
        guestsCount: 2,
        nights: 2,
        totalPriceGTQ: 3150,
        notes: 'Vista al lago',
        status: 'confirmada',
        createdAt: '2027-01-01T00:00:00.000Z',
      },
      {
        _id: 'b-host-1',
        guest: { _id: 'other-guest-2', name: 'Pedro Castillo', email: 'pedro@tropicstay.gt' },
        chalet: {
          _id: 'chalet-20',
          title: 'Mi Chalet en Monterrico',
          thumbnail: 'img2.jpg',
          pricePerNight: 1800,
          priceUSD: 230,
          department: 'Santa Rosa',
          municipality: 'Taxisco',
          host: {
            _id: 'user-guest-1',
            name: 'Lucía Morales',
            email: 'lucia@tropicstay.gt',
            phone: '+502 5555-1234',
            avatar: 'avatar2.jpg',
            verified: true,
            superhost: false,
            rating: 4.8,
            reviewsCount: 5,
            responseTime: '15 min',
            memberSince: '2023',
            bio: '',
          },
        },
        guestName: 'Pedro Castillo',
        guestEmail: 'pedro@tropicstay.gt',
        guestPhone: '+502 4444-9999',
        checkIn: '2027-06-01T00:00:00.000Z',
        checkOut: '2027-06-04T00:00:00.000Z',
        guestsCount: 4,
        nights: 3,
        totalPriceGTQ: 5550,
        notes: '',
        status: 'pendiente',
        createdAt: '2027-01-02T00:00:00.000Z',
      },
    ];

    await TestBed.configureTestingModule({
      imports: [BookingsComponent],
      providers: [
        provideRouter([]),
        { provide: BookingService, useValue: bookingServiceMock },
        { provide: ChaletService, useValue: chaletServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: RealtimeService, useValue: realtimeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('separa correctamente las reservas como huésped y las reservas recibidas como anfitrión', () => {
    expect(component.guestBookings.length).toBe(1);
    expect(component.guestBookings[0]._id).toBe('b-guest-1');

    expect(component.hostBookings.length).toBe(1);
    expect(component.hostBookings[0]._id).toBe('b-host-1');
  });

  it('filtra las reservas por estado (confirmada, pendiente, cancelada)', () => {
    component.activeTab = 'guest';
    component.statusFilter = 'confirmada';
    expect(component.filteredBookings.length).toBe(1);

    component.statusFilter = 'pendiente';
    expect(component.filteredBookings.length).toBe(0);

    component.activeTab = 'host';
    component.statusFilter = 'pendiente';
    expect(component.filteredBookings.length).toBe(1);
  });

  it('permite al anfitrión confirmar una reserva pendiente', () => {
    component.activeTab = 'host';
    const hostBooking = component.hostBookings[0];
    expect(hostBooking.status).toBe('pendiente');

    component.changeStatus(hostBooking, 'confirmada');
    expect(component.hostBookings[0].status).toBe('confirmada');
  });

  it('formatea fechas ISO sin desfase de zona horaria (UTC-6)', () => {
    const formatted = component.formatDate('2027-05-10T00:00:00.000Z');
    expect(formatted).toContain('10');
    expect(formatted).toContain('2027');
  });

  it('abre el mini chat flotante con el anfitrión o huésped y permite ampliarlo a /messages', () => {
    const router = TestBed.inject(Router);
    const chatWidget = TestBed.inject(ChatWidgetService);
    chatWidget.minimize();

    let navigatedArgs: any = null;
    router.navigate = ((commands: any, extras: any) => {
      navigatedArgs = { commands, extras };
      return Promise.resolve(true);
    }) as any;

    component.openInternalChat('host-99', 'chalet-10');
    expect(chatWidget.isOpen()).toBe(true);
    expect(chatWidget.activePartnerId()).toBe('host-99');
    expect(chatWidget.activeChaletId()).toBe('chalet-10');

    chatWidget.expandToFullPage();
    expect(chatWidget.isOpen()).toBe(false);
    expect(navigatedArgs.commands).toEqual(['/messages']);
    expect(navigatedArgs.extras).toEqual({
      queryParams: { userId: 'host-99', chaletId: 'chalet-10' },
    });
  });

  it('agrega en tiempo real nuevas solicitudes recibidas por el propietario sin recargar', () => {
    const newHostRequest: BookingItem = {
      _id: 'b-realtime-99',
      bookingType: 'cita',
      visitTime: '11:30 AM',
      guest: { _id: 'guest-55', name: 'Elena Torres', email: 'elena@tropicstay.gt' },
      chalet: {
        _id: 'chalet-20',
        title: 'Mi Chalet en Monterrico',
        host: { _id: 'user-guest-1', name: 'Lucía Morales', email: 'lucia@tropicstay.gt' },
      },
      guestName: 'Elena Torres',
      guestEmail: 'elena@tropicstay.gt',
      guestPhone: '+502 5555-7777',
      checkIn: '2027-07-01T00:00:00.000Z',
      checkOut: '2027-07-01T00:00:00.000Z',
      guestsCount: 2,
      nights: 0,
      totalPriceGTQ: 0,
      status: 'pendiente',
    };

    bookingEvents$.next({ type: 'created', booking: newHostRequest });
    expect(component.hostBookings.some((b) => b._id === 'b-realtime-99')).toBe(true);
    expect(component.highlightedBookingId).toBe('b-realtime-99');
  });

  it('usa el modal personalizado de TropicStay al cancelar una solicitud en lugar de window.confirm', async () => {
    const uiDialog = TestBed.inject(UiDialogService);
    const guestBooking = component.guestBookings[0];

    component.changeStatus(guestBooking, 'cancelada');
    expect(uiDialog.activeConfirm()).not.toBeNull();
    expect(uiDialog.activeConfirm()?.tone).toBe('danger');

    uiDialog.resolveConfirm(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.guestBookings[0].status).toBe('cancelada');
  });
});

