import { Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Signal com o idioma ativo, reemitido a cada troca — e também quando o JSON do
 * idioma termina de carregar, porque antes disso `translate()` devolveria a
 * própria chave. Usado por tudo que formata número, moeda e data e por tudo que
 * resolve texto fora do template.
 * Chamar de dentro de um contexto de injeção (campo de classe / construtor).
 */
export function activeLang(): Signal<string> {
  const transloco = inject(TranslocoService);
  // `equal: () => false`: mesmo quando o idioma não muda, o fim do carregamento
  // precisa disparar o recálculo de quem depende deste sinal.
  const lang = signal(transloco.getActiveLang(), { equal: () => false });

  transloco.langChanges$.pipe(takeUntilDestroyed()).subscribe((l) => lang.set(l));
  transloco.events$.pipe(takeUntilDestroyed()).subscribe((e) => {
    if (e.type === 'translationLoadSuccess') lang.set(transloco.getActiveLang());
  });

  return lang;
}
