import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { CHANNEL, COMPANY } from '@app/core/data/mock';

const LINKS = [
  { to: '/', key: 'nav.home' },
  { to: '/oportunidades', key: 'nav.opportunities' },
  { to: '/cadastro-fornecedor', key: 'nav.signup' },
  { to: '/politica', key: 'nav.policy' },
  { to: '/login', key: 'nav.login' },
];

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="surface-card border-t border-themed" *transloco="let t">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="flex flex-col items-start justify-between gap-8 lg:flex-row">
          <div class="max-w-sm">
            <a routerLink="/" class="flex items-center gap-2.5">
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
                <app-icon name="package" [size]="18" />
              </span>
              <span class="text-lg font-bold text-heading">{{ t('brand') }}</span>
            </a>
            <p class="mt-4 text-sm text-muted">{{ t('landing.footer.tagline') }}</p>
            <p class="mt-4 text-xs text-muted">{{ company.legalName }} · CNPJ {{ company.cnpj }}</p>
          </div>
          <div class="flex flex-wrap gap-x-10 gap-y-2 text-sm">
            @for (l of links; track l.to) {
              <a [routerLink]="l.to" class="text-muted transition hover:text-brand-600">{{ t(l.key) }}</a>
            }
          </div>
          <div class="text-sm">
            <p class="font-semibold text-heading">{{ t('landing.footer.channel') }}</p>
            <p class="mt-2 text-muted">{{ channel.email }}</p>
            <p class="text-muted">{{ channel.phone }}</p>
          </div>
        </div>
        <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-themed pt-6 sm:flex-row">
          <p class="text-xs text-muted">© {{ year }} {{ t('brand') }}. {{ t('landing.footer.rights') }}</p>
          <div class="flex items-center gap-3">
            @for (icon of socials; track icon) {
              <span
                aria-hidden="true"
                class="flex h-9 w-9 items-center justify-center rounded-full border border-themed text-muted"
              >
                <app-icon [name]="icon" [size]="16" />
              </span>
            }
          </div>
        </div>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  protected readonly links = LINKS;
  protected readonly socials = ['globe', 'mail', 'phone'];
  protected readonly year = new Date().getFullYear();
  protected readonly company = COMPANY;
  protected readonly channel = CHANNEL;
}
