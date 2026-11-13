import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar';
import { FooterComponent } from './components/footer/footer';
import { ChatDockComponent } from './components/chat-dock/chat-dock';
import { UiDialogHostComponent } from './components/ui-dialog-host/ui-dialog-host';
import { ChatWidgetService } from './services/chat-widget.service';
import { RealtimeNotification, RealtimeService } from './services/realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent, ChatDockComponent, UiDialogHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'TropicStay';
  private readonly router = inject(Router);
  private readonly chatWidget = inject(ChatWidgetService);
  readonly realtime = inject(RealtimeService);
  readonly isLoginRoute = signal(this.router.url.startsWith('/login'));

  constructor() {
    this.chatWidget.isOnMessagesRoute.set(this.router.url.startsWith('/messages'));
    this.router.events.pipe(filter(event => event instanceof NavigationStart || event instanceof NavigationEnd)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        if (event.url.startsWith('/messages')) {
          this.chatWidget.enterMessagesPage();
        }
        return;
      }
      const url = event.urlAfterRedirects;
      this.isLoginRoute.set(url.startsWith('/login'));
      if (url.startsWith('/messages')) {
        this.chatWidget.isOnMessagesRoute.set(true);
        this.chatWidget.isOpen.set(false);
      } else {
        this.chatWidget.leaveMessagesPage();
      }
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    });
  }

  openNotification(note: RealtimeNotification): void {
    this.realtime.dismissNotification(note.id);
    void this.router.navigate(note.route, { queryParams: note.queryParams });
  }
}
