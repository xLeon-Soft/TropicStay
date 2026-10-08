import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar';
import { FooterComponent } from './components/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'TropicStay';
  private readonly router = inject(Router);
  readonly isLoginRoute = signal(this.router.url.startsWith('/login'));

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event) => {
      this.isLoginRoute.set((event as NavigationEnd).urlAfterRedirects.startsWith('/login'));
    });
  }
}
