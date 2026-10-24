import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChaletService } from '../../services/chalet.service';

interface LocalImage {
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'app-publish-chalet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publish-chalet.html',
  styleUrl: './publish-chalet.css'
})
export class PublishChaletComponent {
  private router = inject(Router);
  chaletService = inject(ChaletService);

  // Form Model
  title = '';
  category = 'Lago';
  department = 'Sololá';
  municipality = 'San Marcos La Laguna';
  locationsText = 'Lago de Atitlán, Sololá';
  description = '';
  pricePerNight: number = 2200;
  deposit: number = 500;
  cleaningFee: number = 150;
  guestsMax: number = 6;
  bedrooms: number = 3;
  beds: number = 4;
  bathrooms: number = 2;
  mainImageUrl = 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80';
  additionalImages = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80\nhttps://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80';

  // Host Info
  hostName = 'Propietario Anfitrión';
  hostPhone = '+502 5555-4321';
  hostBio = 'Dedicado a brindar la mejor experiencia en chalets guatemaltecos.';

  // Amenities available
  allAmenities = [
    'Piscina privada',
    'Piscina infinita',
    'Jacuzzi climatizado',
    'Vista panorámica al lago',
    'Frente al mar',
    'Muelle privado',
    'Kayaks y Paddleboards',
    'Chimenea de leña',
    'Wifi de alta velocidad',
    'Wifi Starlink',
    'Cocina equipada',
    'Sauna temazcal',
    'Parrilla BBQ',
    'Pet Friendly',
    'Aire acondicionado',
    'Seguridad 24h',
    'Parqueo privado'
  ];
  selectedAmenities: string[] = ['Piscina privada', 'Wifi de alta velocidad', 'Parrilla BBQ'];

  newRule = '';
  rulesList: string[] = ['No fumar en habitaciones', 'Música moderada después de las 22:00'];

  isSubmitting = false;
  publishSuccess = false;
  createdChaletId = '';
  publishError = '';
  imageError = '';
  selectedLocalImages: LocalImage[] = [];

  departmentsList = [
    'Sololá',
    'Santa Rosa',
    'Sacatepéquez',
    'Izabal',
    'Chimaltenango',
    'Petén',
    'Escuintla',
    'Alta Verapaz',
    'Guatemala',
    'Retalhuleu',
    'Quetzaltenango'
  ];

  toggleAmenity(amenity: string): void {
    if (this.selectedAmenities.includes(amenity)) {
      this.selectedAmenities = this.selectedAmenities.filter(a => a !== amenity);
    } else {
      this.selectedAmenities.push(amenity);
    }
  }

  addRule(): void {
    if (this.newRule.trim()) {
      this.rulesList.push(this.newRule.trim());
      this.newRule = '';
    }
  }

  removeRule(index: number): void {
    this.rulesList.splice(index, 1);
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.imageError = '';

    if (this.selectedLocalImages.length + files.length > 10) {
      this.imageError = 'Puedes seleccionar un máximo de 10 imágenes.';
      input.value = '';
      return;
    }

    const invalidFile = files.find(file => !/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024);
    if (invalidFile) {
      this.imageError = 'Usa imágenes JPG, PNG, WEBP o GIF de hasta 8 MB cada una.';
      input.value = '';
      return;
    }

    this.selectedLocalImages.push(...files.map(file => ({ file, previewUrl: URL.createObjectURL(file) })));
    input.value = '';
  }

  removeLocalImage(index: number): void {
    const [removed] = this.selectedLocalImages.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
  }

  private clearLocalImages(): void {
    this.selectedLocalImages.forEach(image => URL.revokeObjectURL(image.previewUrl));
    this.selectedLocalImages = [];
  }

  onSubmit(): void {
    this.publishError = '';
    if (!this.mainImageUrl.trim() && this.selectedLocalImages.length === 0) {
      this.publishError = 'Agrega una URL de imagen o selecciona al menos una fotografía desde tu computadora.';
      return;
    }
    if (!this.title.trim() || !this.description.trim() || !this.pricePerNight) {
      alert('Por favor completa el título, descripción y precio por noche del chalet.');
      return;
    }

    if (this.selectedLocalImages.length > 0) {
      this.isSubmitting = true;
      this.chaletService.uploadImages(this.selectedLocalImages.map(image => image.file)).subscribe({
        next: ({ urls }) => {
          const existingUrls = [this.mainImageUrl.trim(), ...this.additionalImages.split('\n').map(url => url.trim())].filter(Boolean);
          this.mainImageUrl = urls[0];
          this.additionalImages = [...urls.slice(1), ...existingUrls].join('\n');
          this.clearLocalImages();
          this.isSubmitting = false;
          this.onSubmit();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.publishError = err?.error?.message || 'No pudimos subir las imágenes. Inténtalo nuevamente.';
        }
      });
      return;
    }

    const imgs = [this.mainImageUrl.trim()];
    if (this.additionalImages.trim()) {
      const extra = this.additionalImages.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      imgs.push(...extra);
    }

    this.isSubmitting = true;

    const payload = {
      title: this.title.trim(),
      category: this.category,
      department: this.department,
      municipality: this.municipality.trim(),
      location: this.locationsText.split('\n').map(location => location.trim()).filter(Boolean).length
        ? this.locationsText.split('\n').map(location => location.trim()).filter(Boolean)
        : [`${this.municipality}, ${this.department}`],
      description: this.description.trim(),
      pricePerNight: Number(this.pricePerNight),
      deposit: Number(this.deposit),
      cleaningFee: Number(this.cleaningFee),
      guestsMax: Number(this.guestsMax),
      bedrooms: Number(this.bedrooms),
      beds: Number(this.beds),
      bathrooms: Number(this.bathrooms),
      images: imgs,
      thumbnail: imgs[0],
      amenities: this.selectedAmenities,
      rules: this.rulesList,
      rating: 5.0,
      reviewsCount: 1,
      ratingBreakdown: { cleanliness: 5.0, accuracy: 5.0, communication: 5.0, location: 5.0, value: 5.0 },
      featured: true,
      status: 'disponible',
    };

    this.chaletService.createChalet(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.publishSuccess = true;
        this.createdChaletId = res.data._id;
      },
      error: (err) => {
        console.error('Error publicando chalet:', err);
        this.isSubmitting = false;
        alert('Ocurrió un error al guardar el chalet en MongoDB.');
      }
    });
  }

  viewPublishedChalet(): void {
    if (this.createdChaletId) {
      this.router.navigate(['/chalet', this.createdChaletId]);
    } else {
      this.router.navigate(['/explore']);
    }
  }

  resetForm(): void {
    this.title = '';
    this.category = 'Lago';
    this.department = 'Sololá';
    this.municipality = 'San Marcos La Laguna';
    this.locationsText = 'Lago de Atitlán, Sololá';
    this.description = '';
    this.pricePerNight = 2200;
    this.deposit = 500;
    this.cleaningFee = 150;
    this.guestsMax = 6;
    this.bedrooms = 3;
    this.beds = 4;
    this.bathrooms = 2;
    this.selectedAmenities = ['Piscina privada', 'Wifi de alta velocidad', 'Parrilla BBQ'];
    this.rulesList = ['No fumar en habitaciones', 'Música moderada después de las 22:00'];
    this.publishSuccess = false;
    this.createdChaletId = '';
    this.publishError = '';
    this.imageError = '';
    this.clearLocalImages();
  }
}
