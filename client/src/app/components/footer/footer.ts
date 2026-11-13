import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  activePolicy: 'privacy' | 'terms' | 'cancellation' | null = null;

  openPolicy(policy: 'privacy' | 'terms' | 'cancellation'): void {
    this.activePolicy = policy;
  }

  closePolicy(): void {
    this.activePolicy = null;
  }
}

