import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';
import { Chalet } from '../../models/chalet.model';
import { SearchBarComponent } from '../../components/search-bar/search-bar';
import { ChaletCardComponent } from '../../components/chalet-card/chalet-card';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchBarComponent, ChaletCardComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  chaletService = inject(ChaletService);
  featuredChalets: Chalet[] = [];
  isLoading = true;

  moodCollections = [
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
      emoji: '🐾',
      icon: 'fa-solid fa-paw',
      label: 'Pet Friendly',
      subtitle: 'Espacio para toda tu familia',
      amenity: 'Pet Friendly',
      badge: 'Mascotas felices'
    }
  ];

  destinations = [
    {
      name: 'Lago de Atitlán',
      department: 'Sololá',
      tagline: 'Volcanes majestuosos y aguas místicas',
      img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600&q=80',
      count: '3 Chalets de ensueño',
    },
    {
      name: 'Monterrico & El Paredón',
      department: 'Santa Rosa',
      tagline: 'Playas volcánicas y atardeceres dorados',
      img: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=80',
      count: '2 Chalets de playa',
    },
    {
      name: 'Antigua Guatemala',
      department: 'Sacatepéquez',
      tagline: 'Patios coloniales y vistas al volcán',
      img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80',
      count: '2 Chalets coloniales',
    },
    {
      name: 'Tecpán & Montañas',
      department: 'Chimaltenango',
      tagline: 'Cabañas de pino, leña y niebla',
      img: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&q=80',
      count: '1 Cabaña alpina',
    },
    {
      name: 'Río Dulce',
      department: 'Izabal',
      tagline: 'Palafitos sobre el agua y manglares',
      img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80',
      count: '1 Chalet sobre el río',
    },
    {
      name: 'Flores & Petén',
      department: 'Petén',
      tagline: 'Selva tropical maya y Lago Petén Itzá',
      img: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&q=80',
      count: '1 Eco-chalet selvático',
    }
  ];

  ngOnInit(): void {
    this.loadChalets();
  }

  loadChalets(): void {
    this.isLoading = true;
    this.chaletService.getChalets().subscribe({
      next: (chalets) => {
        this.featuredChalets = chalets;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando chalets:', err);
        this.isLoading = false;
      }
    });
  }

  filterByMood(mood: any): void {
    const queryParams: any = {};
    if (mood.category) queryParams.category = mood.category;
    if (mood.amenity) queryParams.amenities = mood.amenity;
    this.router.navigate(['/explore'], { queryParams });
  }
}
