import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { ApexOptions } from 'apexcharts';
import { ApexChartComponent } from '@app/components/ui/apex-chart.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { formatCurrency } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import type { CategorySpend } from '@app/core/data/types';

/** Gasto por categoria dos pedidos emitidos. */
@Component({
  selector: 'app-spend-chart',
  standalone: true,
  imports: [ApexChartComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.length === 0) {
      <app-empty-state
        icon="chart"
        [title]="transloco.translate('dashboard.noSpend')"
        [description]="transloco.translate('dashboard.noSpendDesc')"
      />
    } @else {
      <app-apex-chart type="bar" [height]="height" [series]="$any(series())" [options]="options()" />
    }
  `,
})
export class SpendChartComponent {
  protected transloco = inject(TranslocoService);
  private lang = activeLang();

  @Input({ required: true }) set data(v: CategorySpend[]) {
    this._data.set(v);
  }
  get data() {
    return this._data();
  }
  private _data = signal<CategorySpend[]>([]);

  @Input() height = 320;

  protected readonly series = computed(() => {
    this.lang();
    const data = this._data();
    return [{ name: this.transloco.translate('dashboard.spend'), data: data.map((d) => d.value) }];
  });

  protected readonly options = computed<ApexOptions>(() => {
    const lang = this.lang();
    const data = this._data();
    return {
      chart: { type: 'bar', stacked: false },
      colors: data.map((d) => d.color),
      plotOptions: {
        bar: { horizontal: true, borderRadius: 6, distributed: true, barHeight: '62%' },
      },
      xaxis: {
        categories: data.map((d) => d.label),
        labels: { formatter: (val: string) => formatCurrency(Number(val), lang) },
      },
      legend: { show: false },
      tooltip: { y: { formatter: (val: number) => formatCurrency(val, lang) } },
      grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    };
  });
}
