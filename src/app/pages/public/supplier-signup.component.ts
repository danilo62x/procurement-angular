import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import { SIGNUP_DOCS } from '@app/core/data/mock';
import { usePageTitle } from '@app/core/page-title';

const STEPS = ['data', 'categories', 'docs'] as const;

interface FormState {
  name: string;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  categories: number[];
  docs: string[];
  accepted: boolean;
}

const EMPTY: FormState = {
  name: '',
  cnpj: '',
  contactName: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  categories: [],
  docs: [],
  accepted: false,
};

@Component({
  selector: 'app-supplier-signup-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (done(); as doneName) {
        <div class="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-50 text-success-600 dark:bg-success-500/15">
            <app-icon name="check-circle" [size]="30" />
          </span>
          <h1 class="mt-6 text-title-sm font-bold text-heading">{{ t('signup.doneTitle') }}</h1>
          <p class="mt-3 text-base text-muted">{{ t('signup.doneDesc', { name: doneName }) }}</p>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <a
              routerLink="/oportunidades"
              class="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              {{ t('signup.seeOpportunities') }}
            </a>
            <button
              type="button"
              (click)="resetAll()"
              class="inline-flex h-11 items-center gap-2 rounded-lg border border-themed px-5 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {{ t('signup.another') }}
            </button>
          </div>
        </div>
      } @else {
        <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header class="text-center">
            <h1 class="text-title-sm font-bold text-heading">{{ t('signup.title') }}</h1>
            <p class="mt-3 text-base text-muted">{{ t('signup.subtitle') }}</p>
          </header>

          <ol class="mt-10 flex items-center gap-2">
            @for (s of steps; track s; let i = $index) {
              <li class="flex flex-1 items-center gap-2">
                <span
                  [class]="
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ' +
                    (i < step()
                      ? 'bg-success-500 text-white'
                      : i === step()
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')
                  "
                >
                  @if (i < step()) {
                    <app-icon name="check" [size]="15" [strokeWidth]="3" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <span [class]="'hidden text-xs font-medium sm:block ' + (i === step() ? 'text-heading' : 'text-muted')">
                  {{ t('signup.steps.' + s) }}
                </span>
                @if (i < steps.length - 1) {
                  <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
                }
              </li>
            }
          </ol>

          <div class="surface-card mt-8 rounded-2xl border p-6 md:p-8">
            @if (step() === 0) {
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-1.5 sm:col-span-2">
                  <label for="s-name" class="block text-sm font-medium text-heading">{{ t('signup.fields.name') }}</label>
                  <input
                    id="s-name"
                    name="s-name"
                    [ngModel]="form().name"
                    (ngModelChange)="set('name', $event)"
                    [class]="inputClass(errorKeys().name)"
                    [placeholder]="t('signup.fields.namePlaceholder')"
                  />
                  @if (touched() && errorKeys().name; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label for="s-cnpj" class="block text-sm font-medium text-heading">{{ t('signup.fields.cnpj') }}</label>
                  <input
                    id="s-cnpj"
                    name="s-cnpj"
                    [ngModel]="form().cnpj"
                    (ngModelChange)="set('cnpj', $event)"
                    [class]="inputClass(errorKeys().cnpj)"
                    placeholder="00.000.000/0000-00"
                  />
                  @if (touched() && errorKeys().cnpj; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label for="s-contact" class="block text-sm font-medium text-heading">{{ t('signup.fields.contactName') }}</label>
                  <input
                    id="s-contact"
                    name="s-contact"
                    [ngModel]="form().contactName"
                    (ngModelChange)="set('contactName', $event)"
                    [class]="inputClass(errorKeys().contactName)"
                  />
                  @if (touched() && errorKeys().contactName; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label for="s-email" class="block text-sm font-medium text-heading">{{ t('signup.fields.email') }}</label>
                  <input
                    id="s-email"
                    type="email"
                    name="s-email"
                    [ngModel]="form().email"
                    (ngModelChange)="set('email', $event)"
                    [class]="inputClass(errorKeys().email)"
                    placeholder="comercial@fornecedor.com.br"
                  />
                  @if (touched() && errorKeys().email; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label for="s-phone" class="block text-sm font-medium text-heading">{{ t('signup.fields.phone') }}</label>
                  <input
                    id="s-phone"
                    name="s-phone"
                    [ngModel]="form().phone"
                    (ngModelChange)="set('phone', $event)"
                    [class]="inputClass(errorKeys().phone)"
                    placeholder="(11) 0000-0000"
                  />
                  @if (touched() && errorKeys().phone; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label for="s-city" class="block text-sm font-medium text-heading">{{ t('signup.fields.city') }}</label>
                  <input
                    id="s-city"
                    name="s-city"
                    [ngModel]="form().city"
                    (ngModelChange)="set('city', $event)"
                    [class]="inputClass(errorKeys().city)"
                  />
                  @if (touched() && errorKeys().city; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label for="s-state" class="block text-sm font-medium text-heading">{{ t('signup.fields.state') }}</label>
                  <input
                    id="s-state"
                    name="s-state"
                    maxlength="2"
                    [ngModel]="form().state"
                    (ngModelChange)="set('state', $event.toUpperCase())"
                    [class]="inputClass(errorKeys().state)"
                    placeholder="SP"
                  />
                  @if (touched() && errorKeys().state; as key) {
                    <p class="text-xs text-error-500">{{ t(key) }}</p>
                  }
                </div>
              </div>
            }

            @if (step() === 1) {
              <div>
                <p class="text-sm text-muted">{{ t('signup.categoriesHint') }}</p>
                <div class="mt-5 grid gap-3 sm:grid-cols-2">
                  @for (c of procure.categories(); track c.id) {
                    <button
                      type="button"
                      (click)="toggleCategory(c.id)"
                      [class]="
                        'flex items-center gap-3 rounded-xl border p-4 text-left transition ' +
                        (isCategoryOn(c.id)
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                          : 'border-themed hover:bg-gray-50 dark:hover:bg-gray-800')
                      "
                    >
                      <span
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                        [style.background-color]="c.color"
                      >
                        <app-icon [name]="c.icon" [size]="18" />
                      </span>
                      <span class="min-w-0 flex-1 text-sm font-medium text-heading">{{ c.name }}</span>
                      @if (isCategoryOn(c.id)) {
                        <app-icon name="check-circle" [size]="18" class="text-brand-500" />
                      }
                    </button>
                  }
                </div>
                @if (touched() && errorKeys().categories; as key) {
                  <p class="mt-3 text-xs text-error-500">{{ t(key) }}</p>
                }
              </div>
            }

            @if (step() === 2) {
              <div>
                <p class="text-sm text-muted">{{ t('signup.docsHint') }}</p>
                <ul class="mt-5 space-y-3">
                  @for (doc of docs; track doc) {
                    <li>
                      <button
                        type="button"
                        (click)="toggleDoc(doc)"
                        [class]="
                          'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ' +
                          (isDocOn(doc)
                            ? 'border-success-500 bg-success-50 dark:bg-success-500/10'
                            : 'border-dashed border-themed hover:bg-gray-50 dark:hover:bg-gray-800')
                        "
                      >
                        <app-icon
                          [name]="isDocOn(doc) ? 'file-check' : 'upload'"
                          [size]="20"
                          [class]="isDocOn(doc) ? 'text-success-600' : 'text-muted'"
                        />
                        <span class="min-w-0 flex-1">
                          <span class="block text-sm font-medium text-heading">{{ t('docs.' + doc) }}</span>
                          <span class="block text-xs text-muted">
                            {{ isDocOn(doc) ? t('signup.docAttached') : t('signup.docAttach') }}
                          </span>
                        </span>
                      </button>
                    </li>
                  }
                </ul>
                @if (touched() && errorKeys().docs; as key) {
                  <p class="mt-3 text-xs text-error-500">{{ t(key) }}</p>
                }

                <label class="mt-6 flex items-start gap-3 text-sm text-body">
                  <input
                    type="checkbox"
                    [ngModel]="form().accepted"
                    (ngModelChange)="set('accepted', $event)"
                    class="mt-0.5 h-4 w-4 rounded border-themed accent-brand-500"
                  />
                  <span>
                    {{ t('signup.acceptPrefix') }}
                    <a routerLink="/politica" class="font-medium text-brand-500 hover:text-brand-600">{{ t('nav.policy') }}</a>
                  </span>
                </label>
                @if (touched() && errorKeys().accepted; as key) {
                  <p class="mt-2 text-xs text-error-500">{{ t(key) }}</p>
                }
              </div>
            }

            <div class="mt-8 flex items-center justify-between gap-3 border-t border-themed pt-6">
              <button
                type="button"
                [disabled]="step() === 0"
                (click)="prev()"
                class="rounded-lg border border-themed px-4 py-2.5 text-sm font-medium text-body transition hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
              >
                {{ t('signup.back') }}
              </button>

              @if (step() < steps.length - 1) {
                <button
                  type="button"
                  (click)="next()"
                  class="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  {{ t('signup.next') }}
                  <app-icon name="arrow-right" [size]="16" />
                </button>
              } @else {
                <button
                  type="button"
                  (click)="submit()"
                  class="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  <app-icon name="send" [size]="16" />
                  {{ t('signup.submit') }}
                </button>
              }
            </div>
          </div>
        </div>
      }
    </ng-container>
  `,
})
export class SupplierSignupPageComponent {
  protected procure = inject(ProcureService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);

  protected readonly steps = STEPS;
  protected readonly docs = SIGNUP_DOCS;

  protected step = signal(0);
  protected form = signal<FormState>(EMPTY);
  protected touched = signal(false);
  protected done = signal<string | null>(null);

  constructor() {
    usePageTitle('signup.title');
  }

  protected set<K extends keyof FormState>(key: K, value: FormState[K]) {
    this.form.update((prev) => ({ ...prev, [key]: value }));
  }

  /** Chaves de erro por campo — resolvidas para texto no template via `t()`. */
  protected readonly errorKeys = computed(() => {
    const step = this.step();
    const form = this.form();
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (step === 0) {
      if (!form.name.trim()) errs.name = 'signup.errors.required';
      if (form.cnpj.replace(/\D/g, '').length !== 14) errs.cnpj = 'signup.errors.cnpj';
      if (!form.contactName.trim()) errs.contactName = 'signup.errors.required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'signup.errors.email';
      if (!form.phone.trim()) errs.phone = 'signup.errors.required';
      if (!form.city.trim()) errs.city = 'signup.errors.required';
      if (form.state.trim().length !== 2) errs.state = 'signup.errors.state';
    }
    if (step === 1 && form.categories.length === 0) errs.categories = 'signup.errors.categories';
    if (step === 2) {
      if (form.docs.length < SIGNUP_DOCS.length) errs.docs = 'signup.errors.docs';
      if (!form.accepted) errs.accepted = 'signup.errors.accept';
    }
    return errs;
  });

  protected readonly invalid = computed(() => Object.keys(this.errorKeys()).length > 0);

  protected inputClass(bad?: string) {
    return `h-11 w-full rounded-lg border bg-transparent px-3.5 text-sm text-body placeholder:text-muted focus-ring ${
      this.touched() && bad ? 'border-error-500' : 'border-themed'
    }`;
  }

  protected isCategoryOn(id: number) {
    return this.form().categories.includes(id);
  }
  protected toggleCategory(id: number) {
    const cats = this.form().categories;
    this.set('categories', cats.includes(id) ? cats.filter((c) => c !== id) : [...cats, id]);
  }

  protected isDocOn(doc: string) {
    return this.form().docs.includes(doc);
  }
  protected toggleDoc(doc: string) {
    const docs = this.form().docs;
    this.set('docs', docs.includes(doc) ? docs.filter((d) => d !== doc) : [...docs, doc]);
  }

  protected next() {
    this.touched.set(true);
    if (this.invalid()) return;
    this.touched.set(false);
    this.step.update((s) => Math.min(STEPS.length - 1, s + 1));
  }

  protected prev() {
    this.touched.set(false);
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected submit() {
    this.touched.set(true);
    if (this.invalid()) return;
    const form = this.form();
    const supplier = this.procure.addSupplier({
      name: form.name.trim(),
      cnpj: form.cnpj.trim(),
      categories: form.categories,
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
    });
    if (!supplier) {
      this.ui.notifyError(this.transloco.translate('common.error'));
      return;
    }
    this.ui.notifySuccess(this.transloco.translate('signup.success'));
    this.done.set(supplier.name);
  }

  protected resetAll() {
    this.form.set(EMPTY);
    this.step.set(0);
    this.done.set(null);
  }
}
