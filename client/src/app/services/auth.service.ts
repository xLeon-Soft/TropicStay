import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../environments/environment';

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
  _id?: string;
  name: string;
  email: string;
  picture?: string;
  role?: 'guest' | 'host' | 'admin' | string;
  phone?: string;
  bio?: string;
  responseTime?: string;
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

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: 'guest' | 'host';
}

export interface PasswordRecoveryRequestResult {
  success: boolean;
  message?: string;
  error?: string;
  emailSent?: boolean;
  devPreviewCode?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // OAuth client IDs are public by design. Never put the client secret in Angular.
  private readonly googleClientId = environment.googleClientId;
  private readonly storageKey = 'tropicstay_google_user';
  private readonly apiUrl = `${environment.apiBaseUrl}/auth`;
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthenticatedUser | null>(this.restoreUser());
  readonly isAuthenticated = () => this.user() !== null;

  constructor() {
    if (this.user() && this.getToken()) {
      void this.refreshProfile();
    }
  }

  getToken(): string | null {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed?.token === 'string' && parsed.token ? parsed.token : null;
    } catch {
      return null;
    }
  }

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

  private persistSession(login: LoginResponse): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify({ ...login.user, token: login.token }));
    this.user.set(login.user);
  }

  async signIn(response: GoogleCredentialResponse): Promise<LoginResult> {
    try {
      const login = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/google`, { credential: response.credential })
      );
      if (!login.success || !login.token || !login.user?.email) {
        return { success: false, error: 'Google no devolvió una sesión válida.' };
      }

      this.persistSession(login);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'No se pudo conectar con el servidor de acceso.',
      };
    }
  }

  async signInWithEmail(email: string, password: string): Promise<LoginResult> {
    try {
      const login = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
      );
      if (!login.success || !login.token || !login.user?.email) {
        return { success: false, error: 'No se pudo iniciar sesión.' };
      }
      this.persistSession(login);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'Correo o contraseña incorrectos.',
      };
    }
  }

  async registerWithEmail(payload: RegisterPayload): Promise<LoginResult> {
    try {
      const login = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/register`, payload)
      );
      if (!login.success || !login.token || !login.user?.email) {
        return { success: false, error: 'No se pudo crear tu cuenta.' };
      }
      this.persistSession(login);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'No se pudo completar el registro.',
      };
    }
  }

  async requestPasswordReset(email: string): Promise<PasswordRecoveryRequestResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<{
          success: boolean;
          message: string;
          emailSent?: boolean;
          devPreviewCode?: string;
        }>(`${this.apiUrl}/forgot-password`, { email })
      );
      return {
        success: Boolean(res.success),
        message: res.message,
        emailSent: res.emailSent,
        devPreviewCode: res.devPreviewCode,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'No se pudo enviar el código de recuperación.',
      };
    }
  }

  async verifyResetCode(email: string, code: string): Promise<PasswordResetResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/verify-reset-code`, {
          email,
          code,
        })
      );
      return { success: Boolean(res.success), message: res.message };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'El código ingresado no es válido o expiró.',
      };
    }
  }

  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string
  ): Promise<PasswordResetResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/reset-password`, {
          email,
          code,
          newPassword,
        })
      );
      return { success: Boolean(res.success), message: res.message };
    } catch (error: any) {
      return {
        success: false,
        error: error?.error?.message || 'No se pudo cambiar la contraseña.',
      };
    }
  }

  async createStreamTicket(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; ticket: string }>(`${this.apiUrl}/stream-ticket`, {})
      );
      return res?.success && res?.ticket ? res.ticket : null;
    } catch {
      return null;
    }
  }

  async refreshProfile(): Promise<AuthenticatedUser | null> {
    try {
      const storedRaw = sessionStorage.getItem(this.storageKey);
      if (!storedRaw) return null;
      const stored = JSON.parse(storedRaw);
      if (!stored?.token) return null;

      const res = await firstValueFrom(
        this.http.get<{ success: boolean; user: AuthenticatedUser }>(`${this.apiUrl}/me`)
      );
      if (res.success && res.user) {
        const merged = { ...stored, ...res.user, token: stored.token };
        sessionStorage.setItem(this.storageKey, JSON.stringify(merged));
        this.user.set(res.user);
        return res.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  updateProfile(data: Partial<AuthenticatedUser>): Observable<{ success: boolean; message: string; user: AuthenticatedUser }> {
    return this.http.put<{ success: boolean; message: string; user: AuthenticatedUser }>(`${this.apiUrl}/profile`, data).pipe(
      tap((res) => {
        if (res.success && res.user) {
          try {
            const stored = JSON.parse(sessionStorage.getItem(this.storageKey) || '{}');
            sessionStorage.setItem(this.storageKey, JSON.stringify({ ...stored, ...res.user }));
          } catch {
            // ignore
          }
          this.user.set(res.user);
        }
      })
    );
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
