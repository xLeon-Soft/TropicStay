import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, GoogleCredentialResponse } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
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
          this.error.set('No fue posible cargar Google. Revisa tu conexión e inténtalo de nuevo.');
          if (this.waitForGoogle) clearInterval(this.waitForGoogle);
        }
      }, 8000);
    }
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

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/');
  }
}
