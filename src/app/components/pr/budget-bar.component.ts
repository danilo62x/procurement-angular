import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { formatCurrency } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import type { BudgetState, CostCenter } from '@app/core/data/types';

/**
 * Orçamento do centro de custo contra o comprometido — requisições aprovadas
 * ou em cotação mais os pedidos emitidos. Passou do teto, a barra avisa.
 */
@Component({
  selector: 'app-budget-bar',
  standalone: true,
  imports: [TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="compact ? '' : 'rounded-xl border border-themed p-4'" *transloco="let t">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-sm font-medium text-heading">{{ costCenter.code }} · {{ costCenter.name }}</p>
        <p [class]="'text-sm font-semibold ' + (state.over ? 'text-error-600 dark:text-error-500' : 'text-heading')">
          {{ formatCurrency(state.committed, lang()) }}
          <span class="text-xs font-normal text-muted"> / {{ formatCurrency(state.budget, lang()) }}</span>
        </p>
      </div>

      <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div [class]="'h-full rounded-full transition-all ' + barColor" [style.width.%]="pct"></div>
      </div>

      <div class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>{{
          t('budget.split', {
            requested: formatCurrency(state.requested, lang()),
            ordered: formatCurrency(state.ordered, lang()),
          })
        }}</span>
        <span [class]="state.over ? 'font-semibold text-error-600 dark:text-error-500' : ''">
          {{
            state.over
              ? t('budget.overBy', { value: formatCurrency(state.committed - state.budget, lang()) })
              : t('budget.available', { value: formatCurrency(state.available, lang()) })
          }}
        </span>
      </div>

      @if (state.over) {
        <p
          class="mt-3 flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-500"
        >
          <app-icon name="alert-triangle" [size]="14" class="mt-px" />
          {{ t('budget.alert', { code: costCenter.code }) }}
        </p>
      }
    </div>
  `,
})
export class BudgetBarComponent {
  @Input({ required: true }) costCenter!: CostCenter;
  @Input({ required: true }) state!: BudgetState;
  @Input() compact = false;

  protected lang = activeLang();
  protected formatCurrency = formatCurrency;

  get pct() {
    return Math.min(100, Math.round(this.state.ratio * 100));
  }
  get barColor() {
    if (this.state.over) return 'bg-error-500';
    return this.state.ratio > 0.85 ? 'bg-warning-500' : 'bg-brand-500';
  }
}
