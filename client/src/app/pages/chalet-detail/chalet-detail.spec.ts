import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChaletDetailComponent } from './chalet-detail';
import { ChaletService } from '../../services/chalet.service';
import { BookingService } from '../../services/booking.service';
import { AuthService, AuthenticatedUser } from '../../services/auth.service';
import { ChatMessage, MessageService } from '../../services/message.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { BookingItem, BookingPayload, Chalet } from '../../models/chalet.model';

describe('ChaletDetailComponent (Calendario y Flujo de Reserva con Anfitrión)', () => {
  let component: ChaletDetailComponent;
  let fixture: ComponentFixture<ChaletDetailComponent>;
  let createdBookingPayload: any = null;

  const mockChalet: Chalet = {
    _id: 'chalet-atitlan-1',
    title: 'Chalet Santuario del Lago',
    category: 'Lago',
    department: 'Sololá',
    municipality: 'San Marcos La Laguna',
    location: ['Lago de Atitlán'],
    description: 'Chalet frente al lago',
    pricePerNight: 2000,
    priceUSD: 255,
    cleaningFee: 200,
    rating: 4.95,
    reviewsCount: 12,
    guestsMax: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 3,
    featured: true,
    status: 'disponible',
    thumbnail: 'thumb.jpg',
    images: ['thumb.jpg'],
    amenities: ['Wi-Fi', 'Piscina'],
    rules: ['No fiestas'],
    coordinates: { lat: 14.72, lng: -91.25 },
    bookedDates: [
      {
        _id: 'existing-booking-1',
        checkIn: '2027-07-10T00:00:00.000Z',
        checkOut: '2027-07-14T00:00:00.000Z',
        status: 'confirmada',
      },
    ],
    host: {
      _id: 'host-sofia',
      name: 'Sofía Méndez',
      email: 'sofia@tropicstay.gt',
      phone: '+502 5481-2290',
      avatar: 'sofia.jpg',
      role: 'host',
      verified: true,
      superhost: true,
      rating: 4.98,
      reviewsCount: 64,
      responseTime: 'menos de 10 min',
      memberSince: '2022',
      bio: 'Anfitriona en Atitlán',
    },
  };

  const userSignal = signal<AuthenticatedUser | null>({
    _id: 'guest-user-1',
    name: 'Andrés Morales',
    email: 'andres@tropicstay.gt',
    phone: '+502 5511-2233',
    role: 'guest',
  });

  const chaletServiceMock = {
    getChaletById: () => of(mockChalet),
    formatPrice: (gtq: number) => `Q${gtq.toLocaleString('es-GT')}`,
    isFavorite: () => false,
    toggleFavorite: () => {},
  };

  const bookingServiceMock = {
    createBooking: (payload: BookingPayload) => {
      createdBookingPayload = payload;
      return of({
        success: true,
        message: 'Reserva confirmada correctamente.',
        data: {
          _id: 'new-booking-77',
          ...payload,
          checkOut: payload.checkOut || payload.checkIn,
          nights: 3,
          totalPriceGTQ: 6200,
          status: payload.status || 'confirmada',
          createdAt: '2027-01-01T00:00:00.000Z',
        },
      });
    },
  };

  const authServiceMock = {
    user: userSignal,
    isAuthenticated: () => userSignal() !== null,
  };

  const messageServiceMock = {
    getChatEligibility: () => of({ chatEnabled: false, appointmentStatus: 'none' as const, appointment: null }),
    getConversation: () => of({ partner: mockChalet.host, chalet: null, chatEnabled: true, messages: [] }),
    sendMessage: (_recipientId: string, content: string, _chaletId?: string) =>
      of({
        _id: 'msg-1',
        sender: { _id: 'guest-user-1', name: 'Andrés Morales' },
        recipient: { _id: 'host-sofia', name: 'Sofía Méndez' },
        content,
        createdAt: new Date().toISOString(),
        isMine: true,
      }),
  };

  const realtimeServiceMock = {
    messageEvents$: new Subject<ChatMessage>(),
    bookingEvents$: new Subject<{ type: 'created' | 'updated'; booking: BookingItem }>(),
    chaletEvents$: new Subject<{ type: 'created' | 'updated' | 'deleted'; chalet?: Chalet; chaletId?: string }>(),
    refreshCounts: () => {},
  };

  beforeEach(async () => {
    createdBookingPayload = null;

    await TestBed.configureTestingModule({
      imports: [ChaletDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ChaletService, useValue: chaletServiceMock },
        { provide: BookingService, useValue: bookingServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: RealtimeService, useValue: realtimeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChaletDetailComponent);
    component = fixture.componentInstance;
    component.loadChalet('chalet-atitlan-1');
    fixture.detectChanges();
  });

  it('bloquea correctamente las fechas ya reservadas en el calendario (isDateBooked y hasBookedDaysBetween)', () => {
    // Rango ocupado: 2027-07-10 al 2027-07-14 (noches 10, 11, 12, 13; salida el 14)
    expect(component.isDateBooked('2027-07-09')).toBe(false);
    expect(component.isDateBooked('2027-07-10')).toBe(true);
    expect(component.isDateBooked('2027-07-13')).toBe(true);
    expect(component.isDateBooked('2027-07-14')).toBe(false);

    // Un rango del 08 al 15 cruza los días ocupados
    expect(component.hasBookedDaysBetween('2027-07-08', '2027-07-15')).toBe(true);
    // Un rango del 14 al 17 está libre
    expect(component.hasBookedDaysBetween('2027-07-14', '2027-07-17')).toBe(false);
  });

  it('calcula correctamente las noches, subtotal, limpieza y total estimado', () => {
    component.checkInDate = '2027-08-01';
    component.checkOutDate = '2027-08-04';

    expect(component.nightsCount).toBe(3);
    expect(component.baseTotal).toBe(6000);
    expect(component.cleaningFee).toBe(200);
    expect(component.grandTotal).toBe(6200);
  });

  it('impide enviar una reserva si el rango seleccionado incluye fechas ocupadas', () => {
    component.checkInDate = '2027-07-09';
    component.checkOutDate = '2027-07-12';
    component.bookingName = 'Andrés Morales';
    component.bookingEmail = 'andres@tropicstay.gt';
    component.bookingPhone = '+502 5511-2233';
    component.bookingGuests = 2;

    component.submitBooking();

    expect(component.bookingSuccess).toBe(false);
    expect(component.bookingError).toContain('ya están reservadas');
    expect(createdBookingPayload).toBeNull();
  });

  it('envía la reserva correctamente y agrega las nuevas fechas a bookedDates', () => {
    component.checkInDate = '2027-08-10';
    component.checkOutDate = '2027-08-13';
    component.bookingName = 'Andrés Morales';
    component.bookingEmail = 'andres@tropicstay.gt';
    component.bookingPhone = '+502 5511-2233';
    component.bookingGuests = 4;
    component.bookingNotes = 'Llegamos al mediodía';

    component.submitBooking();

    expect(component.bookingError).toBe('');
    expect(component.bookingSuccess).toBe(true);
    expect(createdBookingPayload).toEqual({
      chaletId: 'chalet-atitlan-1',
      bookingType: 'reserva',
      status: 'pendiente',
      guestName: 'Andrés Morales',
      guestEmail: 'andres@tropicstay.gt',
      guestPhone: '+502 5511-2233',
      checkIn: '2027-08-10',
      checkOut: '2027-08-13',
      guestsCount: 4,
      notes: 'Llegamos al mediodía',
    });
    expect(component.isDateBooked('2027-08-11')).toBe(true);
  });

  it('permite pedir una cita/visita (bookingMode: "cita") con fecha y horario sin bloquear noches', () => {
    component.setBookingMode('cita');
    component.checkInDate = '2027-08-20';
    component.visitTime = '02:00 PM';
    component.bookingName = 'Andrés Morales';
    component.bookingEmail = 'andres@tropicstay.gt';
    component.bookingPhone = '+502 5511-2233';
    component.bookingGuests = 2;
    component.bookingNotes = 'Quisiera ver el chalet antes de alquilar';

    component.submitBooking();

    expect(component.bookingError).toBe('');
    expect(component.bookingSuccess).toBe(true);
    expect(component.lastCreatedType).toBe('cita');
    expect(createdBookingPayload).toEqual({
      chaletId: 'chalet-atitlan-1',
      bookingType: 'cita',
      visitTime: '02:00 PM',
      status: 'pendiente',
      guestName: 'Andrés Morales',
      guestEmail: 'andres@tropicstay.gt',
      guestPhone: '+502 5511-2233',
      checkIn: '2027-08-20',
      guestsCount: 2,
      notes: 'Quisiera ver el chalet antes de alquilar',
    });
  });

  it('exige cita aceptada para habilitar el chat y abre el mini chat flotante cuando está aceptada (sin WhatsApp)', () => {
    const chatWidget = TestBed.inject(ChatWidgetService);
    chatWidget.minimize();

    // 1. Sin cita aceptada: guía a pedir cita y no abre el chat
    component.openHostChat();
    expect(component.bookingMode).toBe('cita');
    expect(component.chatLockNotice).toContain('primero solicita una cita');
    expect(chatWidget.isOpen()).toBe(false);

    // 2. Con cita aceptada: abre el mini chat estilo Instagram en el sistema
    component.chatEligibility = {
      chatEnabled: true,
      appointmentStatus: 'confirmada',
      appointment: null,
    };
    component.openHostChat();
    expect(chatWidget.isOpen()).toBe(true);
    expect(chatWidget.activePartnerId()).toBe('host-sofia');
    expect(chatWidget.activeChaletId()).toBe('chalet-atitlan-1');

    // 3. No debe existir ningún enlace de WhatsApp en la vista
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html.toLowerCase()).not.toContain('wa.me');
  });

  it('renderiza correctamente un chalet legacy con locationName cuando no tiene arreglo location', () => {
    const legacyChalet = {
      ...mockChalet,
      _id: 'legacy-coban-1',
      title: 'Chalet Cascada & Orquídeas',
      location: undefined as unknown as string[],
      locationName: 'Ruta a Semuc Champey, Alta Verapaz',
    };
    vi.spyOn(chaletServiceMock, 'getChaletById').mockReturnValueOnce(of(legacyChalet as Chalet));

    component.loadChalet('legacy-coban-1');
    fixture.detectChanges();

    expect(component.formattedLocation).toBe('Ruta a Semuc Champey, Alta Verapaz');
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Ruta a Semuc Champey, Alta Verapaz');
    expect(text).toContain('Sofía Méndez');
  });

  it('actualiza el estado del chalet (disponible, reservado, mantenimiento) en tiempo real vía SSE', () => {
    realtimeServiceMock.chaletEvents$.next({
      type: 'updated',
      chalet: { ...mockChalet, status: 'reservado' },
    });
    fixture.detectChanges();
    expect(component.chalet?.status).toBe('reservado');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reservado');

    realtimeServiceMock.chaletEvents$.next({
      type: 'updated',
      chalet: { ...mockChalet, status: 'mantenimiento' },
    });
    fixture.detectChanges();
    expect(component.chalet?.status).toBe('mantenimiento');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('En Mantenimiento');

    realtimeServiceMock.chaletEvents$.next({
      type: 'updated',
      chalet: { ...mockChalet, status: 'disponible' },
    });
    fixture.detectChanges();
    expect(component.chalet?.status).toBe('disponible');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Disponible');
  });
});
