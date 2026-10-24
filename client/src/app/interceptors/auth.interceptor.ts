import { HttpInterceptorFn } from '@angular/common/http';

const sessionKey = 'tropicstay_google_user';

/** Adds the current Google/JWT session to calls to the TropicStay API. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || request.url === '/api/auth/google') {
    return next(request);
  }

  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) || '{}');
    if (typeof session.token === 'string' && session.token) {
      return next(request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } }));
    }
  } catch {
    // A malformed saved session is handled by AuthService on the next reload.
  }

  return next(request);
};
