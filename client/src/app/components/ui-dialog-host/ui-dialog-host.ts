import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiDialogService } from '../../services/ui-dialog.service';

@Component({
  selector: 'app-ui-dialog-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-dialog-host.html',
  styleUrl: './ui-dialog-host.css',
})
export class UiDialogHostComponent {
  readonly uiDialog = inject(UiDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.uiDialog.activeConfirm()) {
      this.uiDialog.resolveConfirm(false);
    }
  }
}

