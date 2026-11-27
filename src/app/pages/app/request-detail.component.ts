import { ChangeDetectionStrategy, Component, Input, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import type { Crumb } from '@app/components/ui/breadcrumb.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { AvatarComponent } from '@app/components/ui/avatar.component';
import { TabsComponent, type TabItem } from '@app/components/ui/tabs.component';
import { ModalComponent } from '@app/components/ui/modal.component';
import { RequestStatusPillComponent } from '@app/components/pr/status-pill.component';
import { ApprovalTrailComponent } from '@app/components/pr/approval-trail.component';
import { BudgetBarComponent } from '@app/components/pr/budget-bar.component';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import {
  approvalState,
  budgetState,
  canApprove,
  categoryById,
  costCenterById,
  itemById,
  memberById,
  requestById,
  resolveLines,
} from '@app/core/data/query';
import { formatCurrency, formatDate, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { setLiteralTitle } from '@app/core/page-title';
import type { PurchaseRequest, Supplier } from '@app/core/data/types';

const EMPTY_REQUEST: PurchaseRequest = {
  id: 0,
  code: '',
  requesterId: 0,
  costCenterId: 0,
  createdAt: new Date(0).toISOString(),
  neededBy: new Date(0).toISOString(),
  justification: '',
  lines: [],
  status: 'rascunho',
  approvals: [],
};

@Component({
  selector: 'app-request-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    AvatarComponent,
    TabsComponent,
    ModalComponent,
    RequestStatusPillComponent,
    ApprovalTrailComponent,
    BudgetBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (!request()) {
        <app-empty-state icon="clipboard" [title]="t('requests.notFound')" [description]="t('requests.notFoundDesc')" [hasAction]="true">
          <a routerLink="/app/requisicoes" class="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600">
            {{ t('requests.backToList') }}
          </a>
        </app-empty-state>
      } @else {
        <app-page-header [title]="request()!.code" [subtitle]="request()!.justification" [crumbs]="crumbs(t)">
          <div class="flex flex-wrap gap-2">
            @if (request()!.status === 'rascunho') {
              <button
                type="button"
                (click)="handleSubmit()"
                class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                <app-icon name="send" [size]="16" />
                {{ t('requests.sendForApproval') }}
              </button>
            }
            @if (request()!.status === 'aprovada') {
              <button
                type="button"
                (click)="openQuoteDialog()"
                class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                <app-icon name="scale" [size]="16" />
                {{ t('requests.openQuote') }}
              </button>
            }
            @if (linkedQuote(); as lq) {
              <a
                [routerLink]="['/app/cotacoes', lq.id]"
                class="flex h-11 items-center gap-2 rounded-lg border border-themed px-5 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <app-icon name="table" [size]="16" />
                {{ t('requests.seeQuote') }}
              </a>
            }
          </div>
        </app-page-header>

        <div class="grid gap-6 xl:grid-cols-3">
          <div class="space-y-6 xl:col-span-2">
            <div class="surface-card rounded-2xl border p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <app-request-status-pill [status]="request()!.status" />
                <p class="text-sm text-muted">
                  {{ t('requests.createdOn', { date: formatDate(request()!.createdAt, lang()) }) }} ·
                  {{ t('requests.neededBy', { date: formatDate(request()!.neededBy, lang()) }) }}
                </p>
              </div>

              <dl class="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt class="text-xs text-muted">{{ t('requests.requester') }}</dt>
                  <dd class="mt-1.5 flex items-center gap-2">
                    <app-avatar [src]="requester()?.avatar" [name]="requester()?.name" size="sm" />
                    <span class="text-sm font-medium text-heading">{{ requester()?.name ?? '—' }}</span>
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">{{ t('requests.costCenter') }}</dt>
                  <dd class="mt-1.5 text-sm font-medium text-heading">
                    {{ costCenter() ? costCenter()!.code + ' · ' + costCenter()!.name : '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">{{ t('requests.value') }}</dt>
                  <dd class="mt-1.5 text-sm font-bold text-heading">{{ formatCurrency(state().value, lang()) }}</dd>
                </div>
              </dl>

              <div class="mt-5 rounded-xl border border-themed p-4">
                <p class="text-xs text-muted">{{ t('requests.justification') }}</p>
                <p class="mt-1.5 text-sm text-body">{{ request()!.justification }}</p>
              </div>
            </div>

            <div class="surface-card overflow-hidden rounded-2xl border">
              <div class="px-5 pt-5">
                <app-tabs [tabs]="tabItems(t)" [value]="tab()" (onChange)="tab.set($event)">
                  @switch (tab()) {
                    @case (0) {
                      <div class="overflow-x-auto">
                        <table class="w-full min-w-max text-sm">
                          <thead>
                            <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
                              <th class="px-4 py-2.5 text-left">{{ t('requests.item') }}</th>
                              <th class="px-4 py-2.5 text-left">{{ t('opportunities.sku') }}</th>
                              <th class="px-4 py-2.5 text-right">{{ t('requests.qty') }}</th>
                              <th class="px-4 py-2.5 text-right">{{ t('requests.refPrice') }}</th>
                              <th class="px-4 py-2.5 text-right">{{ t('requests.lineTotal') }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (l of lines(); track l.itemId) {
                              <tr class="border-b border-themed last:border-0">
                                <td class="px-4 py-3">
                                  <span class="block font-medium text-heading">{{ l.item?.name ?? '—' }}</span>
                                  @if (l.item) {
                                    <span class="block text-xs text-muted">{{ categoryOf(l.item.categoryId)?.name ?? '' }}</span>
                                  }
                                </td>
                                <td class="px-4 py-3 text-muted">{{ l.item?.sku ?? '—' }}</td>
                                <td class="px-4 py-3 text-right text-body">
                                  {{ formatNumber(l.qty, lang()) }}
                                  <span class="text-xs text-muted">{{ l.item ? t(pl('units.' + l.item.unit, l.qty), { count: l.qty }) : '' }}</span>
                                </td>
                                <td class="px-4 py-3 text-right text-body">{{ formatCurrency(l.refPrice, lang()) }}</td>
                                <td class="px-4 py-3 text-right font-semibold text-heading">{{ formatCurrency(l.total, lang()) }}</td>
                              </tr>
                            }
                          </tbody>
                          <tfoot>
                            <tr class="border-t border-themed bg-gray-50 dark:bg-gray-900/40">
                              <td colspan="4" class="px-4 py-3 text-right text-sm font-semibold text-heading">{{ t('requests.estimated') }}</td>
                              <td class="px-4 py-3 text-right text-base font-bold text-heading">{{ formatCurrency(state().value, lang()) }}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    }
                    @case (1) {
                      @if (costCenter() && budget(); as b) {
                        <div class="space-y-4">
                          <app-budget-bar [costCenter]="costCenter()!" [state]="b" />
                          <p class="text-xs text-muted">{{ t('requests.budgetExplain') }}</p>
                        </div>
                      } @else {
                        <p class="text-sm text-muted">{{ t('requests.noBudget') }}</p>
                      }
                    }
                  }
                </app-tabs>
              </div>
              <div class="h-5"></div>
            </div>
          </div>

          <aside class="space-y-6">
            <div class="surface-card rounded-2xl border p-5">
              <app-approval-trail [request]="request()!" [members]="procure.members()" [state]="state()" />

              @if (request()!.status === 'aguardando-aprovacao') {
                <div class="mt-5 border-t border-themed pt-5">
                  @if (canAct()) {
                    <div class="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        (click)="startDecision('approve')"
                        class="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-success-500 text-sm font-medium text-white transition hover:bg-success-600"
                      >
                        <app-icon name="check" [size]="16" [strokeWidth]="2.6" />
                        {{ t('requests.approve') }}
                      </button>
                      <button
                        type="button"
                        (click)="startDecision('reject')"
                        class="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-themed text-sm font-medium text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10"
                      >
                        <app-icon name="x" [size]="16" [strokeWidth]="2.6" />
                        {{ t('requests.reject') }}
                      </button>
                    </div>
                  } @else {
                    <p class="flex items-start gap-2 rounded-lg bg-warning-50 px-4 py-3 text-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
                      <app-icon name="info" [size]="14" class="mt-px" />
                      {{ t('requests.cannotApprove', { acting: acting()?.name ?? '—', role: state().nextRole ? t('roles.' + state().nextRole) : '—' }) }}
                    </p>
                  }
                </div>
              }
            </div>
          </aside>
        </div>

        <!-- Aprovar / recusar -->
        <app-modal
          [open]="decision() !== null"
          [title]="decision() === 'reject' ? t('requests.rejectTitle') : t('requests.approveTitle')"
          [subtitle]="request()!.code"
          [hasFooter]="true"
          (closed)="decision.set(null)"
        >
          <div class="space-y-4">
            <p class="text-sm text-muted">
              {{ t('requests.decisionAs', { name: acting()?.name ?? '—', role: acting() ? t('roles.' + acting()!.role) : '—' }) }}
            </p>
            <div class="space-y-1.5">
              <label for="dec-note" class="block text-sm font-medium text-heading">{{ t('requests.decisionNote') }}</label>
              <textarea
                id="dec-note"
                rows="3"
                [ngModel]="note()"
                (ngModelChange)="note.set($event)"
                [placeholder]="t('requests.decisionNotePlaceholder')"
                class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3.5 py-2.5 text-sm text-body placeholder:text-muted"
              ></textarea>
            </div>
          </div>

          <ng-container modalFooter>
            <button
              type="button"
              (click)="decision.set(null)"
              class="rounded-lg border border-themed px-4 py-2 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              (click)="confirmDecision()"
              [class]="'rounded-lg px-4 py-2 text-sm font-medium text-white transition ' + (decision() === 'reject' ? 'bg-error-500 hover:bg-error-600' : 'bg-success-500 hover:bg-success-600')"
            >
              {{ decision() === 'reject' ? t('requests.reject') : t('requests.approve') }}
            </button>
          </ng-container>
        </app-modal>

        <!-- Gerar cotação -->
        <app-modal
          [open]="quoteOpen()"
          [title]="t('quotes.openTitle')"
          [subtitle]="request()!.code"
          size="lg"
          [hasFooter]="true"
          (closed)="quoteOpen.set(false)"
        >
          <div class="space-y-5">
            <div class="space-y-1.5">
              <label for="q-title" class="block text-sm font-medium text-heading">{{ t('quotes.objectLabel') }}</label>
              <input
                id="q-title"
                [ngModel]="quoteTitle()"
                (ngModelChange)="quoteTitle.set($event)"
                class="focus-ring h-11 w-full rounded-lg border border-themed bg-transparent px-3.5 text-sm text-body"
              />
            </div>

            <div class="space-y-1.5">
              <label for="q-days" class="block text-sm font-medium text-heading">{{ t('quotes.daysLabel') }}</label>
              <input
                id="q-days"
                type="number"
                min="1"
                max="60"
                [ngModel]="quoteDays()"
                (ngModelChange)="quoteDays.set(Math.max(1, +$event || 1))"
                class="focus-ring h-11 w-32 rounded-lg border border-themed bg-transparent px-3.5 text-sm text-body"
              />
            </div>

            <div>
              <p class="mb-2 text-sm font-medium text-heading">{{ t('quotes.pickSuppliers') }}</p>
              <p class="mb-3 text-xs text-muted">{{ t('quotes.pickSuppliersHint') }}</p>
              @if (suggested().length === 0) {
                <p class="rounded-lg border border-dashed border-themed px-4 py-5 text-center text-xs text-muted">{{ t('quotes.noSuppliers') }}</p>
              } @else {
                <ul class="max-h-64 space-y-2 overflow-y-auto pr-1">
                  @for (s of suggested(); track s.id) {
                    <li>
                      <button
                        type="button"
                        (click)="togglePicked(s.id)"
                        [class]="
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ' +
                          (isPicked(s.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-themed hover:bg-gray-50 dark:hover:bg-gray-800')
                        "
                      >
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-medium text-heading">{{ s.name }}</span>
                          <span class="block text-xs text-muted">{{ t('supplierStatus.' + s.status) }} · {{ s.contact.city }}/{{ s.contact.state }}</span>
                        </span>
                        @if (isPicked(s.id)) {
                          <app-icon name="check-circle" [size]="17" class="text-brand-500" />
                        }
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>

          <ng-container modalFooter>
            <button
              type="button"
              (click)="quoteOpen.set(false)"
              class="rounded-lg border border-themed px-4 py-2 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              (click)="confirmQuote()"
              [disabled]="picked().length === 0"
              class="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <app-icon name="scale" [size]="16" />
              {{ t('quotes.openConfirm') }}
            </button>
          </ng-container>
        </app-modal>
      }
    </ng-container>
  `,
})
export class RequestDetailPageComponent {
  protected procure = inject(ProcureService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);
  private router = inject(Router);

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected formatNumber = formatNumber;
  protected readonly Math = Math;

  /** Vem do `withComponentInputBinding()` do router. */
  @Input() set id(v: string) {
    this._id.set(Number(v) || 0);
  }
  private _id = signal(0);

  protected tab = signal(0);
  protected decision = signal<'approve' | 'reject' | null>(null);
  protected note = signal('');
  protected quoteOpen = signal(false);
  protected quoteTitle = signal('');
  protected quoteDays = signal(7);
  protected picked = signal<number[]>([]);

  protected readonly request = computed(() => requestById(this.procure.requests(), this._id()));
  protected readonly acting = computed(() => memberById(this.procure.members(), this.procure.actingMemberId()));

  constructor() {
    effect(() => {
      const request = this.request();
      this.lang();
      setLiteralTitle(request ? request.code : this.transloco.translate('requests.notFound'));
    });
  }

  /**
   * A tela inteira de resultado (`@if (!request())`) esconde tudo que usaria
   * este valor quando não há requisição — cai aqui só o placeholder para o
   * `computed` sempre devolver um `ApprovalState` válido.
   */
  protected readonly state = computed(() => {
    const request = this.request();
    return request
      ? approvalState(request, this.procure.members(), this.procure.items())
      : approvalState(EMPTY_REQUEST, [], []);
  });
  protected readonly requester = computed(() => {
    const request = this.request();
    return request ? memberById(this.procure.members(), request.requesterId) : undefined;
  });
  protected readonly costCenter = computed(() => {
    const request = this.request();
    return request ? costCenterById(this.procure.costCenters(), request.costCenterId) : undefined;
  });
  protected readonly lines = computed(() => {
    const request = this.request();
    return request ? resolveLines(request.lines, this.procure.items()) : [];
  });
  protected readonly budget = computed(() => {
    const cc = this.costCenter();
    return cc
      ? budgetState(cc, this.procure.requests(), this.procure.orders(), this.procure.quotes(), this.procure.items())
      : null;
  });
  protected readonly canAct = computed(() => {
    const request = this.request();
    const acting = this.acting();
    return !!request && request.status === 'aguardando-aprovacao' && acting !== undefined && canApprove(acting, this.state());
  });
  protected readonly linkedQuote = computed(() => {
    const request = this.request();
    return request ? this.procure.quotes().find((q) => q.requestIds.includes(request.id)) : undefined;
  });

  // Categoria dominante das linhas — sugestão para a cotação.
  protected readonly mainCategoryId = computed(() => {
    const request = this.request();
    if (!request) return this.procure.categories()[0]?.id ?? 1;
    const items = this.procure.items();
    const tally = new Map<number, number>();
    request.lines.forEach((l) => {
      const cat = itemById(items, l.itemId)?.categoryId;
      if (cat) tally.set(cat, (tally.get(cat) ?? 0) + 1);
    });
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? this.procure.categories()[0]?.id ?? 1;
  });

  protected readonly suggested = computed<Supplier[]>(() => {
    const catId = this.mainCategoryId();
    return this.procure.suppliers().filter((s) => s.categories.includes(catId) && s.status !== 'suspenso');
  });

  protected crumbs(t: (key: string) => string): Crumb[] {
    return [
      { label: t('appNav.dashboard'), href: '/app' },
      { label: t('appNav.requests'), href: '/app/requisicoes' },
      { label: this.request()?.code ?? '' },
    ];
  }

  protected tabItems(t: (key: string) => string): TabItem[] {
    return [
      { label: t('requests.tabItems'), icon: 'package' },
      { label: t('requests.tabBudget'), icon: 'chart' },
    ];
  }

  protected categoryOf(id: number) {
    return categoryById(this.procure.categories(), id);
  }

  protected handleSubmit() {
    const request = this.request();
    if (!request) return;
    const res = this.procure.submitRequest(request.id);
    if (res.ok) this.ui.notifySuccess(this.transloco.translate('requests.sent'));
    else this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected startDecision(kind: 'approve' | 'reject') {
    this.decision.set(kind);
    this.note.set('');
  }

  protected confirmDecision() {
    const acting = this.acting();
    const request = this.request();
    const decision = this.decision();
    if (!acting || !decision || !request) return;
    const res =
      decision === 'approve'
        ? this.procure.approveRequest(request.id, acting.id, this.note().trim())
        : this.procure.rejectRequest(request.id, acting.id, this.note().trim());
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate(decision === 'approve' ? 'requests.approved' : 'requests.rejected'));
      this.decision.set(null);
      this.note.set('');
      return;
    }
    if (res.reason === 'alcada') {
      this.ui.notifyWarning(
        this.transloco.translate('requests.notYourLevel', { role: res.role ? this.transloco.translate(`roles.${res.role}`) : '—' })
      );
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected openQuoteDialog() {
    const request = this.request();
    if (!request) return;
    this.quoteTitle.set(request.justification);
    this.picked.set(
      this.suggested()
        .slice(0, 3)
        .map((s) => s.id)
    );
    this.quoteOpen.set(true);
  }

  protected isPicked(id: number) {
    return this.picked().includes(id);
  }
  protected togglePicked(id: number) {
    this.picked.update((list) => (list.includes(id) ? list.filter((i) => i !== id) : [...list, id]));
  }

  protected confirmQuote() {
    const request = this.request();
    if (!request) return;
    const res = this.procure.openQuote({
      title: this.quoteTitle().trim() || request.justification,
      categoryId: this.mainCategoryId(),
      requestIds: [request.id],
      supplierIds: this.picked(),
      days: this.quoteDays(),
    });
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('quotes.opened'));
      this.quoteOpen.set(false);
      this.router.navigate(['/app/cotacoes', res.id]);
      return;
    }
    if (res.reason === 'suspenso') {
      this.ui.notifyError(this.transloco.translate('invite.block.suspenso', { name: res.supplier }));
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }
}
