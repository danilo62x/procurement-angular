import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { ProcureService } from '@app/core/services/procure.service';
import { HOW_STEPS, INTEGRITY_TOPICS, prImage } from '@app/core/data/mock';
import { avgPurchaseDays, daysUntil, publicOpportunities, savingsInWindow } from '@app/core/data/query';
import { formatCurrency, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { Quote } from '@app/core/data/types';

const STEP_ICONS: Record<string, string> = {
  cadastro: 'file-text',
  homologacao: 'shield-check',
  convite: 'mail',
  proposta: 'send',
};

const TOPIC_ICONS: Record<string, string> = {
  isonomia: 'scale',
  sigilo: 'lock',
  conflito: 'users',
  canal: 'phone',
};

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <!-- Hero -->
      <section class="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700">
        <div class="absolute inset-0 opacity-30">
          <div class="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/20 blur-3xl"></div>
          <div class="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-900/40 blur-3xl"></div>
        </div>

        <div class="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <div class="grid items-center gap-12 lg:grid-cols-2">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                <app-icon name="handshake" [size]="14" />
                {{ t('home.hero.badge') }}
              </span>
              <h1 class="mt-5 text-3xl leading-tight font-bold text-white sm:text-title-md lg:text-title-lg">
                {{ t('home.hero.title') }}
              </h1>
              <p class="mt-5 max-w-xl text-base text-white/85 sm:text-lg">{{ t('home.hero.subtitle') }}</p>

              <div class="mt-8 flex flex-wrap gap-3">
                <a
                  routerLink="/cadastro-fornecedor"
                  class="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
                >
                  <app-icon name="file-text" [size]="18" />
                  {{ t('home.hero.register') }}
                </a>
                <a
                  routerLink="/oportunidades"
                  class="inline-flex h-12 items-center gap-2 rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {{ t('home.hero.opportunities') }}
                  <app-icon name="arrow-right" [size]="18" />
                </a>
              </div>

              <div class="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/85">
                <span class="inline-flex items-center gap-2">
                  <app-icon name="check-circle" [size]="16" />
                  {{ t('home.hero.free') }}
                </span>
                <span class="inline-flex items-center gap-2">
                  <app-icon name="shield-check" [size]="16" />
                  {{ t('home.hero.integrity') }}
                </span>
              </div>
            </div>

            <div class="relative">
              <div class="overflow-hidden rounded-3xl border border-white/20 shadow-theme-xl">
                <img [src]="heroImage" alt="" class="h-72 w-full object-cover sm:h-96" loading="eager" />
              </div>
              <div class="surface-card absolute -bottom-6 left-4 right-4 rounded-2xl border p-4 shadow-theme-lg sm:left-8 sm:right-8">
                <p class="text-xs text-muted">{{ t('home.hero.openNow') }}</p>
                <p class="mt-1 text-2xl font-bold text-heading">
                  {{ t(pl('home.hero.openCount', stats().open.length), { count: stats().open.length }) }}
                </p>
                @if (stats().open[0]; as next) {
                  <p class="mt-1 truncate text-xs text-muted">
                    {{
                      t(pl('home.hero.nextClosing', closingDays(next)), {
                        title: next.title,
                        count: closingDays(next),
                      })
                    }}
                  </p>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Números -->
      <section class="mx-auto max-w-7xl px-4 pt-20 pb-6 sm:px-6 lg:px-8">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (n of numbers(t); track n.key) {
            <div class="surface-card rounded-2xl border p-5">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                <app-icon [name]="n.icon" [size]="20" />
              </span>
              <p class="mt-4 text-2xl font-bold break-words text-heading">{{ n.value }}</p>
              <p class="mt-1 text-sm text-muted">{{ t('home.numbers.' + n.key) }}</p>
            </div>
          }
        </div>
      </section>

      <!-- Como fornecer -->
      <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div class="max-w-2xl">
          <h2 class="text-title-sm font-bold text-heading">{{ t('home.how.title') }}</h2>
          <p class="mt-3 text-base text-muted">{{ t('home.how.subtitle') }}</p>
        </div>

        <ol class="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          @for (step of steps; track step; let i = $index) {
            <li class="surface-card relative rounded-2xl border p-6">
              <span class="absolute top-6 right-6 text-3xl font-bold text-gray-100 dark:text-gray-800">
                {{ i + 1 }}
              </span>
              <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                <app-icon [name]="stepIcon(step)" [size]="22" />
              </span>
              <h3 class="mt-5 text-base font-semibold text-heading">{{ t('home.how.' + step + '.title') }}</h3>
              <p class="mt-2 text-sm text-muted">{{ t('home.how.' + step + '.desc') }}</p>
            </li>
          }
        </ol>
      </section>

      <!-- Categorias -->
      <section class="border-y border-themed surface-card">
        <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div class="max-w-2xl">
              <h2 class="text-title-sm font-bold text-heading">{{ t('home.categories.title') }}</h2>
              <p class="mt-3 text-base text-muted">{{ t('home.categories.subtitle') }}</p>
            </div>
            <a
              routerLink="/oportunidades"
              class="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-themed px-5 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {{ t('home.categories.cta') }}
              <app-icon name="arrow-right" [size]="16" />
            </a>
          </div>

          <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            @for (c of procure.categories(); track c.id) {
              <div class="rounded-2xl border border-themed p-5">
                <span
                  class="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  [style.background-color]="c.color"
                >
                  <app-icon [name]="c.icon" [size]="20" />
                </span>
                <h3 class="mt-4 text-sm font-semibold text-heading">{{ c.name }}</h3>
                <p class="mt-1 text-xs text-muted">
                  {{ t(pl('home.categories.count', categoryCount(c.id)), { count: categoryCount(c.id) }) }}
                </p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Integridade -->
      <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div class="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 class="text-title-sm font-bold text-heading">{{ t('home.integrity.title') }}</h2>
            <p class="mt-3 text-base text-muted">{{ t('home.integrity.subtitle') }}</p>

            <ul class="mt-8 space-y-5">
              @for (topic of topics; track topic) {
                <li class="flex gap-4">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15">
                    <app-icon [name]="topicIcon(topic)" [size]="18" />
                  </span>
                  <div>
                    <h3 class="text-sm font-semibold text-heading">{{ t('home.integrity.' + topic + '.title') }}</h3>
                    <p class="mt-1 text-sm text-muted">{{ t('home.integrity.' + topic + '.desc') }}</p>
                  </div>
                </li>
              }
            </ul>

            <a
              routerLink="/politica"
              class="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              {{ t('home.integrity.cta') }}
              <app-icon name="arrow-right" [size]="16" />
            </a>
          </div>

          <div class="overflow-hidden rounded-3xl border border-themed">
            <img [src]="integrityImage" alt="" loading="lazy" class="h-80 w-full object-cover" />
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-center sm:px-12">
          <div class="absolute inset-0 opacity-25">
            <div class="absolute -top-20 left-1/3 h-72 w-72 rounded-full bg-white/30 blur-3xl"></div>
          </div>
          <div class="relative">
            <h2 class="text-title-sm font-bold text-white">{{ t('home.cta.title') }}</h2>
            <p class="mx-auto mt-3 max-w-2xl text-base text-white/85">{{ t('home.cta.subtitle') }}</p>
            <div class="mt-8 flex flex-wrap justify-center gap-3">
              <a
                routerLink="/cadastro-fornecedor"
                class="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                {{ t('home.cta.register') }}
              </a>
              <a
                routerLink="/oportunidades"
                class="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {{ t('home.cta.browse') }}
              </a>
            </div>
          </div>
        </div>
      </section>
    </ng-container>
  `,
})
export class HomePageComponent {
  protected procure = inject(ProcureService);
  protected lang = activeLang();
  protected pl = usePlural();

  protected readonly steps = HOW_STEPS;
  protected readonly topics = INTEGRITY_TOPICS;
  protected readonly heroImage = prImage('hero-sede', 960, 640);
  protected readonly integrityImage = prImage('integridade-cidade', 960, 720);

  constructor() {
    usePageTitle();
  }

  // Uma âncora de "agora" para toda a página: o prazo de resposta de cada
  // cartão e o contador de oportunidades caem no mesmo instante.
  protected readonly stats = computed(() => {
    const quotes = this.procure.quotes();
    const suppliers = this.procure.suppliers();
    const orders = this.procure.orders();
    const requests = this.procure.requests();
    const items = this.procure.items();
    const now = new Date();
    return {
      open: publicOpportunities(quotes, now),
      homologated: suppliers.filter((s) => s.status === 'homologado').length,
      savings: savingsInWindow(quotes, 180, now),
      cycle: avgPurchaseDays(orders, quotes, requests),
      itemCount: items.length,
    };
  });

  protected numbers(t: (key: string, params?: Record<string, unknown>) => string) {
    const s = this.stats();
    const lang = this.lang();
    return [
      { key: 'suppliers', value: formatNumber(s.homologated, lang), icon: 'handshake' },
      { key: 'items', value: formatNumber(s.itemCount, lang), icon: 'package' },
      { key: 'savings', value: formatCurrency(s.savings, lang), icon: 'trending-down' },
      { key: 'cycle', value: t(this.pl('home.numbers.days', s.cycle), { count: s.cycle }), icon: 'clock' },
    ];
  }

  protected closingDays(quote: Quote) {
    return Math.max(0, daysUntil(quote.closesAt));
  }

  protected categoryCount(categoryId: number) {
    return this.procure
      .suppliers()
      .filter((s) => s.categories.includes(categoryId) && s.status === 'homologado').length;
  }

  protected stepIcon(step: string) {
    return STEP_ICONS[step];
  }
  protected topicIcon(topic: string) {
    return TOPIC_ICONS[topic];
  }
}
