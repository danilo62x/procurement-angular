import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { AuthShellComponent } from '@app/components/layout/auth-shell.component';
import { AuthService } from '@app/core/services/auth.service';
import { UiService } from '@app/core/services/ui.service';
import { usePageTitle } from '@app/core/page-title';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslocoModule, IconComponent, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-auth-shell [title]="t('auth.registerTitle')" [subtitle]="t('auth.registerSubtitle')">
        <form (ngSubmit)="handleSubmit()" class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium text-heading">{{ t('auth.name') }}</label>
            <input required name="name" [ngModel]="name()" (ngModelChange)="name.set($event)" [class]="inputClass" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-heading">{{ t('auth.organization') }}</label>
            <input name="org" [ngModel]="org()" (ngModelChange)="org.set($event)" [class]="inputClass" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-heading">{{ t('auth.email') }}</label>
            <input required type="email" name="email" [ngModel]="email()" (ngModelChange)="email.set($event)" [class]="inputClass" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-heading">{{ t('auth.password') }}</label>
            <input
              required
              type="password"
              name="password"
              [ngModel]="password()"
              (ngModelChange)="password.set($event)"
              placeholder="••••••••"
              [class]="inputClass"
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              required
              name="accepted"
              [ngModel]="accepted()"
              (ngModelChange)="accepted.set($event)"
              class="h-4 w-4 rounded border-themed accent-brand-500"
            />
            {{ t('auth.terms') }}
          </label>
          <button
            type="submit"
            [disabled]="loading()"
            class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 focus-ring disabled:opacity-60"
          >
            @if (loading()) {
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
            } @else {
              <app-icon name="check" [size]="18" />
              {{ t('auth.registerCta') }}
            }
          </button>
        </form>

        <ng-container authFooter>
          {{ t('auth.hasAccount') }}
          <a routerLink="/login" class="font-medium text-brand-500 hover:text-brand-600">{{ t('auth.loginLink') }}</a>
        </ng-container>
      </app-auth-shell>
    </ng-container>
  `,
})
export class RegisterPageComponent {
  private auth = inject(AuthService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);
  private router = inject(Router);

  protected readonly inputClass =
    'h-11 w-full rounded-lg border border-themed bg-gray-50 px-3 text-sm text-body outline-none focus:border-brand-300 focus-ring dark:bg-gray-900';

  protected name = signal('');
  protected org = signal('');
  protected email = signal('');
  protected password = signal('');
  protected accepted = signal(false);
  protected loading = signal(false);

  constructor() {
    usePageTitle('auth.registerTitle');
  }

  protected async handleSubmit() {
    this.loading.set(true);
    const ok = await this.auth.register(this.name(), this.email(), this.password());
    this.loading.set(false);
    if (ok) {
      this.ui.notifySuccess(this.transloco.translate('auth.registerSuccess'));
      this.router.navigate(['/app']);
    }
  }
}
