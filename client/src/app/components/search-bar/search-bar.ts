import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChaletService, DestinationOption } from '../../services/chalet.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css'
})
export class SearchBarComponent implements OnInit {
  private router = inject(Router);
  private chaletService = inject(ChaletService);

  @Output() searchSubmitted = new EventEmitter<any>();

  destination: string = '';
  category: string = 'Todas';
  guests: string = '';
  readonly destinations = signal<DestinationOption[]>([]);

  ngOnInit(): void {
    this.chaletService.getDestinations().subscribe({
      next: (destinations) => this.destinations.set(destinations),
      error: (error) => console.error('Error cargando destinos:', error),
    });
  }

  get selectedDestination(): DestinationOption | undefined {
    return this.destinations().find((destination) => destination.name === this.destination);
  }

  onDestinationChange(): void {
    const selectedDestination = this.selectedDestination;
    this.category = selectedDestination?.categories.length === 1
      ? selectedDestination.categories[0]
      : 'Todas';
  }

  onCategoryChange(): void {
    if (this.category === 'Todas') {
      this.destination = '';
      return;
    }

    this.destination = this.destinations()
      .find((destination) => destination.categories.includes(this.category))?.name || '';
  }

  isCategoryLocked(): boolean {
    return this.selectedDestination?.categories.length === 1;
  }

  selectDestination(destination: DestinationOption): void {
    this.destination = destination.name;
    this.onDestinationChange();
    const queryParams: any = {
      destination: destination.name,
    };
    if (this.category !== 'Todas') queryParams.category = this.category;
    if (this.guests) queryParams.guests = this.guests;

    this.searchSubmitted.emit(queryParams);
    this.router.navigate(['/explore'], { queryParams });
  }

  onSearch() {
    const queryParams: any = {};
    if (this.destination.trim()) queryParams.destination = this.destination.trim();
    if (this.category !== 'Todas') queryParams.category = this.category;
    if (this.guests) queryParams.guests = this.guests;

    this.searchSubmitted.emit(queryParams);
    this.router.navigate(['/explore'], { queryParams });
  }
}
