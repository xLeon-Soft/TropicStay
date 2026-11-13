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
});

