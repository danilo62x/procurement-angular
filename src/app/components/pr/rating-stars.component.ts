import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { usePlural } from '@app/lib/i18n';

/**
 * A nota do fornecedor nunca é digitada: chega aqui já como média das
 * avaliações dos pedidos recebidos. O modo clicável só aparece na avaliação
 * de um pedido específico (passe `pickable`).
 */
@Component({
  selector: 'app-rating-stars',
  standalone: true,
  imports: [TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value === null && !pickable) {
      <span class="text-xs text-muted">{{ 'rating.none' | transloco }}</span>
    } @else {
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-flex items-center gap-0.5">
          @for (n of stars; track n) {
            @if (pickable) {
              <button
                type="button"
                (click)="pick.emit(n)"
                [attr.aria-label]="n"
                [class]="n <= rounded ? 'text-warning-500' : 'text-gray-300 dark:text-gray-600'"
              >
                <app-icon name="star" [size]="size" [strokeWidth]="n <= rounded ? 2.4 : 1.8" />
              </button>
            } @else {
              <app-icon
                name="star"
                [size]="size"
                [strokeWidth]="n <= rounded ? 2.4 : 1.8"
                [class]="n <= rounded ? 'text-warning-500' : 'text-gray-300 dark:text-gray-600'"
              />
            }
          }
        </span>
        @if (value !== null) {
          <span class="text-xs font-semibold text-heading">{{ value.toFixed(1) }}</span>
        }
        @if (count !== undefined && count > 0) {
          <span class="text-xs text-muted">{{ fromKey() | transloco: { count } }}</span>
        }
      </span>
    }
  `,
})
export class RatingStarsComponent {
  /** Média já calculada; `null` quando o fornecedor ainda não tem pedido avaliado. */
  @Input() value: number | null = null;
  /** Quantos pedidos entraram na média. */
  @Input() count?: number;
  @Input() size = 16;
  /** Deixa as estrelas clicáveis (avaliação de um pedido recebido). */
  @Input() pickable = false;
  @Output() pick = new EventEmitter<number>();

  protected readonly stars = [1, 2, 3, 4, 5];
  protected pl = usePlural();

  get rounded() {
    return Math.round(this.value ?? 0);
  }

  protected fromKey() {
    return this.pl('rating.from', this.count ?? 0);
  }
}
