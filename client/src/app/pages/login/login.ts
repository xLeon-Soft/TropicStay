import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, GoogleCredentialResponse } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('googleButton', { static: true }) googleButton!: ElementRef<HTMLElement>;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private waitForGoogle?: ReturnType<typeof setInterval>;

  readonly loading = signal(true);
  readonly signingIn = signal(false);
  readonly error = signal('');
  readonly authTab = signal<'login' | 'register'>('login');
  readonly showPassword = signal(false);
  readonly passwordSignal = signal('');

  // Email / Password Form Model
  name = '';
  email = '';
  password = '';
  phone = '+502 ';

  readonly passwordChecks = computed(() => {
    const pwd = this.passwordSignal();
    return {
      minLength: pwd.length >= 6,
      goodLength: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    };
  });

  readonly passwordStrength = computed(() => {
    const pwd = this.passwordSignal();
    if (!pwd) {
      return { score: 0, percent: 0, label: 'Ingresa una contraseña', tone: 'empty' };
    }
    const c = this.passwordChecks();
    let score = 0;
    if (c.minLength) score += 1;
    if (c.goodLength) score += 1;
    if (c.uppercase && c.lowercase) score += 1;
    if (c.number) score += 1;
    if (c.special) score += 1;

    if (!c.minLength || score <= 1) {
      return { score, percent: 22, label: 'Muy débil', tone: 'very-weak' };
    }
    if (score === 2) {
      return { score, percent: 42, label: 'Débil', tone: 'weak' };
    }
    if (score === 3) {
      return { score, percent: 65, label: 'Aceptable', tone: 'fair' };
    }
    if (score === 4) {
      return { score, percent: 84, label: 'Fuerte', tone: 'strong' };
    }
    return { score, percent: 100, label: 'Muy segura', tone: 'excellent' };
  });

  onPasswordInput(value: string): void {
    this.password = value;
    this.passwordSignal.set(value || '');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  ngAfterViewInit(): void {
    this.renderButtonWhenReady();
  }

  ngOnDestroy(): void {
    if (this.waitForGoogle) clearInterval(this.waitForGoogle);
  }

  private renderButtonWhenReady(): void {
    const render = () => {
      const rendered = this.auth.renderGoogleButton(this.googleButton.nativeElement, response => this.onGoogleSignIn(response));
      if (rendered) {
        this.loading.set(false);
        if (this.waitForGoogle) clearInterval(this.waitForGoogle);
      }
    };

    render();
    if (this.loading()) {
      this.waitForGoogle = setInterval(render, 150);
      window.setTimeout(() => {
        if (this.loading()) {
          this.loading.set(false);
          if (this.waitForGoogle) clearInterval(this.waitForGoogle);
        }
      }, 6000);
    }
  }

  private navigateAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/');
  }

  private async onGoogleSignIn(response: GoogleCredentialResponse): Promise<void> {
    this.signingIn.set(true);
    this.error.set('');
    const result = await this.auth.signIn(response);
    if (!result.success) {
      this.signingIn.set(false);
      this.error.set(result.error || 'No pudimos validar la cuenta de Google. Inténtalo otra vez.');
      return;
    }

    this.navigateAfterLogin();
  }

  async onEmailSubmit(): Promise<void> {
    this.error.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    this.signingIn.set(true);
    if (this.authTab() === 'login') {
      const result = await this.auth.signInWithEmail(this.email.trim(), this.password);
      if (!result.success) {
        this.signingIn.set(false);
        this.error.set(result.error || 'Correo o contraseña incorrectos.');
        return;
      }
      this.navigateAfterLogin();
      return;
    }

    if (!this.name.trim() || this.name.trim().length < 2) {
      this.signingIn.set(false);
      this.error.set('Ingresa tu nombre completo.');
      return;
    }
    if (this.password.length < 6) {
      this.signingIn.set(false);
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const result = await this.auth.registerWithEmail({
      name: this.name.trim(),
      email: this.email.trim(),
      password: this.password,
      phone: this.phone.trim(),
      role: 'guest',
    });

    if (!result.success) {
      this.signingIn.set(false);
      this.error.set(result.error || 'No se pudo crear tu cuenta.');
      return;
    }
    this.navigateAfterLogin();
  }
}
