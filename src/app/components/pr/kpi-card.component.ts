import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@app/components/ui/icon-base.component';

type Accent = 'brand' | 'success' | 'warning' | 'error' | 'info';

const BG: Record<Accent, string> = {
  brand: 'bg-brand-50 dark:bg-brand-500/15',
  success: 'bg-success-50 dark:bg-success-500/15',
  warning: 'bg-warning-50 dark:bg-warning-500/15',
  error: 'bg-error-50 dark:bg-error-500/15',
  info: 'bg-blue-light-50 dark:bg-blue-light-500/15',
};

const FG: Record<Accent, string> = {
  brand: 'text-brand-500',
  success: 'text-success-600',
  warning: 'text-warning-600',
  error: 'text-error-500',
  info: 'text-blue-light-500',
};

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="surface-card rounded-2xl border p-5 shadow-theme-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm text-muted">{{ title }}</p>
          <p class="mt-2 text-2xl font-bold break-words text-heading">{{ value }}</p>
          @if (hint) {
            <p class="mt-1 text-xs text-muted">{{ hint }}</p>
          }
        </div>
        <span [class]="'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' + bg">
          <app-icon [name]="icon" [size]="20" [class]="fg" />
        </span>
      </div>
      @if (hasFooter) {
        <div class="mt-4 border-t border-themed pt-3 text-xs text-muted"><ng-content /></div>
      }
    </div>
  `,
})
export class KpiCardComponent {
  @Input() title = '';
  @Input() value: string | number = '';
  @Input() icon = 'package';
  @Input() accent: Accent = 'brand';
  @Input() hint?: string;
  @Input() hasFooter = false;

  get bg() {
    return BG[this.accent];
  }
  get fg() {
    return FG[this.accent];
  }
}
