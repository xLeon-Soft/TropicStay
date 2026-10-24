import { Routes } from '@angular/router';
import { authGuard, loginRedirectGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginRedirectGuard],
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent),
  },
  {
    path: 'explore',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/explore/explore').then(m => m.ExploreComponent),
  },
  {
    path: 'chalet/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/chalet-detail/chalet-detail').then(m => m.ChaletDetailComponent),
  },
  {
    path: 'publish',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/publish-chalet/publish-chalet').then(m => m.PublishChaletComponent),
  },
  {
    path: 'host/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/host-profile/host-profile').then(m => m.HostProfileComponent),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/messages/messages').then(m => m.MessagesComponent),
  },
  {
    path: '**',
    redirectTo: '',
  }
];
