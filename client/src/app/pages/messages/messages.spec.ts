import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { MessagesComponent } from './messages';
import { ChatMessage, ConversationSummary, MessageService } from '../../services/message.service';
import { ChaletService } from '../../services/chalet.service';
import { RealtimeService } from '../../services/realtime.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import { BookingItem } from '../../models/chalet.model';

describe('MessagesComponent (Chat Amplio y Sincronización en Tiempo Real)', () => {
  let component: MessagesComponent;
  let fixture: ComponentFixture<MessagesComponent>;
  let mockConversations: ConversationSummary[];
  let mockMessages: ChatMessage[];

  const messageEvents$ = new Subject<ChatMessage>();
  const readEvents$ = new Subject<{ partnerId: string }>();
  const bookingEvents$ = new Subject<{ type: 'created' | 'updated'; booking: BookingItem }>();

  const partnerOne = {
    _id: 'partner-1',
    name: 'Alexander De León',
    email: 'xleon04gd@gmail.com',
    phone: '+502 5555-1001',
    avatar: 'avatar1.jpg',
    role: 'host' as const,
    verified: true,
    superhost: true,
    rating: 4.9,
    reviewsCount: 10,
    responseTime: '15 min',
    memberSince: '2024',
    bio: '',
  };

  const partnerTwo = {
    _id: 'partner-2',
    name: 'Sofía Méndez',
    email: 'sofia@tropicstay.gt',
    phone: '+502 5555-2002',
    avatar: 'avatar2.jpg',
    role: 'guest' as const,
    verified: true,
    superhost: true,
    rating: 5,
    reviewsCount: 22,
    responseTime: '10 min',
    memberSince: '2023',
    bio: '',
  };

  const chaletOne = {
    _id: 'chalet-1',
    title: 'Chalet Mirador Esmeralda',
    thumbnail: 'thumb.jpg',
    pricePerNight: 1650,
    priceUSD: 216,
    municipality: 'Santa Catarina Palopó',
    department: 'Sololá',
  };

  const messageServiceMock = {
    getConversations: () => of(mockConversations),
    getConversation: (userId: string) => {
      const match = mockConversations.find((c) => c.partner._id === userId) || mockConversations[0];
      return of({
        partner: match.partner,
        chalet: match.chalet || null,
        chatEnabled: true,
        appointmentStatus: 'confirmada' as const,
        messages: mockMessages,
      });
    },
    sendMessage: (recipientId: string, content: string) =>
      of({
        _id: `msg-${Date.now()}`,
        sender: partnerOne,
        recipient: mockConversations.find((c) => c.partner._id === recipientId)?.partner || partnerTwo,
        chalet: chaletOne,
        content,
        createdAt: '2026-11-13T18:30:00.000Z',
        readAt: null,
        isMine: true,
      } satisfies ChatMessage),
  };

  const chaletServiceMock = {
    formatPrice: (gtq: number) => `Q${gtq.toLocaleString('es-GT')}`,
  };

  const realtimeServiceMock = {
    isConnected: signal(true),
    unreadMessages: signal(1),
    pendingHostBookings: signal(0),
    notifications: signal([]),
    messageEvents$,
    readEvents$,
    bookingEvents$,
    refreshCounts: () => {},
  };

  beforeEach(async () => {
    mockMessages = [
      {
        _id: 'm-1',
        sender: partnerOne,
        recipient: partnerTwo,
        chalet: chaletOne,
        content: 'Hola, ya acepté tu cita para hoy.',
        createdAt: '2026-11-13T18:20:00.000Z',
        readAt: null,
        isMine: true,
      },
    ];

    mockConversations = [
      {
        partner: partnerOne,
        chalet: chaletOne,
        lastMessage: mockMessages[0],
        chatEnabled: true,
        unreadCount: 1,
      },
      {
        partner: partnerTwo,
        chalet: chaletOne,
        lastMessage: null,
        chatEnabled: true,
        unreadCount: 0,
      },
    ];

    await TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        provideRouter([]),
        { provide: MessageService, useValue: messageServiceMock },
        { provide: ChaletService, useValue: chaletServiceMock },
        { provide: RealtimeService, useValue: realtimeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga todos los chats activos y oculta el chat miniatura al entrar al chat amplio', () => {
    const chatWidget = TestBed.inject(ChatWidgetService);

    expect(component.isLoading()).toBe(false);
    expect(component.conversations().length).toBe(2);
    expect(component.selectedPartner()?._id).toBe('partner-1');
    expect(chatWidget.isOnMessagesRoute()).toBe(true);
    expect(chatWidget.isOpen()).toBe(false);
  });

  it('actualiza mensajes, barra lateral y estado de lectura en tiempo real', () => {
    const incoming: ChatMessage = {
      _id: 'm-live-2',
      sender: partnerOne,
      recipient: partnerTwo,
      chalet: chaletOne,
      content: 'Nos vemos a las 2pm en el embarcadero',
      createdAt: '2026-11-13T18:25:00.000Z',
      readAt: null,
      isMine: false,
    };

    mockMessages = [...mockMessages, incoming];
    mockConversations = [
      { ...mockConversations[0], lastMessage: incoming, unreadCount: 0 },
      mockConversations[1],
    ];
    messageEvents$.next(incoming);
    expect(component.messages().some((m) => m._id === 'm-live-2')).toBe(true);
    expect(component.conversations()[0].lastMessage?.content).toBe('Nos vemos a las 2pm en el embarcadero');

    readEvents$.next({ partnerId: 'partner-1' });
    expect(component.messages()[0].readAt).toBeTruthy();
  });

  it('agrega un nuevo chat en tiempo real cuando se acepta otra cita y permite pasar a modo mini', () => {
    const router = TestBed.inject(Router);
    const chatWidget = TestBed.inject(ChatWidgetService);
    let navigatedTo: any = null;
    router.navigate = ((commands: any) => {
      navigatedTo = commands;
      return Promise.resolve(true);
    }) as any;

    mockConversations = [
      ...mockConversations,
      {
        partner: { ...partnerTwo, _id: 'partner-3', name: 'Carlos Valenzuela' },
        chalet: chaletOne,
        lastMessage: null,
        chatEnabled: true,
        unreadCount: 0,
      },
    ];

    bookingEvents$.next({
      type: 'updated',
      booking: {
        _id: 'b-99',
        bookingType: 'cita',
        status: 'confirmada',
        guestName: 'Carlos Valenzuela',
        guestEmail: 'carlos@tropicstay.gt',
        guestPhone: '+502 5555-3003',
        checkIn: '2026-11-14',
        checkOut: '2026-11-14',
        guestsCount: 2,
        nights: 0,
        totalPriceGTQ: 0,
      },
    });

    expect(component.conversations().length).toBe(3);

    component.minimizeToFloatingDock();
    expect(chatWidget.isOnMessagesRoute()).toBe(false);
    expect(chatWidget.isOpen()).toBe(true);
    expect(chatWidget.activePartnerId()).toBe('partner-1');
    expect(navigatedTo).toEqual(['/chalet', 'chalet-1']);
  });

  it('mantiene ocultos los mensajes fijos por defecto y permite colapsar barra lateral y banner del chalet para ampliar el chat', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(component.showQuickReplies()).toBe(false);
    expect(el.querySelector('.quick-replies-strip')).toBeNull();

    component.toggleQuickReplies();
    fixture.detectChanges();
    expect(el.querySelector('.quick-replies-strip')).not.toBeNull();

    component.useQuickMessage('visit');
    fixture.detectChanges();
    expect(component.draft()).toContain('Chalet Mirador Esmeralda');
    expect(component.showQuickReplies()).toBe(false);

    expect(el.querySelector('.conv-chalet-banner')).not.toBeNull();
    component.toggleChaletBanner();
    fixture.detectChanges();
    expect(el.querySelector('.conv-chalet-banner')).toBeNull();

    expect(component.isSidebarCollapsed()).toBe(false);
    component.toggleSidebar();
    fixture.detectChanges();
    expect(el.querySelector('.messages-shell')?.classList.contains('sidebar-collapsed')).toBe(true);
  });
});