import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChaletService } from '../../services/chalet.service';
import { Host, Chalet } from '../../models/chalet.model';
import { ChaletCardComponent } from '../../components/chalet-card/chalet-card';

@Component({
  selector: 'app-host-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ChaletCardComponent],
  templateUrl: './host-profile.html',
  styleUrl: './host-profile.css'
})
export class HostProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private chaletService = inject(ChaletService);

  host: (Host & { chalets: Chalet[]; chaletsCount: number }) | null = null;
  isLoading = true;

  // Direct Message Modal
  showMessageModal = false;
  messageText = '';
  messageSent = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadHost(id);
    }
  }

  loadHost(id: string): void {
    this.isLoading = true;
    this.chaletService.getHostById(id).subscribe({
      next: (data) => {
        this.host = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando perfil del anfitrión:', err);
        this.isLoading = false;
      }
    });
  }

  sendMessage(): void {
    if (this.messageText.trim()) {
      this.messageSent = true;
      setTimeout(() => {
        this.showMessageModal = false;
        this.messageSent = false;
        this.messageText = '';
      }, 2500);
    }
  }
}
