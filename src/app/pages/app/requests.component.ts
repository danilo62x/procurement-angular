import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { FilterBarComponent } from '@app/components/ui/filter-bar.component';
import { FilterSelectComponent } from '@app/components/ui/filter-select.component';
import { PaginationComponent } from '@app/components/ui/pagination.component';
import { AvatarComponent } from '@app/components/ui/avatar.component';
import { RequestStatusPillComponent } from '@app/components/pr/status-pill.component';
import { RequestDialogComponent } from '@app/components/pr/request-dialog.component';
import { ProcureService } from '@app/core/services/procure.service';
import { CartService } from '@app/core/services/cart.service';
import { UiService } from '@app/core/services/ui.service';
import { approvalState, canApprove, costCenterById, memberById } from '@app/core/data/query';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { ReqStatus } from '@app/core/data/types';

const STATUSES: ReqStatus[] = ['rascunho', 'aguardando-aprovacao', 'aprovada', 'recusada', 'em-cotacao', 'atendida'];
const PAGE_SIZE = 8;

@Component({
  selector: 'app-requests-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterSelectComponent,
    PaginationComponent,
    AvatarComponent,
    RequestStatusPillComponent,
    RequestDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-page-header [title]="t('requests.title')" [subtitle]="t('requests.subtitle')">
        <button
          type="button"
          (click)="dialogOpen.set(true)"
          class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <app-icon name="plus" [size]="17" />
          {{ t('requests.new') }}
        </button>
      </app-page-header>

      <div class="surface-card mb-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
        <div class="flex items-center gap-2 text-sm text-muted">
          <app-icon name="shield-check" [size]="16" />
          {{ t('requests.actingLabel') }}
        </div>
        <select
          [ngModel]="procure.actingMemberId()"
          (ngModelChange)="procure.setActingMember(+$event)"
          class="focus-ring rounded-lg border border-themed bg-transparent px-3 py-2 text-sm text-body"
        >
          @for (m of procure.members(); track m.id) {
            <option [value]="m.id">{{ m.name }} — {{ t('roles.' + m.role) }}{{ m.limit > 0 ? ' (' + formatCurrency(m.limit, lang()) + ')' : '' }}</option>
          }
        </select>
        <p class="text-xs text-muted sm:ml-auto">{{ t('requests.actingHint') }}</p>
      </div>

      <app-filter-bar [search]="search()" (searchChange)="search.set($event)" [searchPlaceholder]="t('requests.searchPlaceholder')">
        <app-filter-select [value]="status()" (valueChange)="status.set($event)" [label]="t('common.status')">
          <option value="all">{{ t('common.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ t('reqStatus.' + s) }}</option>
          }
        </app-filter-select>
        <app-filter-select [value]="costCenter()" (valueChange)="costCenter.set($event)" [label]="t('requests.costCenter')">
          <option value="all">{{ t('common.all') }}</option>
          @for (c of procure.costCenters(); track c.id) {
            <option [value]="c.id">{{ c.code }}</option>
          }
        </app-filter-select>
        <app-filter-select [value]="requester()" (valueChange)="requester.set($event)" [label]="t('requests.requester')">
          <option value="all">{{ t('common.all') }}</option>
          @for (m of procure.members(); track m.id) {
            <option [value]="m.id">{{ m.name }}</option>
          }
        </app-filter-select>
        <span filterAction class="text-sm text-muted">{{ t(pl('requests.showing', rows().length), { count: rows().length }) }}</span>
      </app-filter-bar>

      @if (rows().length === 0) {
        <app-empty-state icon="clipboard" [title]="t('requests.emptyTitle')" [description]="filtered() ? t('requests.emptyFiltered') : t('requests.emptyDesc')" [hasAction]="filtered()">
          @if (filtered()) {
            <button type="button" (click)="clearFilters()" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
              {{ t('common.clearFilters') }}
            </button>
          }
        </app-empty-state>
      } @else {
        <div class="surface-card overflow-hidden rounded-xl border">
          <div class="overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead>
                <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
                  <th class="px-4 py-3 text-left">{{ t('requests.code') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('requests.requester') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('requests.costCenter') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('requests.value') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('common.status') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('requests.waitingOn') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of current(); track row.request.id) {
                  <tr class="border-b border-themed last:border-0">
                    <td class="px-4 py-3">
                      <a [routerLink]="['/app/requisicoes', row.request.id]" class="font-medium text-brand-600 hover:underline dark:text-brand-400">
                        {{ row.request.code }}
                      </a>
                      <p class="mt-0.5 max-w-[240px] truncate text-xs text-muted">{{ row.request.justification }}</p>
                    </td>
                    <td class="px-4 py-3">
                      <span class="flex items-center gap-2">
                        <app-avatar [src]="memberOf(row.request.requesterId)?.avatar" [name]="memberOf(row.request.requesterId)?.name" size="xs" />
                        <span class="text-body">{{ memberOf(row.request.requesterId)?.name ?? '—' }}</span>
                      </span>
                    </td>
                    <td class="px-4 py-3 text-body">
                      {{ costCenterOf(row.request.costCenterId)?.code ?? '—' }}
                      <span class="block text-xs text-muted">{{ costCenterOf(row.request.costCenterId)?.name }}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-semibold text-heading">{{ formatCurrency(row.state.value, lang()) }}</td>
                    <td class="px-4 py-3"><app-request-status-pill [status]="row.request.status" /></td>
                    <td class="px-4 py-3">
                      @if (row.request.status === 'aguardando-aprovacao') {
                        <span class="text-xs text-warning-600 dark:text-warning-500">
                          {{ t('requests.waitingRole', { role: row.state.nextRole ? t('roles.' + row.state.nextRole) : '—' }) }}
                        </span>
                      } @else {
                        <span class="text-xs text-muted">{{ t('requests.neededBy', { date: formatDate(row.request.neededBy, lang()) }) }}</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (row.request.status === 'aguardando-aprovacao') {
                          <button
                            type="button"
                            (click)="handleDecision(row.request.id, true)"
                            [disabled]="!isActionable(row)"
                            [title]="isActionable(row) ? '' : t('requests.notYourLevelShort')"
                            class="flex h-8 items-center gap-1.5 rounded-lg bg-success-500 px-3 text-xs font-medium text-white transition hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <app-icon name="check" [size]="13" [strokeWidth]="2.6" />
                            {{ t('requests.approve') }}
                          </button>
                          <button
                            type="button"
                            (click)="handleDecision(row.request.id, false)"
                            [disabled]="!isActionable(row)"
                            [title]="isActionable(row) ? '' : t('requests.notYourLevelShort')"
                            class="flex h-8 items-center gap-1.5 rounded-lg border border-themed px-3 text-xs font-medium text-error-600 transition hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-error-500/10"
                          >
                            <app-icon name="x" [size]="13" [strokeWidth]="2.6" />
                            {{ t('requests.reject') }}
                          </button>
                        }
                        <a
                          [routerLink]="['/app/requisicoes', row.request.id]"
                          class="flex h-8 w-8 items-center justify-center rounded-lg border border-themed text-muted transition hover:text-heading"
                          [attr.aria-label]="t('common.open')"
                        >
                          <app-icon name="chevron-right" [size]="15" />
                        </a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-5">
          <app-pagination [page]="page()" [totalPages]="totalPages()" (onChange)="page.set($event)" />
        </div>
      }

      <app-request-dialog [open]="dialogOpen()" (closed)="dialogOpen.set(false)" (submitted)="createRequest($event)" />
    </ng-container>
  `,
})
export class RequestsPageComponent {
  protected procure = inject(ProcureService);
  protected cart = inject(CartService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected readonly statuses = STATUSES;

  protected search = signal('');
  protected status = signal('all');
  protected costCenter = signal('all');
  protected requester = signal('all');
  protected page = signal(1);
  protected dialogOpen = signal(this.route.snapshot.queryParamMap.get('nova') === '1');

  constructor() {
    usePageTitle('requests.title');
    if (this.route.snapshot.queryParamMap.get('nova') === '1') {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    const costCenter = this.costCenter();
    const requester = this.requester();
    const members = this.procure.members();
    const items = this.procure.items();
    return this.procure
      .requests()
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => costCenter === 'all' || r.costCenterId === Number(costCenter))
      .filter((r) => requester === 'all' || r.requesterId === Number(requester))
      .filter((r) => !term || r.code.toLowerCase().includes(term) || r.justification.toLowerCase().includes(term))
      .map((r) => ({ request: r, state: approvalState(r, members, items) }))
      .sort((a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime());
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)));
  protected readonly current = computed(() => {
    const page = Math.min(this.page(), this.totalPages());
    return this.rows().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  });
  protected readonly filtered = computed(
    () => this.status() !== 'all' || this.costCenter() !== 'all' || this.requester() !== 'all' || this.search() !== ''
  );

  protected memberOf(id: number) {
    return memberById(this.procure.members(), id);
  }
  protected costCenterOf(id: number) {
    return costCenterById(this.procure.costCenters(), id);
  }

  protected isActionable(row: { request: { status: string }; state: ReturnType<typeof approvalState> }) {
    const acting = memberById(this.procure.members(), this.procure.actingMemberId());
    return row.request.status === 'aguardando-aprovacao' && acting !== undefined && canApprove(acting, row.state);
  }

  protected clearFilters() {
    this.search.set('');
    this.status.set('all');
    this.costCenter.set('all');
    this.requester.set('all');
  }

  protected handleDecision(id: number, ok: boolean) {
    const acting = memberById(this.procure.members(), this.procure.actingMemberId());
    if (!acting) return;
    const note = this.transloco.translate(ok ? 'requests.defaultApproveNote' : 'requests.defaultRejectNote');
    const res = ok ? this.procure.approveRequest(id, acting.id, note) : this.procure.rejectRequest(id, acting.id, note);
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate(ok ? 'requests.approved' : 'requests.rejected'));
      return;
    }
    if (res.reason === 'alcada') {
      this.ui.notifyWarning(
        this.transloco.translate('requests.notYourLevel', {
          role: res.role ? this.transloco.translate(`roles.${res.role}`) : '—',
        })
      );
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected createRequest(submit: boolean) {
    if (!this.cart.lines().length || !this.cart.justification().trim()) {
      this.ui.notifyError(this.transloco.translate('requests.dialogInvalid'));
      return;
    }
    const created = this.procure.addRequest({
      requesterId: this.procure.actingMemberId(),
      costCenterId: this.cart.costCenterId(),
      neededBy: new Date(`${this.cart.neededBy().slice(0, 10)}T09:00:00`).toISOString(),
      justification: this.cart.justification().trim(),
      lines: this.cart.lines().map((l) => ({ ...l })),
      submit,
    });
    this.cart.clear();
    this.dialogOpen.set(false);
    this.ui.notifySuccess(
      this.transloco.translate(submit ? 'requests.createdSent' : 'requests.createdDraft', { code: created.code })
    );
  }
}
