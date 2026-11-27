import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { SupplierStatusPillComponent } from './status-pill.component';
import { RatingStarsComponent } from './rating-stars.component';
import { categoryById, expiredDocs } from '@app/core/data/query';
import { prImage } from '@app/core/data/mock';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import type { Category, Supplier } from '@app/core/data/types';

@Component({
  selector: 'app-supplier-card',
  standalone: true,
  imports: [TranslocoModule, IconComponent, SupplierStatusPillComponent, RatingStarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="surface-card flex flex-col overflow-hidden rounded-2xl border transition hover:shadow-theme-md"
      *transloco="let t"
    >
      <div class="relative h-28 w-full">
        <img [src]="cover" alt="" loading="lazy" class="h-full w-full object-cover" />
        <span class="absolute top-3 right-3">
          <app-supplier-status-pill [status]="supplier.status" />
        </span>
      </div>

      <div class="flex flex-1 flex-col p-5">
        <h3 class="text-base font-semibold text-heading">{{ supplier.name }}</h3>
        <p class="mt-0.5 text-xs text-muted">
          CNPJ {{ supplier.cnpj }} · {{ supplier.contact.city }}/{{ supplier.contact.state }}
        </p>

        <div class="mt-3 flex flex-wrap gap-1.5">
          @for (id of supplier.categories; track id) {
            @if (categoryOf(id); as cat) {
              <span
                class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <app-icon [name]="cat.icon" [size]="11" />
                {{ cat.name }}
              </span>
            }
          }
        </div>

        <div class="mt-4 space-y-2 text-xs text-muted">
          <p class="flex items-center justify-between gap-2">
            <span>{{ t('suppliers.rating') }}</span>
            <app-rating-stars [value]="rating" [count]="ratedCount" [size]="14" />
          </p>
          <p class="flex items-center justify-between gap-2">
            <span>{{ t('suppliers.volume') }}</span>
            <span class="font-semibold text-heading">{{ formatCurrency(volume, lang()) }}</span>
          </p>
          <p class="flex items-center justify-between gap-2">
            <span>{{ t('suppliers.since') }}</span>
            <span class="text-body">{{ formatDate(supplier.since, lang()) }}</span>
          </p>
        </div>

        @if (expired.length > 0) {
          <p
            class="mt-3 flex items-start gap-1.5 rounded-lg bg-error-50 px-3 py-2 text-[11px] font-medium text-error-600 dark:bg-error-500/15 dark:text-error-500"
          >
            <app-icon name="alert-triangle" [size]="13" class="mt-px" />
            {{ t(pl('suppliers.expiredDocs', expired.length), { count: expired.length, list: expiredList() }) }}
          </p>
        }

        @if (openable) {
          <button
            type="button"
            (click)="open.emit()"
            class="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-themed text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <app-icon name="eye" [size]="16" />
            {{ t('suppliers.open') }}
          </button>
        }
      </div>
    </article>
  `,
})
export class SupplierCardComponent {
  @Input({ required: true }) supplier!: Supplier;
  @Input({ required: true }) categories!: Category[];
  @Input() rating: number | null = null;
  @Input() ratedCount = 0;
  @Input() volume = 0;
  @Input() now: Date = new Date();
  @Input() openable = false;
  @Output() open = new EventEmitter<void>();

  private transloco = inject(TranslocoService);
  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;

  get cover() {
    return prImage(this.supplier.seeds[0], 640, 240);
  }
  get expired() {
    return expiredDocs(this.supplier, this.now);
  }
  protected categoryOf(id: number) {
    return categoryById(this.categories, id);
  }

  protected expiredList() {
    // Uma lista dinâmica de chaves não dá para resolver com o pipe `transloco`
    // do template — cada doc é traduzido aqui antes de entrar no parâmetro.
    this.lang();
    return this.expired.map((k) => this.transloco.translate(`docs.${k}`)).join(', ');
  }
}
