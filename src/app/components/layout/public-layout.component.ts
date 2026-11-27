import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CookieBannerComponent } from '@app/components/ui/cookie-banner.component';
import { ToastStackComponent } from '@app/components/ui/toast-stack.component';
import { PublicFooterComponent } from './public-footer.component';
import { PublicNavbarComponent } from './public-navbar.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, PublicNavbarComponent, PublicFooterComponent, ToastStackComponent, CookieBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col overflow-x-hidden" style="background-color: var(--tx-body-bg)">
      <app-public-navbar />
      <main class="flex-1">
        <router-outlet />
      </main>
      <app-public-footer />
      <app-toast-stack />
      <app-cookie-banner />
    </div>
  `,
})
export class PublicLayoutComponent {}
