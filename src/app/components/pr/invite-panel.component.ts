import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { SupplierStatusPillComponent } from './status-pill.component';
import { RatingStarsComponent } from './rating-stars.component';
import { inviteBlock, supplierRatedCount, supplierRating } from '@app/core/data/query';
import { usePlural } from '@app/lib/i18n';
import type { Order, Quote, Supplier } from '@app/core/data/types';

/**
 * Convite de fornecedores para a rodada. Fornecedor suspenso aparece na lista
 * com o botão travado e o motivo escrito — em vez de sumir sem explicação.
 */
@Component({
  selector: 'app-invite-panel',
  standalone: true,
  imports: [FormsModule, TranslocoModule, IconComponent, EmptyStateComponent, SupplierStatusPillComponent, RatingStarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6" *transloco="let t">
      <div>
        <p class="mb-3 text-sm font-semibold text-heading">{{ t(pl('invite.invitedTitle', invited().length), { count: invited().length }) }}</p>
        @if (invited().length === 0) {
          <p class="rounded-lg border border-dashed border-themed px-4 py-5 text-center text-xs text-muted">
            {{ t('invite.invitedEmpty') }}
          </p>
        } @else {
          <ul class="space-y-2">
            @for (s of invited(); track s.id) {
              <li class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-themed px-3 py-2.5">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-heading">{{ s.name }}</p>
                  <p class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <app-supplier-status-pill [status]="s.status" />
                    <span [class]="responded(s.id) ? 'text-success-600 dark:text-success-500' : 'text-warning-600 dark:text-warning-500'">
                      {{ responded(s.id) ? t('invite.responded') : t('invite.waiting') }}
                    </span>
                  </p>
                </div>
                @if (!disabled) {
                  <button
                    type="button"
                    (click)="remove.emit(s.id)"
                    class="flex h-8 items-center gap-1.5 rounded-lg border border-themed px-3 text-xs font-medium text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10"
                  >
                    <app-icon name="x" [size]="13" />
                    {{ t('invite.remove') }}
                  </button>
                }
              </li>
            }
          </ul>
        }
      </div>

      @if (!disabled) {
        <div>
          <p class="mb-3 text-sm font-semibold text-heading">{{ t('invite.addTitle') }}</p>
          <div class="relative mb-3">
            <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
              <app-icon name="search" [size]="16" />
            </span>
            <input
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              [placeholder]="t('invite.searchPlaceholder')"
              class="focus-ring w-full rounded-lg border border-themed bg-transparent py-2 pr-3 pl-9 text-sm text-body"
            />
          </div>

          @if (candidates().length === 0) {
            <app-empty-state icon="handshake" [title]="transloco.translate('invite.emptyTitle')" [description]="transloco.translate('invite.emptyDesc')" />
          } @else {
            <ul class="max-h-80 space-y-2 overflow-y-auto pr-1">
              @for (s of candidates(); track s.id) {
                <li class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-themed px-3 py-2.5">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-heading">{{ s.name }}</p>
                    <p class="mt-0.5 flex flex-wrap items-center gap-2">
                      <app-supplier-status-pill [status]="s.status" />
                      <app-rating-stars [value]="ratingOf(s.id)" [count]="ratedCountOf(s.id)" [size]="13" />
                    </p>
                    @if (blockOf(s); as block) {
                      <p class="mt-1 text-xs font-medium text-error-600 dark:text-error-500">
                        {{ t('invite.block.' + block, { name: s.name }) }}
                      </p>
                    }
                  </div>
                  <button
                    type="button"
                    [disabled]="!!blockOf(s)"
                    (click)="invite.emit(s.id)"
                    class="flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <app-icon name="plus" [size]="13" />
                    {{ t('invite.add') }}
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
})
export class InvitePanelComponent {
  protected transloco = inject(TranslocoService);
  protected pl = usePlural();

  @Input({ required: true }) set quote(v: Quote) {
    this._quote.set(v);
  }
  get quote() {
    return this._quote();
  }
  private _quote = signal<Quote>(null as unknown as Quote);

  @Input({ required: true }) suppliers!: Supplier[];
  @Input({ required: true }) orders!: Order[];
  @Input() disabled = false;
  @Output() invite = new EventEmitter<number>();
  @Output() remove = new EventEmitter<number>();

  protected search = signal('');
  private now = new Date();

  protected readonly invited = computed(() => {
    const quote = this._quote();
    return quote.supplierIds
      .map((id) => this.suppliers.find((s) => s.id === id))
      .filter((s): s is Supplier => Boolean(s));
  });

  protected readonly candidates = computed(() => {
    const quote = this._quote();
    const term = this.search().trim().toLowerCase();
    return this.suppliers
      .filter((s) => !quote.supplierIds.includes(s.id))
      .filter((s) => s.categories.includes(quote.categoryId) || s.status === 'suspenso')
      .filter((s) => !term || s.name.toLowerCase().includes(term) || s.cnpj.includes(term))
      .sort((a, b) => {
        if (a.status === 'suspenso' && b.status !== 'suspenso') return 1;
        if (b.status === 'suspenso' && a.status !== 'suspenso') return -1;
        return a.name.localeCompare(b.name);
      });
  });

  protected responded(supplierId: number) {
    return this._quote().bids.some((b) => b.supplierId === supplierId);
  }
  protected blockOf(supplier: Supplier) {
    return inviteBlock(supplier, this._quote());
  }
  protected ratingOf(supplierId: number) {
    return supplierRating(supplierId, this.orders, this.now);
  }
  protected ratedCountOf(supplierId: number) {
    return supplierRatedCount(supplierId, this.orders, this.now);
  }
}
