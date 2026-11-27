import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { CHANNEL, COMPANY, POLICY_FAQ } from '@app/core/data/mock';
import { usePageTitle } from '@app/core/page-title';

const RULES = ['competition', 'documents', 'confidential', 'deadline', 'payment', 'audit'] as const;
const RULE_ICONS: Record<string, string> = {
  competition: 'scale',
  documents: 'file-text',
  confidential: 'lock',
  deadline: 'clock',
  payment: 'banknote',
  audit: 'shield-check',
};
const CONFLICTS = ['relative', 'gift', 'partner', 'former'] as const;

@Component({
  selector: 'app-policy-page',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <section class="relative overflow-hidden bg-gradient-to-br from-gray-900 to-brand-900">
        <div class="absolute inset-0 opacity-40">
          <div class="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-brand-500/40 blur-3xl"></div>
        </div>
        <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 class="text-title-sm font-bold text-white sm:text-title-md">{{ t('policy.title') }}</h1>
          <p class="mt-3 max-w-2xl text-base text-white/80">{{ t('policy.subtitle') }}</p>
        </div>
      </section>

      <section class="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 class="text-title-sm font-bold text-heading">{{ t('policy.rulesTitle') }}</h2>
        <div class="mt-8 grid gap-5 md:grid-cols-2">
          @for (r of rules; track r) {
            <div class="surface-card rounded-2xl border p-5">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                <app-icon [name]="ruleIcon(r)" [size]="20" />
              </span>
              <h3 class="mt-4 text-sm font-semibold text-heading">{{ t('policy.rules.' + r + '.title') }}</h3>
              <p class="mt-2 text-sm text-muted">{{ t('policy.rules.' + r + '.desc') }}</p>
            </div>
          }
        </div>
      </section>

      <section class="border-y border-themed surface-card">
        <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div class="grid gap-8 md:grid-cols-2 md:items-start">
            <div>
              <h2 class="text-title-sm font-bold text-heading">{{ t('policy.conflictTitle') }}</h2>
              <p class="mt-3 text-sm text-muted">{{ t('policy.conflictDesc') }}</p>
              <ul class="mt-5 space-y-3">
                @for (k of conflicts; track k) {
                  <li class="flex gap-3 text-sm">
                    <app-icon name="alert-triangle" [size]="16" class="mt-0.5 shrink-0 text-warning-500" />
                    <span class="text-body">{{ t('policy.conflict.' + k) }}</span>
                  </li>
                }
              </ul>
            </div>

            <div class="rounded-2xl border border-themed bg-brand-50 p-6 dark:bg-brand-500/10">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white">
                <app-icon name="phone" [size]="20" />
              </span>
              <h2 class="mt-4 text-base font-semibold text-heading">{{ t('policy.channelTitle') }}</h2>
              <p class="mt-2 text-sm text-muted">{{ t('policy.channelDesc') }}</p>
              <dl class="mt-5 space-y-2 text-sm">
                <div class="flex items-center gap-2">
                  <app-icon name="mail" [size]="15" class="text-muted" />
                  <dd class="font-medium text-heading">{{ channel.email }}</dd>
                </div>
                <div class="flex items-center gap-2">
                  <app-icon name="phone" [size]="15" class="text-muted" />
                  <dd class="font-medium text-heading">{{ channel.phone }}</dd>
                </div>
              </dl>
              <p class="mt-4 text-xs text-muted">{{ t('policy.channelAnonymous') }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 class="text-title-sm font-bold text-heading">{{ t('policy.faqTitle') }}</h2>
        <ul class="mt-8 space-y-3">
          @for (q of faq; track q) {
            <li class="surface-card overflow-hidden rounded-xl border">
              <button
                type="button"
                (click)="toggleFaq(q)"
                [attr.aria-expanded]="open() === q"
                class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span class="text-sm font-medium text-heading">{{ t('policy.faq.' + q + '.q') }}</span>
                <app-icon [name]="open() === q ? 'chevron-up' : 'chevron-down'" [size]="16" class="shrink-0 text-muted" />
              </button>
              @if (open() === q) {
                <p class="border-t border-themed px-5 py-4 text-sm text-muted">{{ t('policy.faq.' + q + '.a') }}</p>
              }
            </li>
          }
        </ul>

        <div class="mt-10 rounded-2xl border border-themed p-6 text-center">
          <p class="text-sm text-muted">{{ t('policy.footerNote', { company: company.legalName }) }}</p>
          <a
            routerLink="/cadastro-fornecedor"
            class="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {{ t('policy.footerCta') }}
            <app-icon name="arrow-right" [size]="16" />
          </a>
        </div>
      </section>
    </ng-container>
  `,
})
export class PolicyPageComponent {
  protected readonly rules = RULES;
  protected readonly conflicts = CONFLICTS;
  protected readonly faq = POLICY_FAQ;
  protected readonly company = COMPANY;
  protected readonly channel = CHANNEL;

  protected open = signal<string | null>(POLICY_FAQ[0]);

  constructor() {
    usePageTitle('policy.title');
  }

  protected ruleIcon(r: string) {
    return RULE_ICONS[r];
  }

  protected toggleFaq(q: string) {
    this.open.set(this.open() === q ? null : q);
  }
}
