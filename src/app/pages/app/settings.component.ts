import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { AvatarComponent } from '@app/components/ui/avatar.component';
import { SwitchToggleComponent } from '@app/components/ui/switch-toggle.component';
import { TabsComponent, type TabItem } from '@app/components/ui/tabs.component';
import { BudgetBarComponent } from '@app/components/pr/budget-bar.component';
import { AuthService } from '@app/core/services/auth.service';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import { budgetStates, costCenterById } from '@app/core/data/query';
import { LANGUAGES } from '@app/core/transloco-loader';
import { formatCurrency } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePageTitle } from '@app/core/page-title';

const INPUT = 'focus-ring h-11 w-full rounded-lg border border-themed bg-transparent px-3.5 text-sm text-body placeholder:text-muted';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, TranslocoModule, PageHeaderComponent, IconComponent, AvatarComponent, SwitchToggleComponent, TabsComponent, BudgetBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-page-header [title]="t('settings.title')" [subtitle]="t('settings.subtitle')" [hasAction]="false" />

      <div class="surface-card rounded-2xl border p-5">
        <app-tabs [tabs]="tabItems(t)" [value]="tab()" (onChange)="tab.set($event)">
          @switch (tab()) {
            @case (0) {
              <div class="max-w-xl space-y-4">
                <div class="flex items-center gap-4">
                  <app-avatar [name]="auth.user()?.name" size="lg" />
                  <div>
                    <p class="text-sm font-medium text-heading">{{ auth.user()?.name || '—' }}</p>
                    <p class="text-xs text-muted">{{ auth.user()?.organization || procure.company().name }}</p>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label for="p-name" class="block text-sm font-medium text-heading">{{ t('settings.name') }}</label>
                  <input id="p-name" [ngModel]="name()" (ngModelChange)="name.set($event)" [class]="input" />
                </div>
                <div class="space-y-1.5">
                  <label for="p-email" class="block text-sm font-medium text-heading">{{ t('settings.email') }}</label>
                  <input id="p-email" type="email" [ngModel]="email()" (ngModelChange)="email.set($event)" [class]="input" />
                </div>
                <div class="space-y-1.5">
                  <label for="p-role" class="block text-sm font-medium text-heading">{{ t('settings.role') }}</label>
                  <input id="p-role" [ngModel]="role()" (ngModelChange)="role.set($event)" [class]="input" />
                </div>
                <button
                  type="button"
                  (click)="saveProfile()"
                  class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  <app-icon name="check" [size]="16" />
                  {{ t('common.save') }}
                </button>
              </div>
            }
            @case (1) {
              <div class="max-w-xl space-y-4">
                <div class="space-y-1.5">
                  <label for="c-name" class="block text-sm font-medium text-heading">{{ t('settings.legalName') }}</label>
                  <input id="c-name" [ngModel]="procure.company().legalName" (ngModelChange)="procure.updateCompany({ legalName: $event })" [class]="input" />
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label for="c-cnpj" class="block text-sm font-medium text-heading">{{ t('settings.cnpj') }}</label>
                    <input id="c-cnpj" [ngModel]="procure.company().cnpj" (ngModelChange)="procure.updateCompany({ cnpj: $event })" [class]="input" />
                  </div>
                  <div class="space-y-1.5">
                    <label for="c-phone" class="block text-sm font-medium text-heading">{{ t('settings.phone') }}</label>
                    <input id="c-phone" [ngModel]="procure.company().phone" (ngModelChange)="procure.updateCompany({ phone: $event })" [class]="input" />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label for="c-address" class="block text-sm font-medium text-heading">{{ t('settings.address') }}</label>
                  <input id="c-address" [ngModel]="procure.company().address" (ngModelChange)="procure.updateCompany({ address: $event })" [class]="input" />
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label for="c-days" class="block text-sm font-medium text-heading">{{ t('settings.quoteDays') }}</label>
                    <input
                      id="c-days"
                      type="number"
                      min="1"
                      max="60"
                      [ngModel]="procure.company().quoteDays"
                      (ngModelChange)="procure.updateCompany({ quoteDays: Math.max(1, +$event || 1) })"
                      [class]="input"
                    />
                    <p class="text-xs text-muted">{{ t('settings.quoteDaysHint') }}</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="c-min" class="block text-sm font-medium text-heading">{{ t('settings.minBids') }}</label>
                    <input
                      id="c-min"
                      type="number"
                      min="1"
                      max="10"
                      [ngModel]="procure.company().minBids"
                      (ngModelChange)="procure.updateCompany({ minBids: Math.max(1, +$event || 1) })"
                      [class]="input"
                    />
                    <p class="text-xs text-muted">{{ t('settings.minBidsHint') }}</p>
                  </div>
                </div>
              </div>
            }
            @case (2) {
              <div class="space-y-5">
                <p class="text-sm text-muted">{{ t('settings.limitsHint') }}</p>

                <div class="rounded-xl border border-themed p-4">
                  <label for="acting" class="block text-sm font-medium text-heading">{{ t('settings.actingMember') }}</label>
                  <select
                    id="acting"
                    [ngModel]="procure.actingMemberId()"
                    (ngModelChange)="procure.setActingMember(+$event)"
                    class="focus-ring mt-2 w-full max-w-md rounded-lg border border-themed bg-transparent px-3 py-2.5 text-sm text-body"
                  >
                    @for (m of procure.members(); track m.id) {
                      <option [value]="m.id">{{ m.name }} — {{ t('roles.' + m.role) }}</option>
                    }
                  </select>
                  <p class="mt-2 text-xs text-muted">{{ t('settings.actingHint') }}</p>
                </div>

                <div class="overflow-x-auto">
                  <table class="w-full min-w-max text-sm">
                    <thead>
                      <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
                        <th class="px-3 py-2.5 text-left">{{ t('settings.member') }}</th>
                        <th class="px-3 py-2.5 text-left">{{ t('settings.roleColumn') }}</th>
                        <th class="px-3 py-2.5 text-right">{{ t('settings.limit') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of procure.members(); track m.id) {
                        <tr class="border-b border-themed last:border-0">
                          <td class="px-3 py-2.5">
                            <span class="flex items-center gap-2">
                              <app-avatar [src]="m.avatar" [name]="m.name" size="xs" />
                              <span class="min-w-0">
                                <span class="block font-medium text-heading">{{ m.name }}</span>
                                <span class="block text-xs text-muted">{{ m.email }}</span>
                              </span>
                            </span>
                          </td>
                          <td class="px-3 py-2.5 text-body">{{ t('roles.' + m.role) }}</td>
                          <td class="px-3 py-2.5 text-right">
                            @if (m.role === 'solicitante') {
                              <span class="text-xs text-muted">{{ t('settings.noLimit') }}</span>
                            } @else {
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                [ngModel]="m.limit"
                                (ngModelChange)="procure.setMemberLimit(m.id, +$event || 0)"
                                class="focus-ring w-36 rounded-lg border border-themed bg-transparent px-2 py-1.5 text-right text-sm text-body"
                              />
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
            @case (3) {
              <div class="space-y-5">
                <p class="text-sm text-muted">{{ t('settings.centersHint') }}</p>
                @for (b of budgets(); track b.costCenterId) {
                  @if (costCenterOf(b.costCenterId); as cc) {
                    <div class="rounded-xl border border-themed p-4">
                      <app-budget-bar [costCenter]="cc" [state]="b" [compact]="true" />
                      <div class="mt-4 flex flex-wrap items-end gap-3">
                        <div class="space-y-1.5">
                          <label [for]="'cc-' + cc.id" class="block text-xs font-medium text-heading">{{ t('settings.budget') }}</label>
                          <input
                            [id]="'cc-' + cc.id"
                            type="number"
                            min="0"
                            step="10000"
                            [ngModel]="cc.budget"
                            (ngModelChange)="procure.updateCostCenter(cc.id, { budget: +$event || 0 })"
                            class="focus-ring w-44 rounded-lg border border-themed bg-transparent px-3 py-2 text-sm text-body"
                          />
                        </div>
                        <p class="text-xs text-muted">{{ t('settings.committedNow', { value: formatCurrency(b.committed, lang()) }) }}</p>
                      </div>
                    </div>
                  }
                }
              </div>
            }
            @case (4) {
              <div class="max-w-xl space-y-6">
                <div class="flex items-center justify-between gap-4 rounded-xl border border-themed p-4">
                  <div>
                    <p class="text-sm font-medium text-heading">{{ t('settings.darkMode') }}</p>
                    <p class="text-xs text-muted">{{ t('settings.darkModeHint') }}</p>
                  </div>
                  <app-switch-toggle [checked]="ui.darkMode()" (changed)="ui.setDarkMode($event)" />
                </div>

                <div class="rounded-xl border border-themed p-4">
                  <p class="text-sm font-medium text-heading">{{ t('settings.language') }}</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    @for (l of languages; track l.code) {
                      <button
                        type="button"
                        (click)="transloco.setActiveLang(l.code)"
                        [class]="
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ' +
                          (lang() === l.code
                            ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                            : 'border-themed text-body hover:bg-gray-50 dark:hover:bg-gray-800')
                        "
                      >
                        <span aria-hidden="true">{{ l.flag }}</span>
                        {{ l.label }}
                      </button>
                    }
                  </div>
                </div>

                <div class="rounded-xl border border-themed p-4">
                  <p class="text-sm font-medium text-heading">{{ t('settings.privacy') }}</p>
                  <p class="mt-1 text-xs text-muted">{{ t('settings.privacyHint') }}</p>
                  <button
                    type="button"
                    (click)="ui.openCookieBanner()"
                    class="mt-3 flex h-10 items-center gap-2 rounded-lg border border-themed px-4 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <app-icon name="cookie" [size]="16" />
                    {{ t('settings.reviewCookies') }}
                  </button>
                </div>

                <div class="rounded-xl border border-error-200 p-4 dark:border-error-500/30">
                  <p class="text-sm font-medium text-heading">{{ t('settings.resetTitle') }}</p>
                  <p class="mt-1 text-xs text-muted">{{ t('settings.resetHint') }}</p>
                  <button
                    type="button"
                    (click)="resetData()"
                    class="mt-3 flex h-10 items-center gap-2 rounded-lg border border-themed px-4 text-sm font-medium text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10"
                  >
                    <app-icon name="refresh-cw" [size]="16" />
                    {{ t('settings.reset') }}
                  </button>
                </div>
              </div>
            }
          }
        </app-tabs>
      </div>
    </ng-container>
  `,
})
export class SettingsPageComponent {
  protected auth = inject(AuthService);
  protected procure = inject(ProcureService);
  protected ui = inject(UiService);
  protected transloco = inject(TranslocoService);

  protected lang = activeLang();
  protected formatCurrency = formatCurrency;
  protected readonly Math = Math;
  protected readonly input = INPUT;
  protected readonly languages = LANGUAGES;

  protected tab = signal(0);
  protected name = signal(this.auth.user()?.name ?? '');
  protected email = signal(this.auth.user()?.email ?? '');
  protected role = signal(this.auth.user()?.role ?? '');

  constructor() {
    usePageTitle('settings.title');
  }

  protected readonly budgets = computed(() =>
    budgetStates(this.procure.costCenters(), this.procure.requests(), this.procure.orders(), this.procure.quotes(), this.procure.items())
  );

  protected tabItems(t: (key: string) => string): TabItem[] {
    return [
      { label: t('settings.tabProfile'), icon: 'user' },
      { label: t('settings.tabCompany'), icon: 'building' },
      { label: t('settings.tabLimits'), icon: 'shield-check' },
      { label: t('settings.tabCenters'), icon: 'chart' },
      { label: t('settings.tabAppearance'), icon: 'sliders' },
    ];
  }

  protected costCenterOf(id: number) {
    return costCenterById(this.procure.costCenters(), id);
  }

  protected saveProfile() {
    this.auth.updateProfile({ name: this.name(), email: this.email(), role: this.role() });
    this.ui.notifySuccess(this.transloco.translate('settings.saved'));
  }

  protected resetData() {
    this.procure.reset();
    this.ui.notifySuccess(this.transloco.translate('settings.resetDone'));
  }
}
