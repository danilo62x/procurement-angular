import { Injectable, effect, signal } from '@angular/core';
import type { RequestLine } from '../data/types';

const STORAGE_KEY = 'pr-cart';

interface Persisted {
  lines: RequestLine[];
  costCenterId: number;
  neededBy: string;
  justification: string;
}

function defaultNeededBy(): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
}

function load(): Persisted {
  const fallback: Persisted = { lines: [], costCenterId: 1, neededBy: defaultNeededBy(), justification: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: Partial<Persisted> } & Partial<Persisted>;
      const s = parsed.state ?? parsed;
      return { ...fallback, ...s };
    }
  } catch {}
  return fallback;
}

/**
 * A requisição em digitação. Fica persistida para o comprador montar a lista
 * em várias sessões antes de enviar para aprovação.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private initial = load();

  readonly lines = signal<RequestLine[]>(this.initial.lines);
  readonly costCenterId = signal<number>(this.initial.costCenterId);
  readonly neededBy = signal<string>(this.initial.neededBy);
  readonly justification = signal<string>(this.initial.justification);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lines: this.lines(),
            costCenterId: this.costCenterId(),
            neededBy: this.neededBy(),
            justification: this.justification(),
          })
        );
      } catch {}
    });
  }

  add(itemId: number, qty = 1) {
    const lines = this.lines();
    const found = lines.find((l) => l.itemId === itemId);
    if (found) {
      this.lines.set(lines.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + qty } : l)));
      return;
    }
    this.lines.set([...lines, { itemId, qty, note: '' }]);
  }

  setQty(itemId: number, qty: number) {
    if (qty <= 0) {
      this.remove(itemId);
      return;
    }
    this.lines.update((list) => list.map((l) => (l.itemId === itemId ? { ...l, qty } : l)));
  }

  setNote(itemId: number, note: string) {
    this.lines.update((list) => list.map((l) => (l.itemId === itemId ? { ...l, note } : l)));
  }

  remove(itemId: number) {
    this.lines.update((list) => list.filter((l) => l.itemId !== itemId));
  }

  clear() {
    this.lines.set([]);
    this.justification.set('');
    this.neededBy.set(defaultNeededBy());
  }

  setCostCenter(id: number) {
    this.costCenterId.set(id);
  }

  setNeededBy(iso: string) {
    this.neededBy.set(iso);
  }

  setJustification(text: string) {
    this.justification.set(text);
  }

  count(): number {
    return this.lines().length;
  }

  qtyOf(itemId: number): number {
    return this.lines().find((l) => l.itemId === itemId)?.qty ?? 0;
  }
}
