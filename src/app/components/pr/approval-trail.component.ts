import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { AvatarComponent } from '@app/components/ui/avatar.component';
import { memberById } from '@app/core/data/query';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import type { ApprovalState, Member, PurchaseRequest } from '@app/core/data/types';

/**
 * A escada de alçada: os níveis que precisam assinar por causa do valor, quem
 * já assinou e quem falta. O nível é escolhido em `requiredRoles()` — nunca
 * fica gravado na requisição.
 */
@Component({
  selector: 'app-approval-trail',
  standalone: true,
  imports: [TranslocoModule, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5" *transloco="let t">
      <div class="rounded-xl border border-themed p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-sm font-semibold text-heading">{{ t('approval.ladderTitle') }}</p>
          <p class="text-sm font-bold text-heading">{{ formatCurrency(state.value, lang()) }}</p>
        </div>
        <p class="mt-1 text-xs text-muted">{{ t(pl('approval.ladderHint', state.requiredRoles.length), { count: state.requiredRoles.length }) }}</p>

        <ol class="mt-4 space-y-3">
          @for (role of state.requiredRoles; track role; let i = $index) {
            <li class="flex items-start gap-3">
              <span
                [class]="
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
                  (isSigned(role)
                    ? 'bg-success-500 text-white'
                    : isNext(role)
                      ? 'bg-warning-500 text-white'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')
                "
              >
                @if (isSigned(role)) {
                  <app-icon name="check" [size]="14" [strokeWidth]="3" />
                } @else {
                  {{ i + 1 }}
                }
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-heading">
                  {{ t('roles.' + role) }}
                  <span class="ml-2 text-xs font-normal text-muted">
                    {{ t('approval.limitUpTo', { value: formatCurrency(capFor(role), lang()) }) }}
                  </span>
                </p>
                <p class="text-xs text-muted">
                  {{
                    isSigned(role)
                      ? t('approval.signed')
                      : isNext(role)
                        ? t('approval.waitingOn', { names: nextApproverNames() })
                        : t('approval.notReached')
                  }}
                </p>
              </div>
            </li>
          }
        </ol>

        <div
          [class]="
            'mt-4 rounded-lg px-3 py-2.5 text-xs font-medium ' +
            (state.rejected
              ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
              : state.done
                ? 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500'
                : 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500')
          "
        >
          {{
            state.rejected
              ? t('approval.rejectedBy', { name: state.rejectedBy?.name ?? '—' })
              : state.done
                ? t('approval.complete')
                : t('approval.missing', { role: state.nextRole ? t('roles.' + state.nextRole) : '—' })
          }}
        </div>
      </div>

      <div>
        <p class="mb-3 text-sm font-semibold text-heading">{{ t('approval.historyTitle') }}</p>
        @if (request.approvals.length === 0) {
          <p class="rounded-lg border border-dashed border-themed px-4 py-6 text-center text-xs text-muted">
            {{ t('approval.historyEmpty') }}
          </p>
        } @else {
          <ul class="space-y-3">
            @for (a of request.approvals; track $index) {
              <li class="flex items-start gap-3">
                <app-avatar [src]="memberOf(a.memberId)?.avatar" [name]="memberOf(a.memberId)?.name ?? '—'" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-heading">
                    {{ memberOf(a.memberId)?.name ?? '—' }}
                    <span
                      [class]="
                        'ml-2 text-xs font-semibold ' +
                        (a.ok ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500')
                      "
                    >
                      {{ a.ok ? t('approval.approvedTag') : t('approval.rejectedTag') }}
                    </span>
                  </p>
                  <p class="text-xs text-muted">
                    {{ memberOf(a.memberId) ? t('roles.' + memberOf(a.memberId)!.role) : '—' }} ·
                    {{ formatDate(a.at, lang()) }}
                  </p>
                  @if (a.note) {
                    <p class="mt-1 text-xs text-body">{{ a.note }}</p>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class ApprovalTrailComponent {
  @Input({ required: true }) request!: PurchaseRequest;
  @Input({ required: true }) members!: Member[];
  @Input({ required: true }) state!: ApprovalState;

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;

  protected isSigned(role: string) {
    return this.state.approvedRoles.includes(role as never);
  }
  protected isNext(role: string) {
    return this.state.nextRole === role && !this.state.rejected;
  }
  protected capFor(role: string) {
    return Math.max(0, ...this.members.filter((m) => m.role === role).map((m) => m.limit));
  }
  protected nextApproverNames() {
    return this.state.nextApprovers.map((m) => m.name).join(', ') || '—';
  }
  protected memberOf(id: number) {
    return memberById(this.members, id);
  }
}
