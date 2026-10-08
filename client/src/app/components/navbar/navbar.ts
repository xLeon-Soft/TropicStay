import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  chaletService = inject(ChaletService);
  auth = inject(AuthService);
  private router = inject(Router);
  isMenuOpen = false;

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleCurrency() {
    const next = this.chaletService.currency() === 'GTQ' ? 'USD' : 'GTQ';
    this.chaletService.setCurrency(next);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
