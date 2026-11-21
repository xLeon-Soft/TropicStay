import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { LoginComponent } from './login';
import { AuthService, RegisterPayload } from '../../services/auth.service';

describe('LoginComponent (Ver contraseña, Medidor de Seguridad y Rol Cliente)', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let registeredPayload: RegisterPayload | null = null;

  const authServiceMock = {
    user: signal(null),
    isAuthenticated: () => false,
    renderGoogleButton: () => false,
    signIn: async () => ({ success: true }),
    signInWithEmail: async () => ({ success: true }),
    registerWithEmail: async (payload: RegisterPayload) => {
      registeredPayload = payload;
      return { success: true };
    },
    requestPasswordReset: async (email: string) => ({
      success: true,
      emailSent: false,
      devPreviewCode: '654321',
      message: `Código generado para ${email}`,
    }),
    verifyResetCode: async (_email: string, code: string) => {
      if (code !== '654321') {
        return { success: false, error: 'Código incorrecto' };
      }
      return { success: true, message: 'Código verificado.' };
    },
    resetPasswordWithCode: async (_email: string, code: string, _newPassword: string) => {
      if (code !== '654321') {
        return { success: false, error: 'Código incorrecto' };
      }
      return {
        success: true,
        message: '¡Contraseña actualizada correctamente! Ya puedes iniciar sesión.',
      };
    },
    updateProfile: () => of({ success: true, message: 'ok', user: {} }),
  };

  beforeEach(async () => {
    registeredPayload = null;
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('permite mostrar y ocultar la contraseña con el botón de ojo', () => {
    const input = fixture.nativeElement.querySelector('#authPassword') as HTMLInputElement;
    const toggleBtn = fixture.nativeElement.querySelector('.btn-toggle-password') as HTMLButtonElement;

    expect(input.type).toBe('password');
    toggleBtn.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');

    toggleBtn.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
  });

  it('evalúa en tiempo real la seguridad de la contraseña al crear cuenta', () => {
    component.authTab.set('register');
    fixture.detectChanges();

    component.onPasswordInput('123');
    fixture.detectChanges();
    expect(component.passwordStrength().label).toBe('Muy débil');

    component.onPasswordInput('TropicStay2026!');
    fixture.detectChanges();
    expect(component.passwordStrength().label).toBe('Muy segura');
    expect(component.passwordStrength().percent).toBe(100);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Muy segura');
  });

  it('oculta el selector de rol en el registro y registra por defecto como cliente (guest)', async () => {
    component.authTab.set('register');
    fixture.detectChanges();

    const roleSelect = fixture.nativeElement.querySelector('#authRole');
    expect(roleSelect).toBeNull();

    component.name = 'German De León';
    component.email = 'german@tropicstay.test';
    component.phone = '+502 5544-1122';
    component.onPasswordInput('TropicStay2026!');

    await component.onEmailSubmit();
    expect(registeredPayload?.role).toBe('guest');
  });

  it('permite solicitar un código por correo, validar nueva contraseña y recuperar la cuenta', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const forgotBtn = el.querySelector('.btn-forgot-password') as HTMLButtonElement;
    expect(forgotBtn).toBeTruthy();

    forgotBtn.click();
    fixture.detectChanges();
    expect(component.authTab()).toBe('recover');
    expect(component.recoverStep()).toBe('request');

    component.email = 'alexander@tropicstay.gt';
    await component.onRequestRecoveryCode();
    fixture.detectChanges();

    expect(component.recoverStep()).toBe('code');
    expect(component.recoverStepNumber()).toBe(2);
    expect(component.devPreviewCode()).toBe('654321');
    expect(el.textContent).toContain('654321');

    component.resetCode = '654321';
    await component.onVerifyRecoveryCode();
    fixture.detectChanges();
    expect(component.recoverStep()).toBe('password');
    expect(component.recoverStepNumber()).toBe(3);

    component.onNewPasswordInput('NuevaClave#2026');
    component.onConfirmPasswordInput('Otra');
    fixture.detectChanges();
    expect(component.passwordStrength().label).toBe('Muy segura');
    expect(component.confirmPasswordStrength().label).toBe('Muy débil');
    expect(component.passwordsMatch()).toBe(false);
    expect(el.querySelector('.password-match-pill.is-mismatch')).not.toBeNull();

    const confirmInput = el.querySelector('#confirmPassword') as HTMLInputElement;
    const confirmToggle = el.querySelector('.btn-toggle-confirm-password') as HTMLButtonElement;
    expect(confirmToggle).toBeTruthy();
    expect(confirmInput.type).toBe('password');
    confirmToggle.click();
    fixture.detectChanges();
    expect(confirmInput.type).toBe('text');

    component.onConfirmPasswordInput('NuevaClave#2026');
    fixture.detectChanges();
    expect(component.confirmPasswordStrength().label).toBe('Muy segura');
    expect(component.passwordsMatch()).toBe(true);
    expect(el.querySelector('.password-match-pill.is-match')).not.toBeNull();

    await component.onResetPasswordSubmit();
    fixture.detectChanges();

    expect(component.authTab()).toBe('login');
    expect(component.successMessage()).toContain('Contraseña actualizada');
    expect(el.querySelector('.login-success')).not.toBeNull();
  });
});

