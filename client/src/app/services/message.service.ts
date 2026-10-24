import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Host } from '../models/chalet.model';

export interface ChatMessage {
  _id: string;
  sender: Host;
  recipient: Host;
  chalet?: string | null;
  content: string;
  createdAt: string;
  readAt?: string | null;
  isMine: boolean;
}

export interface ConversationSummary {
  partner: Host;
  lastMessage: ChatMessage;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/messages`;

  getConversations(): Observable<ConversationSummary[]> {
    return this.http.get<{ success: boolean; data: ConversationSummary[] }>(`${this.apiUrl}/conversations`)
      .pipe(map(response => response.data));
  }

  getConversation(userId: string): Observable<{ partner: Host; messages: ChatMessage[] }> {
    return this.http.get<{ success: boolean; data: { partner: Host; messages: ChatMessage[] } }>(`${this.apiUrl}/with/${userId}`)
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
