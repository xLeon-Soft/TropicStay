import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChaletMapComponent } from './chalet-map';
import { ChaletService } from '../../services/chalet.service';
import { GeolocationService, LocationPoint } from '../../services/geolocation.service';
import { Chalet } from '../../models/chalet.model';

describe('ChaletMapComponent (Recorrido y trazado de ruta)', () => {
  let component: ChaletMapComponent;
  let fixture: ComponentFixture<ChaletMapComponent>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const sampleChalet: Chalet = {
    _id: 'chalet-palopo-1',
    title: 'Chalet Mirador Esmeralda',
    category: 'Lago',
    department: 'Sololá',
    municipality: 'Santa Catarina Palopó',
    location: ['Lago de Atitlán'],
    description: 'Vista al lago',
    pricePerNight: 1650,
    priceUSD: 210,
    cleaningFee: 150,
    rating: 4.9,
    reviewsCount: 8,
    guestsMax: 6,
    bedrooms: 3,
    beds: 3,
    bathrooms: 2,
    featured: true,
    status: 'disponible',
    thumbnail: 'thumb.jpg',
    images: ['thumb.jpg'],
    amenities: ['Wi-Fi'],
    rules: ['Sin fiestas'],
    coordinates: { lat: 14.7219, lng: -91.1322 },
    host: {
      _id: 'host-1',
      name: 'Elena Asturias',
      email: 'elena@tropicstay.gt',
      phone: '+502 5555-0000',
      avatar: 'elena.jpg',
      role: 'host',
      verified: true,
      superhost: true,
      rating: 4.9,
      reviewsCount: 15,
      responseTime: '10 min',
      memberSince: '2023',
      bio: 'Anfitriona',
    },
  };

  const userLocationSignal = signal<LocationPoint>({
    name: 'Ciudad de Guatemala',
    lat: 14.6349,
    lng: -90.5069,
    isGPS: false,
  });

  const isLocatingSignal = signal<boolean>(false);

  const geoServiceMock = {
    userLocation: userLocationSignal,
    isLocating: isLocatingSignal,
    getDistanceToChalet: (lat?: number, lng?: number) => {
      if (!lat || !lng) return 0;
      return 68;
    },
    formatDistance: (km: number) => `${km} km`,
    getGoogleMapsDirectionsUrl: (lat: number, lng: number) =>
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    detectGPS: vi.fn(async () => {
      userLocationSignal.set({
        name: 'Mi ubicación actual (GPS)',
        lat: 14.692,
        lng: -90.642,
        isGPS: true,
      });
      return true;
    }),
  };

  const chaletServiceMock = {
    formatPrice: (gtq: number) => `Q${gtq.toLocaleString('es-GT')}`,
  };

  beforeEach(async () => {
    userLocationSignal.set({
      name: 'Ciudad de Guatemala',
      lat: 14.6349,
      lng: -90.5069,
      isGPS: false,
    });
    isLocatingSignal.set(false);
    geoServiceMock.detectGPS.mockClear();

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            distance: 95400,
            duration: 6900,
            geometry: {
              coordinates: [
                [-90.5069, 14.6349],
                [-90.85, 14.68],
                [-91.1322, 14.7219],
              ],
            },
          },
        ],
      }),
    } as Response);

    await TestBed.configureTestingModule({
      imports: [ChaletMapComponent],
      providers: [
        provideRouter([]),
        { provide: ChaletService, useValue: chaletServiceMock },
        { provide: GeolocationService, useValue: geoServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChaletMapComponent);
    component = fixture.componentInstance;
    component.chalets = [sampleChalet];
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('muestra la opción "Recorrido" y traza la ruta por carretera OSRM desde la ubicación del usuario hacia el chalet', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const routeBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Recorrido')
    );

    expect(routeBtn).toBeTruthy();
    expect(component.activeRouteInfo).toBeNull();

    routeBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(component.activeRouteInfo).toMatchObject({
      chaletId: 'chalet-palopo-1',
      chaletTitle: 'Chalet Mirador Esmeralda',
      distanceKm: '95.4',
      durationFormatted: '1h 55m',
      originName: 'Ciudad de Guatemala',
      isEstimated: false,
    });

    const banner = el.querySelector('.active-route-banner');
    expect(banner?.textContent).toContain('Chalet Mirador Esmeralda');
    expect(banner?.textContent).toContain('95.4 km');
    expect((component as any).routeLayer.getLayers().length).toBeGreaterThanOrEqual(2);
  });

  it('dibuja un trazo directo estimado cuando OSRM no está disponible y permite ocultarlo/volver a trazarlo', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    await component.traceActiveRoute();
    fixture.detectChanges();

    expect(component.activeRouteInfo).toMatchObject({
      chaletId: 'chalet-palopo-1',
      distanceKm: '68',
      originName: 'Ciudad de Guatemala',
      isEstimated: true,
    });
    expect((component as any).routeLayer.getLayers().length).toBeGreaterThanOrEqual(2);
    expect(fixture.nativeElement.textContent).toContain('Trazo directo');

    component.toggleRoute();
    fixture.detectChanges();

    expect(component.activeRouteInfo).toBeNull();
    expect((component as any).routeLayer.getLayers().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Recorrido');
  });

  it('actualiza la ubicación con "Mi GPS" y recalcula el recorrido hacia el chalet', async () => {
    await component.focusUserAndTrace();
    fixture.detectChanges();

    expect(geoServiceMock.detectGPS).toHaveBeenCalledTimes(1);
    expect(component.activeRouteInfo?.originName).toBe('Mi ubicación actual (GPS)');
  });
});

