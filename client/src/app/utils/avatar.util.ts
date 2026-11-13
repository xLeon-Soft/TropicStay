import { Directive, ElementRef, HostBinding, HostListener, Pipe, PipeTransform, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export function isGoogleAvatarUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^(https?:\/\/)?([^/]*\.)?(googleusercontent\.com|ggpht\.com)\//i.test(url.trim());
}

export function getInitials(name?: string | null): string {
  const parts = String(name || 'TS')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'TS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function buildInitialsAvatarDataUri(name?: string | null): string {
  const initials = getInitials(name).replace(/[^A-Z0-9]/gi, '') || 'TS';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0d5244"/><stop offset="100%" stop-color="#19826c"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="34" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveAvatarUrl(
  avatarUrl?: string | null,
  userId?: string | null,
  name?: string | null
): string {
  const cleanUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const cleanId = typeof userId === 'string' ? userId.trim() : '';

  if (cleanId && (!cleanUrl || isGoogleAvatarUrl(cleanUrl))) {
    return `${environment.apiBaseUrl}/auth/avatar/${encodeURIComponent(cleanId)}`;
  }

  if (cleanUrl) {
    return cleanUrl;
  }

  return buildInitialsAvatarDataUri(name);
}

@Pipe({
  name: 'safeAvatar',
  standalone: true,
})
export class SafeAvatarPipe implements PipeTransform {
  transform(avatarUrl?: string | null, userId?: string | null, name?: string | null): string {
    return resolveAvatarUrl(avatarUrl, userId, name);
  }
}

@Directive({
  selector: 'img[appAvatarFallback]',
  standalone: true,
})
export class AvatarFallbackDirective {
  private readonly imgRef = inject(ElementRef<HTMLImageElement>);

  @HostBinding('attr.referrerpolicy')
  readonly referrerPolicy = 'no-referrer';

  @HostListener('error')
  onError(): void {
    const img = this.imgRef.nativeElement;
    if (img.src.startsWith('data:image/svg+xml')) return;
    img.src = buildInitialsAvatarDataUri(img.alt);
  }
}
