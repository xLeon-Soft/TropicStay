import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleButtonConfiguration {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(configuration: GoogleIdConfiguration): void;
          renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

export interface AuthenticatedUser {
  name: string;
  email: string;
  picture?: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: AuthenticatedUser;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // OAuth client IDs are public by design. Never put the client secret in Angular.
  private readonly googleClientId = '383101839481-no6h3sj1fce5ghgqpsvmcl3n4jj48agu.apps.googleusercontent.com';
  private readonly storageKey = 'tropicstay_google_user';
  private readonly apiUrl = 'http://localhost:5000/api/auth/google';
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthenticatedUser | null>(this.restoreUser());
  readonly isAuthenticated = () => this.user() !== null;

  renderGoogleButton(container: HTMLElement, onCredential: (response: GoogleCredentialResponse) => void): boolean {
    if (!window.google?.accounts.id) {
      return false;
    }

    container.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: this.googleClientId,
      callback: onCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
    });
    return true;
  }

  async signIn(response: GoogleCredentialResponse): Promise<LoginResult> {
    try {
      const login = await firstValueFrom(
        this.http.post<LoginResponse>(this.apiUrl, { credential: response.credential })
      );
      if (!login.success || !login.token || !login.user?.email) {
        return { success: false, error: 'Google no devolvió una sesión válida.' };
      }

      sessionStorage.setItem(this.storageKey, JSON.stringify({ ...login.user, token: login.token }));
      this.user.set(login.user);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'No se pudo conectar con el servidor de acceso.',
      };
    }
  }

  logout(): void {
    sessionStorage.removeItem(this.storageKey);
    this.user.set(null);
    window.google?.accounts.id.disableAutoSelect();
  }

  private restoreUser(): AuthenticatedUser | null {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) as AuthenticatedUser : null;
    } catch {
      return null;
    }
  }

}
