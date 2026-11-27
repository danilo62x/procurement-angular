import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import type { OrderProgress } from '@app/core/data/types';

/** Quanto do pedido já entrou — a soma dos recebimentos, item por item. */
@Component({
  selector: 'app-order-progress-bar',
  standalone: true,
  imports: [TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-w-[120px]">
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div [class]="'h-full rounded-full transition-all ' + color" [style.width.%]="pct"></div>
      </div>
      @if (showNumbers) {
        <p class="mt-1 text-xs text-muted">
          {{
            'orders.receivedOf'
              | transloco: { received: formatNumber(progress.received, lang()), ordered: formatNumber(progress.ordered, lang()) }
          }}
        </p>
      }
    </div>
  `,
})
export class OrderProgressBarComponent {
  @Input({ required: true }) progress!: OrderProgress;
  @Input() showNumbers = true;

  protected lang = activeLang();
  protected formatNumber = formatNumber;

  get pct() {
    return Math.round(this.progress.ratio * 100);
  }
  get color() {
    if (this.progress.complete) return 'bg-success-500';
    return this.progress.late ? 'bg-error-500' : 'bg-warning-500';
  }
}
