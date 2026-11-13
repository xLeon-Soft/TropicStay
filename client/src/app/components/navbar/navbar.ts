import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';
import { AuthService } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  chaletService = inject(ChaletService);
  auth = inject(AuthService);
  realtime = inject(RealtimeService);
  private router = inject(Router);
  private elementRef = inject(ElementRef<HTMLElement>);

  isMenuOpen = false;
  isUserMenuOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isUserMenuOpen) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.isUserMenuOpen = false;
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeMenus(): void {
    this.isMenuOpen = false;
    this.isUserMenuOpen = false;
  }

  toggleCurrency() {
    const next = this.chaletService.currency() === 'GTQ' ? 'USD' : 'GTQ';
    this.chaletService.setCurrency(next);
  }

  async goToProfile(): Promise<void> {
    this.closeMenus();
    let userId = this.auth.user()?._id;
    if (!userId && this.auth.getToken()) {
      const refreshed = await this.auth.refreshProfile();
      userId = refreshed?._id;
    }

    if (userId) {
      void this.router.navigate(['/host', userId]);
      return;
    }
    void this.router.navigate(['/login']);
  }

  logout(): void {
    this.closeMenus();
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
