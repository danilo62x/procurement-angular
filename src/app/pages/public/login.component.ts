import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { AuthShellComponent } from '@app/components/layout/auth-shell.component';
import { AuthService, DEMO_CREDENTIALS } from '@app/core/services/auth.service';
import { UiService } from '@app/core/services/ui.service';
import { usePageTitle } from '@app/core/page-title';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslocoModule, IconComponent, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-auth-shell [title]="t('auth.loginTitle')" [subtitle]="t('auth.loginSubtitle')">
        <form (ngSubmit)="handleSubmit()" class="space-y-5">
          <div>
            <label class="mb-2 block text-sm font-medium text-heading" for="email">{{ t('auth.email') }}</label>
            <div class="relative">
              <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">
                <app-icon name="mail" [size]="18" />
              </span>
              <input
                id="email"
                type="email"
                name="email"
                required
                [ngModel]="email()"
                (ngModelChange)="email.set($event)"
                [placeholder]="demo.email"
                class="focus-ring h-11 w-full rounded-lg border border-themed bg-gray-50 pr-3 pl-10 text-sm text-body outline-none focus:border-brand-300 dark:bg-gray-900"
              />
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-heading" for="password">{{ t('auth.password') }}</label>
            <div class="relative">
              <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">
                <app-icon name="lock" [size]="18" />
              </span>
              <input
                id="password"
                name="password"
                [type]="showPassword() ? 'text' : 'password'"
                required
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                placeholder="••••••••"
                class="focus-ring h-11 w-full rounded-lg border border-themed bg-gray-50 pr-10 pl-10 text-sm text-body outline-none focus:border-brand-300 dark:bg-gray-900"
              />
              <button
                type="button"
                class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                (click)="showPassword.set(!showPassword())"
              >
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="18" />
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between text-sm">
            <label class="flex items-center gap-2 text-body">
              <input
                type="checkbox"
                name="remember"
                [ngModel]="remember()"
                (ngModelChange)="remember.set($event)"
                class="h-4 w-4 rounded border-themed accent-brand-500"
              />
              {{ t('auth.remember') }}
            </label>
            <span class="font-medium text-brand-500">{{ t('auth.forgot') }}</span>
          </div>

          <button
            type="submit"
            [disabled]="loading()"
            class="focus-ring flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (loading()) {
              <span class="flex items-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                {{ t('auth.loggingIn') }}
              </span>
            } @else {
              {{ t('auth.loginCta') }}
            }
          </button>

          @if (error()) {
            <p class="rounded-lg bg-error-50 px-4 py-2 text-center text-sm text-error-600 dark:bg-error-500/15 dark:text-error-500">
              {{ error() }}
            </p>
          }
        </form>

        <div class="mt-6 rounded-lg border border-dashed border-themed bg-gray-50/60 p-3 text-xs text-muted dark:bg-gray-900/40">
          <p class="font-medium text-body">{{ t('auth.demoTitle') }}</p>
          <p>{{ demo.email }} / {{ demo.password }}</p>
          <p class="mt-0.5">{{ t('auth.demoHint') }}</p>
        </div>

        <ng-container authFooter>
          {{ t('auth.noAccount') }}
          <a routerLink="/registro" class="font-medium text-brand-500 hover:text-brand-600">{{ t('auth.registerCta') }}</a>
        </ng-container>
      </app-auth-shell>
    </ng-container>
  `,
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly demo = DEMO_CREDENTIALS;

  protected email = signal(DEMO_CREDENTIALS.email);
  protected password = signal(DEMO_CREDENTIALS.password);
  protected showPassword = signal(false);
  protected remember = signal(true);
  protected loading = signal(false);
  protected error = signal('');

  constructor() {
    usePageTitle('auth.loginTitle');
  }

  protected async handleSubmit() {
    this.error.set('');
    this.loading.set(true);
    const ok = await this.auth.login(this.email(), this.password());
    this.loading.set(false);
    if (!ok) {
      this.error.set(this.transloco.translate('auth.loginError'));
      return;
    }
    this.ui.notifySuccess(this.transloco.translate('auth.loginSuccess'));
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.router.navigateByUrl(redirect || '/app');
  }
}
