import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent),
  },
  {
    path: 'explore',
    loadComponent: () => import('./pages/explore/explore').then(m => m.ExploreComponent),
  },
  {
    path: 'chalet/:id',
    loadComponent: () => import('./pages/chalet-detail/chalet-detail').then(m => m.ChaletDetailComponent),
  },
  {
    path: 'publish',
    loadComponent: () => import('./pages/publish-chalet/publish-chalet').then(m => m.PublishChaletComponent),
  },
  {
    path: 'host/:id',
    loadComponent: () => import('./pages/host-profile/host-profile').then(m => m.HostProfileComponent),
  },
  {
    path: '**',
    redirectTo: '',
  }
];
