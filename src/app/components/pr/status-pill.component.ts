import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { BadgeComponent } from '@app/components/ui/badge.component';
import type { OrderStatus, QuoteStatus, ReqStatus, SupplierStatus } from '@app/core/data/types';

type Color = 'brand' | 'success' | 'warning' | 'error' | 'gray';

const REQ: Record<ReqStatus, { color: Color; icon: string }> = {
  rascunho: { color: 'gray', icon: 'edit' },
  'aguardando-aprovacao': { color: 'warning', icon: 'clock' },
  aprovada: { color: 'success', icon: 'check-circle' },
  recusada: { color: 'error', icon: 'x-circle' },
  'em-cotacao': { color: 'brand', icon: 'scale' },
  atendida: { color: 'success', icon: 'package' },
};

const QUOTE: Record<QuoteStatus, { color: Color; icon: string }> = {
  aberta: { color: 'brand', icon: 'clock' },
  encerrada: { color: 'success', icon: 'trophy' },
  cancelada: { color: 'gray', icon: 'x-circle' },
};

const ORDER: Record<OrderStatus, { color: Color; icon: string }> = {
  emitido: { color: 'brand', icon: 'file-text' },
  parcial: { color: 'warning', icon: 'inbox' },
  recebido: { color: 'success', icon: 'check-circle' },
  atrasado: { color: 'error', icon: 'alert-triangle' },
  cancelado: { color: 'gray', icon: 'x-circle' },
};

const SUPPLIER: Record<SupplierStatus, { color: Color; icon: string }> = {
  pendente: { color: 'warning', icon: 'clock' },
  homologado: { color: 'success', icon: 'shield-check' },
  suspenso: { color: 'error', icon: 'alert-triangle' },
};

@Component({
  selector: 'app-request-status-pill',
  standalone: true,
  imports: [TranslocoModule, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-badge [color]="cfg.color" [icon]="cfg.icon">{{ 'reqStatus.' + status | transloco }}</app-badge>
  `,
})
export class RequestStatusPillComponent {
  @Input({ required: true }) status!: ReqStatus;
  get cfg() {
    return REQ[this.status];
  }
}

@Component({
  selector: 'app-quote-status-pill',
  standalone: true,
  imports: [TranslocoModule, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-badge [color]="cfg.color" [icon]="cfg.icon">{{ 'quoteStatus.' + status | transloco }}</app-badge>
  `,
})
export class QuoteStatusPillComponent {
  @Input({ required: true }) status!: QuoteStatus;
  get cfg() {
    return QUOTE[this.status];
  }
}

@Component({
  selector: 'app-order-status-pill',
  standalone: true,
  imports: [TranslocoModule, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-badge [color]="cfg.color" [icon]="cfg.icon">{{ 'orderStatus.' + status | transloco }}</app-badge>
  `,
})
export class OrderStatusPillComponent {
  @Input({ required: true }) status!: OrderStatus;
  get cfg() {
    return ORDER[this.status];
  }
}

@Component({
  selector: 'app-supplier-status-pill',
  standalone: true,
  imports: [TranslocoModule, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-badge [color]="cfg.color" [icon]="cfg.icon">{{ 'supplierStatus.' + status | transloco }}</app-badge>
  `,
})
export class SupplierStatusPillComponent {
  @Input({ required: true }) status!: SupplierStatus;
  get cfg() {
    return SUPPLIER[this.status];
  }
}

export const CATEGORY_FALLBACK_ICON = 'package';
