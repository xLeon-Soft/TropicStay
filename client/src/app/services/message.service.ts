import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Host } from '../models/chalet.model';

export interface ChatChaletSummary {
  _id: string;
  title: string;
  thumbnail: string;
  pricePerNight: number;
  priceUSD?: number;
  municipality: string;
  department: string;
}

export interface ChatMessage {
  _id: string;
  sender: Host;
  recipient: Host;
  chalet?: ChatChaletSummary | null;
  content: string;
  createdAt: string;
  readAt?: string | null;
  isMine: boolean;
}

export interface ChatAppointmentSummary {
  _id: string;
  checkIn: string;
  visitTime?: string;
  status: 'pendiente' | 'confirmada' | 'cancelada';
  chalet?: string | ChatChaletSummary;
}

export interface ChatEligibility {
  chatEnabled: boolean;
  appointmentStatus: 'none' | 'pendiente' | 'confirmada' | 'cancelada';
  appointment?: ChatAppointmentSummary | null;
}

export interface ConversationDetailResponse {
  partner: Host;
  chalet?: ChatChaletSummary | null;
  chatEnabled?: boolean;
  appointmentStatus?: 'none' | 'pendiente' | 'confirmada' | 'cancelada';
  appointment?: ChatAppointmentSummary | null;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  partner: Host;
  lastMessage: ChatMessage | null;
  chalet?: ChatChaletSummary | null;
  appointment?: ChatAppointmentSummary | null;
  chatEnabled?: boolean;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/messages`;

  getUnreadCount(): Observable<number> {
    return this.http.get<{ success: boolean; data: { unreadCount: number } }>(`${this.apiUrl}/unread-count`)
      .pipe(map(response => response.data?.unreadCount || 0));
  }

  getChatEligibility(userId: string, chaletId?: string): Observable<ChatEligibility> {
    let params = new HttpParams();
    if (chaletId) params = params.set('chaletId', chaletId);
    return this.http.get<{ success: boolean; data: ChatEligibility }>(`${this.apiUrl}/eligibility/${userId}`, { params })
      .pipe(map(response => response.data));
  }

  getConversations(): Observable<ConversationSummary[]> {
    return this.http.get<{ success: boolean; data: ConversationSummary[] }>(`${this.apiUrl}/conversations`)
      .pipe(map(response => response.data));
  }

  getConversation(userId: string, chaletId?: string): Observable<ConversationDetailResponse> {
    let params = new HttpParams();
    if (chaletId) params = params.set('chaletId', chaletId);
    return this.http.get<{ success: boolean; data: ConversationDetailResponse }>(`${this.apiUrl}/with/${userId}`, { params })
      .pipe(map(response => response.data));
  }

  sendMessage(recipientId: string, content: string, chaletId?: string): Observable<ChatMessage> {
    return this.http.post<{ success: boolean; data: ChatMessage }>(this.apiUrl, {
      recipientId,
      content,
      chaletId,
    }).pipe(map(response => response.data));
  }
}
