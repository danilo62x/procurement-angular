import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { HttpTranslocoLoader } from './core/transloco-loader';

const SUPPORTED_LANGS = ['pt-BR', 'en', 'es'];

// Idioma inicial: escolha guardada e, na primeira visita, o do navegador —
// equivalente ao i18next-browser-languagedetector da referência React.
const storedLang = (() => {
  try {
    const saved = localStorage.getItem('lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch {}
  try {
    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const raw of candidates) {
      if (!raw) continue;
      if (SUPPORTED_LANGS.includes(raw)) return raw;
      const base = raw.split('-')[0];
      if (base === 'pt') return 'pt-BR';
      if (SUPPORTED_LANGS.includes(base)) return base;
    }
  } catch {}
  return null;
})();

try {
  if (storedLang) localStorage.setItem('lang', storedLang);
} catch {}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })
    ),
    provideAnimations(),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['pt-BR', 'en', 'es'],
        defaultLang: storedLang ?? 'pt-BR',
        fallbackLang: 'pt-BR',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: HttpTranslocoLoader,
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
