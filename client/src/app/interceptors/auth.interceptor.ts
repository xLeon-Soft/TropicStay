import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const sessionKey = 'tropicstay_google_user';

/** Adds the current Google/JWT session to calls to the TropicStay API and handles 401 session expiration. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || request.url === '/api/auth/google') {
    return next(request);
  }

  let outgoing = request;
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) || '{}');
    if (typeof session.token === 'string' && session.token) {
      outgoing = request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } });
    }
  } catch {
    // A malformed saved session is handled by AuthService on the next reload.
  }

  const router = inject(Router);
  const auth = inject(AuthService);

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.isAuthenticated()) {
        auth.logout();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    })
  );
};
