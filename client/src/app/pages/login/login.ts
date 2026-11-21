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
  readonly successMessage = signal('');
  readonly authTab = signal<'login' | 'register' | 'recover'>('login');
  readonly recoverStep = signal<'request' | 'code' | 'password'>('request');
  readonly recoverStepNumber = computed(() => {
    const step = this.recoverStep();
    return step === 'request' ? 1 : step === 'code' ? 2 : 3;
  });
  readonly recoveryInfo = signal('');
  readonly devPreviewCode = signal('');
  readonly resendCooldown = signal(0);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly passwordSignal = signal('');
  readonly confirmPasswordSignal = signal('');
  private cooldownTimer?: ReturnType<typeof setInterval>;

  // Email / Password Form Model
  name = '';
  email = '';
  password = '';
  phone = '+502 ';
  resetCode = '';
  newPassword = '';
  confirmPassword = '';

  private evaluatePasswordChecks(pwd: string) {
    return {
      minLength: pwd.length >= 6,
      goodLength: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    };
  }

  private evaluatePasswordStrength(pwd: string) {
    if (!pwd) {
      return { score: 0, percent: 0, label: 'Ingresa una contraseña', tone: 'empty' };
    }
    const c = this.evaluatePasswordChecks(pwd);
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
  }

  readonly passwordChecks = computed(() => this.evaluatePasswordChecks(this.passwordSignal()));
  readonly passwordStrength = computed(() => this.evaluatePasswordStrength(this.passwordSignal()));
  readonly confirmPasswordChecks = computed(() => this.evaluatePasswordChecks(this.confirmPasswordSignal()));
  readonly confirmPasswordStrength = computed(() => this.evaluatePasswordStrength(this.confirmPasswordSignal()));
  readonly passwordsMatch = computed(
    () => Boolean(this.passwordSignal()) && this.passwordSignal() === this.confirmPasswordSignal()
  );

  onPasswordInput(value: string): void {
    this.password = value;
    this.passwordSignal.set(value || '');
  }

  onNewPasswordInput(value: string): void {
    this.newPassword = value;
    this.passwordSignal.set(value || '');
  }

  onConfirmPasswordInput(value: string): void {
    this.confirmPassword = value;
    this.confirmPasswordSignal.set(value || '');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  switchAuthTab(tab: 'login' | 'register' | 'recover'): void {
    this.authTab.set(tab);
    this.error.set('');
    this.successMessage.set('');
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    if (tab === 'recover') {
      this.recoverStep.set('request');
      this.recoveryInfo.set('');
      this.devPreviewCode.set('');
      this.resetCode = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordSignal.set('');
      this.confirmPasswordSignal.set('');
    } else if (tab === 'register') {
      this.passwordSignal.set(this.password || '');
      this.confirmPasswordSignal.set('');
    } else {
      this.passwordSignal.set('');
      this.confirmPasswordSignal.set('');
    }
  }

  goToRecoveryStep(step: 'request' | 'code'): void {
    const current = this.recoverStepNumber();
    const target = step === 'request' ? 1 : 2;
    if (target < current) {
      this.error.set('');
      this.recoverStep.set(step);
    }
  }

  private startResendCooldown(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.resendCooldown.set(30);
    this.cooldownTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        if (this.cooldownTimer) clearInterval(this.cooldownTimer);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.renderButtonWhenReady();
  }

  ngOnDestroy(): void {
    if (this.waitForGoogle) clearInterval(this.waitForGoogle);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
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

  async onRequestRecoveryCode(): Promise<void> {
    this.error.set('');
    this.successMessage.set('');
    const targetEmail = this.email.trim();
    if (!targetEmail) {
      this.error.set('Ingresa el correo electrónico de tu cuenta para enviarte el código.');
      return;
    }

    this.signingIn.set(true);
    const result = await this.auth.requestPasswordReset(targetEmail);
    this.signingIn.set(false);

    if (!result.success) {
      this.error.set(result.error || 'No pudimos enviar el código de recuperación.');
      return;
    }

    this.recoverStep.set('code');
    this.recoveryInfo.set(
      result.message || `Enviamos un código de 6 dígitos a ${targetEmail}.`
    );
    this.devPreviewCode.set(result.devPreviewCode || '');
    this.startResendCooldown();
  }

  async onVerifyRecoveryCode(): Promise<void> {
    this.error.set('');
    this.successMessage.set('');

    const targetEmail = this.email.trim();
    const cleanCode = this.resetCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      this.error.set('Ingresa el código numérico de 6 dígitos enviado a tu correo.');
      return;
    }

    this.signingIn.set(true);
    const result = await this.auth.verifyResetCode(targetEmail, cleanCode);
    this.signingIn.set(false);

    if (!result.success) {
      this.error.set(result.error || 'El código ingresado no es válido o expiró.');
      return;
    }

    this.recoverStep.set('password');
    this.passwordSignal.set(this.newPassword || '');
    this.confirmPasswordSignal.set(this.confirmPassword || '');
  }

  async onResetPasswordSubmit(): Promise<void> {
    this.error.set('');
    this.successMessage.set('');

    const targetEmail = this.email.trim();
    const cleanCode = this.resetCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      this.error.set('Ingresa el código numérico de 6 dígitos enviado a tu correo.');
      return;
    }
    if (this.newPassword.length < 6) {
      this.error.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Las contraseñas nuevas no coinciden.');
      return;
    }

    this.signingIn.set(true);
    const result = await this.auth.resetPasswordWithCode(
      targetEmail,
      cleanCode,
      this.newPassword
    );
    this.signingIn.set(false);

    if (!result.success) {
      this.error.set(result.error || 'El código no es válido o ya expiró.');
      return;
    }

    this.password = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.resetCode = '';
    this.devPreviewCode.set('');
    this.passwordSignal.set('');
    this.confirmPasswordSignal.set('');
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.authTab.set('login');
    this.recoverStep.set('request');
    this.successMessage.set(
      result.message || '¡Contraseña actualizada! Ya puedes iniciar sesión con tu nueva contraseña.'
    );
  }
}
