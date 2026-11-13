import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';
import { RealtimeService } from '../../services/realtime.service';
import { Chalet, Host } from '../../models/chalet.model';
import { SearchBarComponent } from '../../components/search-bar/search-bar';
import { ChaletCardComponent } from '../../components/chalet-card/chalet-card';
import { AvatarFallbackDirective, SafeAvatarPipe } from '../../utils/avatar.util';

interface MoodCollection {
  emoji: string;
  icon: string;
  label: string;
  subtitle: string;
  category: string;
  badge: string;
}

interface DestinationCard {
  name: string;
  department: string;
  tagline: string;
  img: string;
}

interface HeroVideo {
  src: string;
  poster: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchBarComponent, ChaletCardComponent, SafeAvatarPipe, AvatarFallbackDirective],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private realtime = inject(RealtimeService);
  chaletService = inject(ChaletService);
  readonly featuredChalets = signal<Chalet[]>([]);
  readonly featuredHosts = signal<Host[]>([]);
  readonly isLoading = signal(true);
  private heroVideoIndex = 0;
  readonly isHeroVideoTransitioning = signal(false);
  readonly activeHeroVideo = signal<HeroVideo>({
    src: 'videos/resort-beach-hd.mp4',
    poster: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1920&q=85'
  });
  private readonly heroVideos: HeroVideo[] = [
    {
      src: 'videos/resort-beach-hd.mp4',
      poster: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1920&q=85'
    },
    {
      src: 'videos/villa-pool-hd.mp4',
      poster: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1920&q=85'
    },
    {
      src: 'videos/luxury-pool-2k.mp4',
      poster: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1920&q=85'
    }
  ];
  featuredPage = 1;
  readonly featuredPageSize = 3;
  destinationPage = 1;
  readonly destinationPageSize = 3;

  private readonly moodCollectionDefinitions: MoodCollection[] = [
    {
      emoji: '🌅',
      icon: 'fa-solid fa-water',
      label: 'Frente al Lago',
      subtitle: 'Piscina infinita y volcanes',
      category: 'Lago',
      badge: 'El más buscado'
    },
    {
      emoji: '🏖️',
      icon: 'fa-solid fa-umbrella-beach',
      label: 'Playa & Pacífico',
      subtitle: 'Piscina privada y ranchos',
      category: 'Playa',
      badge: 'Sol todo el año'
    },
    {
      emoji: '🪵',
      icon: 'fa-solid fa-fire-burner',
      label: 'Cabaña con Chimenea',
      subtitle: 'Bosque frío y jacuzzi nórdico',
      category: 'Montaña',
      badge: 'Escapada romántica'
    },
    {
      emoji: '☕',
      icon: 'fa-solid fa-monument',
      label: 'Fincas Coloniales',
      subtitle: 'Historia y jardines en Antigua',
      category: 'Colonial',
      badge: 'Encanto clásico'
    },
    {
      emoji: '🛶',
      icon: 'fa-solid fa-sailboat',
      label: 'Sobre el Agua',
      subtitle: 'Palafitos y lanchas en Río Dulce',
      category: 'Río',
      badge: 'Aventura única'
    },
    {
      emoji: '🐒',
      icon: 'fa-solid fa-tree',
      label: 'Selva Tropical',
      subtitle: 'Naturaleza, lagunas y aventura',
      category: 'Selva',
      badge: 'Naturaleza pura'
    }
  ];
  readonly moodCollections = signal<MoodCollection[]>([]);

  readonly destinations = signal<DestinationCard[]>([]);

  ngOnInit(): void {
    this.loadChalets();
    this.loadHosts();

    this.realtime.chaletEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.type === 'updated' && event.chalet) {
          this.featuredChalets.update((list) =>
            list.map((c) => (c._id === event.chalet!._id ? { ...c, ...event.chalet! } : c))
          );
        } else if (event.type === 'created' && event.chalet) {
          this.featuredChalets.update((list) =>
            list.some((c) => c._id === event.chalet!._id) ? list : [event.chalet!, ...list]
          );
        } else if (event.type === 'deleted' && event.chaletId) {
          this.featuredChalets.update((list) => list.filter((c) => c._id !== event.chaletId));
        }
      });
  }

  loadChalets(): void {
    this.isLoading.set(true);
    this.chaletService.getChalets().subscribe({
      next: (chalets) => {
        this.featuredChalets.set(chalets);
        this.featuredPage = 1;
        this.setMoodCollections(chalets);
        this.setDestinations(chalets);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando chalets:', err);
        this.isLoading.set(false);
      }
    });
  }

  playMutedHeroVideo(video: HTMLVideoElement): void {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    void video.play().catch(() => undefined);
  }

  playNextHeroVideo(): void {
    if (this.isHeroVideoTransitioning()) return;

    this.isHeroVideoTransitioning.set(true);
    window.setTimeout(() => {
      this.heroVideoIndex = (this.heroVideoIndex + 1) % this.heroVideos.length;
      this.activeHeroVideo.set(this.heroVideos[this.heroVideoIndex]);
      this.isHeroVideoTransitioning.set(false);
    }, 320);
  }

  get featuredPageCount(): number {
    return Math.max(1, Math.ceil(this.featuredChalets().length / this.featuredPageSize));
  }

  get featuredPages(): number[] {
    return Array.from({ length: this.featuredPageCount }, (_value, index) => index + 1);
  }

  get paginatedFeaturedChalets(): Chalet[] {
    const start = (this.featuredPage - 1) * this.featuredPageSize;
    return this.featuredChalets().slice(start, start + this.featuredPageSize);
  }

  goToFeaturedPage(page: number): void {
    this.featuredPage = Math.min(Math.max(page, 1), this.featuredPageCount);
  }

  get destinationPageCount(): number {
    return Math.max(1, Math.ceil(this.destinations().length / this.destinationPageSize));
  }

  get destinationPages(): number[] {
    return Array.from({ length: this.destinationPageCount }, (_value, index) => index + 1);
  }

  get paginatedDestinations(): DestinationCard[] {
    const start = (this.destinationPage - 1) * this.destinationPageSize;
    return this.destinations().slice(start, start + this.destinationPageSize);
  }

  goToDestinationPage(page: number): void {
    this.destinationPage = Math.min(Math.max(page, 1), this.destinationPageCount);
  }

  private setMoodCollections(chalets: Chalet[]): void {
    const availableCategories = new Set<string>(chalets.map((chalet) => chalet.category));
    this.moodCollections.set(this.moodCollectionDefinitions
      .filter((collection) => availableCategories.has(collection.category)));
  }

  private setDestinations(chalets: Chalet[]): void {
    const chaletsByMunicipality = new Map<string, Chalet[]>();
    for (const chalet of chalets) {
      const matches = chaletsByMunicipality.get(chalet.municipality) || [];
      matches.push(chalet);
      chaletsByMunicipality.set(chalet.municipality, matches);
    }

    this.destinations.set(Array.from(chaletsByMunicipality.entries())
      .map(([name, municipalityChalets]) => {
        const highlighted = [...municipalityChalets].sort((first, second) => second.rating - first.rating)[0];
        return {
          name,
          department: highlighted.department,
          tagline: highlighted.location?.[0] || `${highlighted.category} en ${highlighted.department}`,
          img: highlighted.thumbnail || highlighted.images[0],
        };
      })
      .sort((first, second) => first.name.localeCompare(second.name, 'es')));
    this.destinationPage = 1;
  }

  loadHosts(): void {
    this.chaletService.getHosts().subscribe({
      next: (hosts) => {
        this.featuredHosts.set(hosts.slice(0, 3));
      },
      error: (err) => {
        console.error('Error cargando anfitriones:', err);
      }
    });
  }

  filterByMood(mood: MoodCollection): void {
    this.router.navigate(['/explore'], { queryParams: { category: mood.category } });
  }
}
