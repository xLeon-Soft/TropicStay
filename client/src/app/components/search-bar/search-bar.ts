import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css'
})
export class SearchBarComponent {
  private router = inject(Router);

  @Output() searchSubmitted = new EventEmitter<any>();

  destination: string = '';
  category: string = 'Todas';
  guests: string = '';

  popularDestinations = [
    { name: 'Lago de Atitlán', dept: 'Sololá' },
    { name: 'Monterrico', dept: 'Santa Rosa' },
    { name: 'Antigua Guatemala', dept: 'Sacatepéquez' },
    { name: 'Río Dulce', dept: 'Izabal' },
    { name: 'Tecpán', dept: 'Chimaltenango' },
    { name: 'Flores / Tikal', dept: 'Petén' },
  ];

  selectDestination(name: string) {
    this.destination = name;
  }

  onSearch() {
    const queryParams: any = {};
    if (this.destination.trim()) queryParams.search = this.destination.trim();
    if (this.category !== 'Todas') queryParams.category = this.category;
    if (this.guests) queryParams.guests = this.guests;

    this.searchSubmitted.emit(queryParams);
    this.router.navigate(['/explore'], { queryParams });
  }
}
