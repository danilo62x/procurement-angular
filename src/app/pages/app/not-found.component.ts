import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { usePageTitle } from '@app/core/page-title';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style="background-color: var(--tx-body-bg)"
      *transloco="let t"
    >
      <span class="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
        <app-icon name="package" [size]="36" />
      </span>
      <p class="mt-8 text-title-md font-bold text-heading">404</p>
      <h1 class="mt-2 text-xl font-semibold text-heading">{{ t('notFound.title') }}</h1>
      <p class="mt-3 max-w-md text-sm text-muted">{{ t('notFound.desc') }}</p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a
          routerLink="/"
          class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <app-icon name="globe" [size]="16" />
          {{ t('notFound.home') }}
        </a>
        <a
          routerLink="/app"
          class="flex h-11 items-center gap-2 rounded-lg border border-themed px-5 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <app-icon name="dashboard" [size]="16" />
          {{ t('notFound.dashboard') }}
        </a>
      </div>
    </div>
  `,
})
export class NotFoundPageComponent {
  constructor() {
    usePageTitle('notFound.title');
  }
}
