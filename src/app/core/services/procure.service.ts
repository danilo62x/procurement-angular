import { Injectable, effect, signal } from '@angular/core';
import {
  CATEGORIES,
  COMPANY,
  COST_CENTERS,
  CURRENT_MEMBER_ID,
  ITEMS,
  MEMBERS,
  ORDERS,
  QUOTES,
  REQUESTS,
  SUPPLIERS,
  type Company,
} from '../data/mock';
import {
  approvalState,
  comparisonMap,
  inviteBlock,
  orderProgress,
  quoteById,
  requestById,
  slugify,
  supplierById,
} from '../data/query';
import type {
  Bid,
  Category,
  CostCenter,
  Item,
  Member,
  MemberRole,
  Order,
  PurchaseRequest,
  Quote,
  RequestLine,
  Supplier,
} from '../data/types';

const STORAGE_KEY = 'pr-data';

const nextId = (rows: { id: number }[]) => (rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1);

/**
 * Resultado de uma ação que pode ser recusada. O motivo vem junto para a tela
 * montar a mensagem certa: alçada insuficiente, fornecedor suspenso e vencedor
 * sem justificativa são recusas diferentes.
 */
export type ProcureResult =
  | { ok: true; id?: number; slug?: string }
  | { ok: false; reason: 'notFound' }
  | { ok: false; reason: 'estado' }
  | { ok: false; reason: 'vazio' }
  | { ok: false; reason: 'alcada'; role: MemberRole | null }
  | { ok: false; reason: 'justificativa'; cheapestId: number | null }
  | { ok: false; reason: 'suspenso'; supplier: string }
  | { ok: false; reason: 'ja-convidado'; supplier: string }
  | { ok: false; reason: 'categoria'; supplier: string }
  | { ok: false; reason: 'semProposta' }
  | { ok: false; reason: 'quantidade'; itemId: number; pending: number; given: number };

export interface NewRequestInput {
  requesterId: number;
  costCenterId: number;
  neededBy: string;
  justification: string;
  lines: RequestLine[];
  /** Enviar direto para aprovação em vez de guardar em rascunho. */
  submit: boolean;
}

export interface NewQuoteInput {
  title: string;
  categoryId: number;
  requestIds: number[];
  supplierIds: number[];
  /** Dias de prazo para as propostas. */
  days: number;
}

export interface PublicBidInput {
  supplierId: number;
  leadDays: number;
  terms: string;
  prices: { itemId: number; unitPrice: number }[];
}

export interface NewSupplierInput {
  name: string;
  cnpj: string;
  categories: number[];
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
}

interface Snapshot {
  requests: PurchaseRequest[];
  quotes: Quote[];
  orders: Order[];
  suppliers: Supplier[];
  members: Member[];
  items: Item[];
  costCenters: CostCenter[];
  categories: Category[];
  company: Company;
  actingMemberId: number;
}

const seed = (): Snapshot => ({
  requests: REQUESTS.map((r) => ({
    ...r,
    lines: r.lines.map((l) => ({ ...l })),
    approvals: r.approvals.map((a) => ({ ...a })),
  })),
  quotes: QUOTES.map((q) => ({
    ...q,
    lines: q.lines.map((l) => ({ ...l })),
    supplierIds: [...q.supplierIds],
    requestIds: [...q.requestIds],
    bids: q.bids.map((b) => ({ ...b })),
  })),
  orders: ORDERS.map((o) => ({
    ...o,
    lines: o.lines.map((l) => ({ ...l })),
    receipts: o.receipts.map((r) => ({ ...r })),
  })),
  suppliers: SUPPLIERS.map((s) => ({
    ...s,
    categories: [...s.categories],
    contact: { ...s.contact },
    docs: s.docs.map((d) => ({ ...d })),
    seeds: [...s.seeds],
  })),
  members: MEMBERS.map((m) => ({ ...m })),
  items: ITEMS.map((i) => ({ ...i })),
  costCenters: COST_CENTERS.map((c) => ({ ...c })),
  categories: CATEGORIES.map((c) => ({ ...c })),
  company: { ...COMPANY },
  actingMemberId: CURRENT_MEMBER_ID,
});

function loadPersisted(): Snapshot {
  const fallback = seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: Partial<Snapshot> } & Partial<Snapshot>;
      const s = parsed.state ?? parsed;
      return { ...fallback, ...s };
    }
  } catch {}
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class ProcureService {
  private initial = loadPersisted();

  readonly requests = signal<PurchaseRequest[]>(this.initial.requests);
  readonly quotes = signal<Quote[]>(this.initial.quotes);
  readonly orders = signal<Order[]>(this.initial.orders);
  readonly suppliers = signal<Supplier[]>(this.initial.suppliers);
  readonly members = signal<Member[]>(this.initial.members);
  readonly items = signal<Item[]>(this.initial.items);
  readonly costCenters = signal<CostCenter[]>(this.initial.costCenters);
  readonly categories = signal<Category[]>(this.initial.categories);
  readonly company = signal<Company>(this.initial.company);
  /** De quem é a alçada em uso — a demonstração troca de aprovador aqui. */
  readonly actingMemberId = signal<number>(this.initial.actingMemberId);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            requests: this.requests(),
            quotes: this.quotes(),
            orders: this.orders(),
            suppliers: this.suppliers(),
            members: this.members(),
            items: this.items(),
            costCenters: this.costCenters(),
            categories: this.categories(),
            company: this.company(),
            actingMemberId: this.actingMemberId(),
          })
        );
      } catch {}
    });
  }

  // ---- Requisições ---------------------------------------------------------

  addRequest(data: NewRequestInput): PurchaseRequest {
    const list = this.requests();
    const id = nextId(list);
    const req: PurchaseRequest = {
      id,
      code: `RC-2026-${String(id).padStart(4, '0')}`,
      requesterId: data.requesterId,
      costCenterId: data.costCenterId,
      createdAt: new Date().toISOString(),
      neededBy: data.neededBy,
      justification: data.justification,
      lines: data.lines.map((l) => ({ ...l })),
      status: data.submit ? 'aguardando-aprovacao' : 'rascunho',
      approvals: [],
    };
    this.requests.set([req, ...list]);
    return req;
  }

  updateRequest(id: number, patch: Partial<PurchaseRequest>) {
    this.requests.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  removeRequest(id: number) {
    this.requests.update((list) => list.filter((r) => r.id !== id));
  }

  submitRequest(id: number): ProcureResult {
    const req = requestById(this.requests(), id);
    if (!req) return { ok: false, reason: 'notFound' };
    if (req.status !== 'rascunho') return { ok: false, reason: 'estado' };
    if (!req.lines.length) return { ok: false, reason: 'vazio' };
    this.updateRequest(id, { status: 'aguardando-aprovacao' });
    return { ok: true, id };
  }

  /**
   * Assina em nome de um membro. Só o nível da vez assina; se o teto dele
   * não cobre o valor, a requisição sobe para o próximo nível em vez de
   * ficar aprovada.
   */
  approveRequest(id: number, memberId: number, note: string): ProcureResult {
    const req = requestById(this.requests(), id);
    if (!req) return { ok: false, reason: 'notFound' };
    if (req.status !== 'aguardando-aprovacao') return { ok: false, reason: 'estado' };

    const member = this.members().find((m) => m.id === memberId);
    if (!member) return { ok: false, reason: 'notFound' };

    const before = approvalState(req, this.members(), this.items());
    if (before.nextRole !== member.role) {
      return { ok: false, reason: 'alcada', role: before.nextRole };
    }

    const approvals = [...req.approvals, { memberId, at: new Date().toISOString(), ok: true, note }];
    const after = approvalState({ ...req, approvals }, this.members(), this.items());
    const status: PurchaseRequest['status'] = after.done ? 'aprovada' : 'aguardando-aprovacao';
    this.requests.update((list) => list.map((r) => (r.id === id ? { ...r, approvals, status } : r)));
    return { ok: true, id };
  }

  rejectRequest(id: number, memberId: number, note: string): ProcureResult {
    const req = requestById(this.requests(), id);
    if (!req) return { ok: false, reason: 'notFound' };
    if (req.status !== 'aguardando-aprovacao') return { ok: false, reason: 'estado' };

    const member = this.members().find((m) => m.id === memberId);
    if (!member) return { ok: false, reason: 'notFound' };

    const before = approvalState(req, this.members(), this.items());
    if (before.nextRole !== member.role) {
      return { ok: false, reason: 'alcada', role: before.nextRole };
    }

    const approvals = [...req.approvals, { memberId, at: new Date().toISOString(), ok: false, note }];
    this.requests.update((list) =>
      list.map((r) => (r.id === id ? { ...r, approvals, status: 'recusada' } : r))
    );
    return { ok: true, id };
  }

  // ---- Cotações -------------------------------------------------------------

  openQuote(data: NewQuoteInput): ProcureResult {
    if (!data.requestIds.length) return { ok: false, reason: 'vazio' };

    const requests = data.requestIds
      .map((id) => requestById(this.requests(), id))
      .filter((r): r is PurchaseRequest => Boolean(r));
    if (!requests.length) return { ok: false, reason: 'notFound' };
    if (requests.some((r) => r.status !== 'aprovada')) return { ok: false, reason: 'estado' };

    const suspended = data.supplierIds
      .map((id) => supplierById(this.suppliers(), id))
      .find((s) => s?.status === 'suspenso');
    if (suspended) return { ok: false, reason: 'suspenso', supplier: suspended.name };

    const id = nextId(this.quotes());
    const now = new Date();
    const closes = new Date(now);
    closes.setDate(closes.getDate() + Math.max(1, data.days));

    // Uma linha por item, somando quantidades repetidas entre requisições.
    const merged = new Map<number, number>();
    requests.forEach((r) => r.lines.forEach((l) => merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.qty)));

    const quote: Quote = {
      id,
      code: `CT-2026-${String(id).padStart(4, '0')}`,
      slug: `${slugify(data.title) || 'cotacao'}-${id}`,
      title: data.title,
      categoryId: data.categoryId,
      requestIds: [...data.requestIds],
      lines: [...merged.entries()].map(([itemId, qty]) => ({ itemId, qty })),
      supplierIds: [...data.supplierIds],
      bids: [],
      openedAt: now.toISOString(),
      closesAt: closes.toISOString(),
      status: 'aberta',
      winnerId: null,
      winnerNote: '',
      publicCall: true,
    };

    this.quotes.set([quote, ...this.quotes()]);
    this.requests.update((list) =>
      list.map((r) => (data.requestIds.includes(r.id) ? { ...r, status: 'em-cotacao' } : r))
    );
    return { ok: true, id, slug: quote.slug };
  }

  inviteSupplier(quoteId: number, supplierId: number): ProcureResult {
    const quote = quoteById(this.quotes(), quoteId);
    const supplier = supplierById(this.suppliers(), supplierId);
    if (!quote || !supplier) return { ok: false, reason: 'notFound' };
    if (quote.status !== 'aberta') return { ok: false, reason: 'estado' };

    const block = inviteBlock(supplier, quote);
    if (block) return { ok: false, reason: block, supplier: supplier.name };

    this.quotes.update((list) =>
      list.map((q) => (q.id === quoteId ? { ...q, supplierIds: [...q.supplierIds, supplierId] } : q))
    );
    return { ok: true, id: quoteId };
  }

  uninviteSupplier(quoteId: number, supplierId: number) {
    this.quotes.update((list) =>
      list.map((q) =>
        q.id === quoteId
          ? {
              ...q,
              supplierIds: q.supplierIds.filter((id) => id !== supplierId),
              bids: q.bids.filter((b) => b.supplierId !== supplierId),
            }
          : q
      )
    );
  }

  /** Proposta pelo portal do fornecedor — entra na cotação e no mapa. */
  submitBid(quoteId: number, data: PublicBidInput): ProcureResult {
    const quote = quoteById(this.quotes(), quoteId);
    const supplier = supplierById(this.suppliers(), data.supplierId);
    if (!quote || !supplier) return { ok: false, reason: 'notFound' };
    if (quote.status !== 'aberta') return { ok: false, reason: 'estado' };
    if (supplier.status === 'suspenso') return { ok: false, reason: 'suspenso', supplier: supplier.name };

    const priced = data.prices.filter((p) => p.unitPrice > 0);
    if (!priced.length) return { ok: false, reason: 'vazio' };

    const at = new Date().toISOString();
    const fresh: Bid[] = priced.map((p) => ({
      supplierId: data.supplierId,
      itemId: p.itemId,
      unitPrice: Math.round(p.unitPrice * 100) / 100,
      leadDays: data.leadDays,
      terms: data.terms,
      at,
    }));

    this.quotes.update((list) =>
      list.map((q) =>
        q.id === quoteId
          ? {
              ...q,
              // Uma proposta nova substitui a anterior do mesmo fornecedor.
              bids: [...q.bids.filter((b) => b.supplierId !== data.supplierId), ...fresh],
              supplierIds: q.supplierIds.includes(data.supplierId)
                ? q.supplierIds
                : [...q.supplierIds, data.supplierId],
            }
          : q
      )
    );
    return { ok: true, id: quoteId };
  }

  /**
   * Escolher o vencedor. A justificativa só é cobrada quando o escolhido
   * não é o de menor total entre as propostas completas.
   */
  chooseWinner(quoteId: number, supplierId: number, note: string): ProcureResult {
    const quote = quoteById(this.quotes(), quoteId);
    if (!quote) return { ok: false, reason: 'notFound' };
    if (quote.status === 'cancelada') return { ok: false, reason: 'estado' };

    const map = comparisonMap(quote);
    const column = map.columns.find((c) => c.supplierId === supplierId);
    if (!column || column.covered === 0) return { ok: false, reason: 'semProposta' };

    const cheapest = map.cheapestSupplierId;
    const isCheapest = cheapest !== null && cheapest === supplierId;
    if (!isCheapest && !note.trim()) {
      return { ok: false, reason: 'justificativa', cheapestId: cheapest };
    }

    this.quotes.update((list) =>
      list.map((q) =>
        q.id === quoteId ? { ...q, winnerId: supplierId, winnerNote: note.trim(), status: 'encerrada' } : q
      )
    );
    return { ok: true, id: quoteId };
  }

  cancelQuote(quoteId: number): ProcureResult {
    const quote = quoteById(this.quotes(), quoteId);
    if (!quote) return { ok: false, reason: 'notFound' };
    this.quotes.update((list) => list.map((q) => (q.id === quoteId ? { ...q, status: 'cancelada' } : q)));
    this.requests.update((list) =>
      list.map((r) => (quote.requestIds.includes(r.id) && r.status === 'em-cotacao' ? { ...r, status: 'aprovada' } : r))
    );
    return { ok: true, id: quoteId };
  }

  // ---- Pedidos ---------------------------------------------------------------

  issueOrder(quoteId: number): ProcureResult {
    const quote = quoteById(this.quotes(), quoteId);
    if (!quote) return { ok: false, reason: 'notFound' };
    if (quote.winnerId === null) return { ok: false, reason: 'semProposta' };

    const winner = quote.winnerId;
    const lines = quote.lines
      .map((l) => {
        const bid = quote.bids.find((b) => b.supplierId === winner && b.itemId === l.itemId);
        return bid ? { itemId: l.itemId, qty: l.qty, unitPrice: bid.unitPrice } : null;
      })
      .filter((l): l is { itemId: number; qty: number; unitPrice: number } => l !== null);
    if (!lines.length) return { ok: false, reason: 'semProposta' };

    const lead = Math.max(...quote.bids.filter((b) => b.supplierId === winner).map((b) => b.leadDays));
    const id = nextId(this.orders());
    const issuedAt = new Date();
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + lead);

    const order: Order = {
      id,
      code: `PC-2026-${String(id).padStart(4, '0')}`,
      quoteId,
      supplierId: winner,
      lines,
      issuedAt: issuedAt.toISOString(),
      dueAt: dueAt.toISOString(),
      status: 'emitido',
      receipts: [],
      rating: null,
    };

    this.orders.set([order, ...this.orders()]);
    this.requests.update((list) =>
      list.map((r) => (quote.requestIds.includes(r.id) ? { ...r, status: 'atendida' } : r))
    );
    return { ok: true, id };
  }

  /** Recebimento parcial: soma nos `receipts` e recusa acima do saldo. */
  receiveOrder(orderId: number, entries: { itemId: number; qty: number }[]): ProcureResult {
    const order = this.orders().find((o) => o.id === orderId);
    if (!order) return { ok: false, reason: 'notFound' };
    if (order.status === 'cancelado') return { ok: false, reason: 'estado' };

    const wanted = entries.filter((e) => e.qty > 0);
    if (!wanted.length) return { ok: false, reason: 'vazio' };

    const progress = orderProgress(order);
    for (const e of wanted) {
      const row = progress.rows.find((r) => r.itemId === e.itemId);
      if (!row) return { ok: false, reason: 'notFound' };
      if (e.qty > row.pending) {
        return { ok: false, reason: 'quantidade', itemId: e.itemId, pending: row.pending, given: e.qty };
      }
    }

    const at = new Date().toISOString();
    const receipts = [...order.receipts, ...wanted.map((e) => ({ itemId: e.itemId, qty: e.qty, at }))];
    this.orders.update((list) => list.map((o) => (o.id === orderId ? { ...o, receipts } : o)));
    return { ok: true, id: orderId };
  }

  rateOrder(orderId: number, rating: number): ProcureResult {
    const order = this.orders().find((o) => o.id === orderId);
    if (!order) return { ok: false, reason: 'notFound' };
    if (!orderProgress(order).complete) return { ok: false, reason: 'estado' };
    const value = Math.min(5, Math.max(1, Math.round(rating)));
    this.orders.update((list) => list.map((o) => (o.id === orderId ? { ...o, rating: value } : o)));
    return { ok: true, id: orderId };
  }

  cancelOrder(orderId: number) {
    this.orders.update((list) => list.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' } : o)));
  }

  // ---- Fornecedores -----------------------------------------------------------

  addSupplier(data: NewSupplierInput): Supplier {
    const list = this.suppliers();
    const id = nextId(list);
    const slug = `${slugify(data.name) || 'fornecedor'}-${id}`;
    const supplier: Supplier = {
      id,
      slug,
      name: data.name,
      cnpj: data.cnpj,
      categories: [...data.categories],
      status: 'pendente',
      since: new Date().toISOString(),
      rating: null,
      contact: {
        name: data.contactName,
        email: data.email,
        phone: data.phone,
        city: data.city,
        state: data.state,
      },
      docs: [],
      seeds: [`${slug}-1`, `${slug}-2`, `${slug}-3`],
    };
    this.suppliers.set([supplier, ...list]);
    return supplier;
  }

  updateSupplier(id: number, patch: Partial<Supplier>) {
    this.suppliers.update((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  setSupplierStatus(id: number, status: Supplier['status']) {
    this.suppliers.update((list) => list.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  // ---- Configuração -------------------------------------------------------------

  updateCompany(patch: Partial<Company>) {
    this.company.update((c) => ({ ...c, ...patch }));
  }

  updateCostCenter(id: number, patch: Partial<CostCenter>) {
    this.costCenters.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  setMemberLimit(id: number, limit: number) {
    this.members.update((list) => list.map((m) => (m.id === id ? { ...m, limit: Math.max(0, limit) } : m)));
  }

  setActingMember(id: number) {
    this.actingMemberId.set(id);
  }

  reset() {
    const fresh = seed();
    this.requests.set(fresh.requests);
    this.quotes.set(fresh.quotes);
    this.orders.set(fresh.orders);
    this.suppliers.set(fresh.suppliers);
    this.members.set(fresh.members);
    this.items.set(fresh.items);
    this.costCenters.set(fresh.costCenters);
    this.categories.set(fresh.categories);
    this.company.set(fresh.company);
    this.actingMemberId.set(fresh.actingMemberId);
  }
}
