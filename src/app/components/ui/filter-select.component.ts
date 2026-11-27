import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Select rotulado usado dentro da `app-filter-bar`. */
@Component({
  selector: 'app-filter-select',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex items-center gap-2 text-sm text-muted">
      @if (label) {
        <span class="whitespace-nowrap">{{ label }}</span>
      }
      <select
        [ngModel]="value"
        (ngModelChange)="valueChange.emit($event)"
        class="focus-ring rounded-lg border border-themed bg-transparent px-3 py-2 text-sm text-body"
      >
        <ng-content />
      </select>
    </label>
  `,
})
export class FilterSelectComponent {
  @Input() value = '';
  @Input() label?: string;
  @Output() valueChange = new EventEmitter<string>();
}
