import type {
  ApprovalState,
  Bid,
  BudgetState,
  Category,
  CategorySpend,
  ComparisonMap,
  CostCenter,
  Item,
  MatrixRow,
  Member,
  MemberRole,
  Order,
  OrderProgress,
  OrderStatus,
  PurchaseRequest,
  Quote,
  ReceiptRow,
  SeriesPoint,
  Supplier,
  SupplierColumn,
} from './types'

/** Todo o conjunto de compras, como as telas recebem da store. */
export interface Dataset {
  requests: PurchaseRequest[]
  quotes: Quote[]
  orders: Order[]
  suppliers: Supplier[]
  members: Member[]
  items: Item[]
  costCenters: CostCenter[]
  categories: Category[]
}

/** Quem assina, do menor para o maior. `solicitante` nunca aprova. */
export const APPROVAL_LADDER: MemberRole[] = ['comprador', 'gerente', 'diretor']

// ---- Lookups -------------------------------------------------------------

export function itemById(list: Item[], id: number): Item | undefined {
  return list.find((i) => i.id === id)
}

export function memberById(list: Member[], id: number | null): Member | undefined {
  if (id === null) return undefined
  return list.find((m) => m.id === id)
}

export function supplierById(list: Supplier[], id: number | null): Supplier | undefined {
  if (id === null) return undefined
  return list.find((s) => s.id === id)
}

export function supplierBySlug(list: Supplier[], slug: string): Supplier | undefined {
  return list.find((s) => s.slug === slug || String(s.id) === slug)
}

export function costCenterById(list: CostCenter[], id: number): CostCenter | undefined {
  return list.find((c) => c.id === id)
}

export function categoryById(list: Category[], id: number): Category | undefined {
  return list.find((c) => c.id === id)
}

export function requestById(list: PurchaseRequest[], id: number): PurchaseRequest | undefined {
  return list.find((r) => r.id === id)
}

export function quoteById(list: Quote[], id: number): Quote | undefined {
  return list.find((q) => q.id === id)
}

export function quoteBySlug(list: Quote[], slug: string): Quote | undefined {
  return list.find((q) => q.slug === slug || String(q.id) === slug)
}

export function orderById(list: Order[], id: number): Order | undefined {
  return list.find((o) => o.id === id)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ---- Datas ---------------------------------------------------------------

/**
 * Dias inteiros entre hoje e a data dada — negativo quando já passou. O
 * "agora" entra por parâmetro para a tela resolver a âncora uma única vez e
 * não deixar dois números da mesma linha caírem em dias diferentes.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function daysSince(iso: string, now: Date = new Date()): number {
  return -daysUntil(iso, now)
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

// ---- Alçada de aprovação -------------------------------------------------

/**
 * Níveis que precisam assinar uma requisição deste valor. Sobe um degrau a
 * cada vez que o teto do nível não cobre o valor — é a regra de alçada.
 */
export function requiredRoles(value: number, members: Member[]): MemberRole[] {
  const out: MemberRole[] = []
  for (const role of APPROVAL_LADDER) {
    out.push(role)
    const cap = Math.max(0, ...members.filter((m) => m.role === role).map((m) => m.limit))
    if (cap >= value) break
  }
  return out
}

/** Valor estimado da requisição pelo preço de referência dos itens. */
export function requestValue(req: PurchaseRequest, items: Item[]): number {
  return req.lines.reduce((sum, l) => sum + (itemById(items, l.itemId)?.refPrice ?? 0) * l.qty, 0)
}

/** Situação completa da alçada — quem assinou, quem falta e por quê. */
export function approvalState(req: PurchaseRequest, members: Member[], items: Item[]): ApprovalState {
  const value = requestValue(req, items)
  const roles = requiredRoles(value, members)

  const rejection = req.approvals.find((a) => !a.ok)
  const approvedRoles: MemberRole[] = []
  for (const a of req.approvals) {
    if (!a.ok) continue
    const role = memberById(members, a.memberId)?.role
    if (role && roles.includes(role) && !approvedRoles.includes(role)) approvedRoles.push(role)
  }

  const nextRole = roles.find((r) => !approvedRoles.includes(r)) ?? null
  const nextApprovers = nextRole ? members.filter((m) => m.role === nextRole) : []

  return {
    value,
    requiredRoles: roles,
    approvedRoles,
    nextRole,
    nextApprovers,
    done: nextRole === null && !rejection,
    rejected: Boolean(rejection),
    rejectedBy: rejection ? (memberById(members, rejection.memberId) ?? null) : null,
  }
}

/**
 * O membro pode assinar agora? Só o nível da vez assina, e um aprovador cujo
 * teto não cobre o valor assina o próprio degrau — a requisição então sobe.
 */
export function canApprove(member: Member, state: ApprovalState): boolean {
  return !state.rejected && state.nextRole === member.role
}

// ---- Mapa comparativo ----------------------------------------------------

function bidOf(bids: Bid[], supplierId: number, itemId: number): Bid | undefined {
  return bids.find((b) => b.supplierId === supplierId && b.itemId === itemId)
}

/**
 * A matriz item x fornecedor da cotação. Junta os convidados com quem mandou
 * proposta pelo portal público, marca o menor preço de cada linha e só compara
 * totais entre propostas que cobriram todas as linhas.
 */
export function comparisonMap(quote: Quote): ComparisonMap {
  const supplierIds = [...new Set([...quote.supplierIds, ...quote.bids.map((b) => b.supplierId)])]

  const rows: MatrixRow[] = quote.lines.map((line) => {
    const cells: Record<number, Bid | undefined> = {}
    let bestSupplierId: number | null = null
    let bestUnitPrice: number | null = null

    supplierIds.forEach((sid) => {
      const bid = bidOf(quote.bids, sid, line.itemId)
      cells[sid] = bid
      if (bid && (bestUnitPrice === null || bid.unitPrice < bestUnitPrice)) {
        bestUnitPrice = bid.unitPrice
        bestSupplierId = sid
      }
    })

    return { itemId: line.itemId, qty: line.qty, cells, bestSupplierId, bestUnitPrice }
  })

  const columns: SupplierColumn[] = supplierIds.map((sid) => {
    const mine = quote.bids.filter((b) => b.supplierId === sid)
    const covered = quote.lines.filter((l) => mine.some((b) => b.itemId === l.itemId)).length
    const total = quote.lines.reduce((sum, l) => {
      const bid = bidOf(mine, sid, l.itemId)
      return bid ? sum + bid.unitPrice * l.qty : sum
    }, 0)
    const leadDays = mine.length ? Math.max(...mine.map((b) => b.leadDays)) : 0
    return {
      supplierId: sid,
      covered,
      total: Math.round(total * 100) / 100,
      complete: covered === quote.lines.length && quote.lines.length > 0,
      leadDays,
      terms: mine[0]?.terms ?? '',
      cheapest: false,
    }
  })

  const completes = columns.filter((c) => c.complete)
  const cheapestTotal = completes.length ? Math.min(...completes.map((c) => c.total)) : null
  const highestTotal = completes.length ? Math.max(...completes.map((c) => c.total)) : null
  const cheapestSupplierId = completes.find((c) => c.total === cheapestTotal)?.supplierId ?? null
  columns.forEach((c) => {
    c.cheapest = c.complete && c.supplierId === cheapestSupplierId
  })

  const chosen = quote.winnerId !== null ? columns.find((c) => c.supplierId === quote.winnerId) : undefined
  const chosenTotal = chosen ? chosen.total : null
  const baseline = chosenTotal ?? cheapestTotal
  const savings = highestTotal !== null && baseline !== null ? Math.max(0, highestTotal - baseline) : 0

  return { rows, columns, cheapestTotal, highestTotal, cheapestSupplierId, chosenTotal, savings }
}

/** Quantos fornecedores já responderam a cotação. */
export function respondedCount(quote: Quote): number {
  return new Set(quote.bids.map((b) => b.supplierId)).size
}

/** Um fornecedor suspenso não entra em cotação nova. */
export type InviteBlock = 'suspenso' | 'ja-convidado' | 'categoria' | null

export function inviteBlock(supplier: Supplier, quote: Quote): InviteBlock {
  if (supplier.status === 'suspenso') return 'suspenso'
  if (quote.supplierIds.includes(supplier.id)) return 'ja-convidado'
  if (!supplier.categories.includes(quote.categoryId)) return 'categoria'
  return null
}

// ---- Pedidos e recebimento ----------------------------------------------

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
}

/** Soma os recebimentos por item e devolve o saldo em aberto de cada linha. */
export function orderProgress(order: Order, now: Date = new Date()): OrderProgress {
  const rows: ReceiptRow[] = order.lines.map((l) => {
    const received = order.receipts.filter((r) => r.itemId === l.itemId).reduce((s, r) => s + r.qty, 0)
    return {
      itemId: l.itemId,
      ordered: l.qty,
      received: Math.min(received, l.qty),
      pending: Math.max(0, l.qty - received),
      unitPrice: l.unitPrice,
    }
  })

  const ordered = rows.reduce((s, r) => s + r.ordered, 0)
  const received = rows.reduce((s, r) => s + r.received, 0)
  const complete = rows.length > 0 && rows.every((r) => r.pending === 0)
  const daysLeft = daysUntil(order.dueAt, now)

  return {
    rows,
    ordered,
    received,
    ratio: ordered > 0 ? received / ordered : 0,
    complete,
    daysLeft,
    late: !complete && daysLeft < 0 && order.status !== 'cancelado',
    total: orderTotal(order),
  }
}

/**
 * A situação real do pedido. `parcial`, `recebido` e `atrasado` nunca são
 * gravados: saem dos recebimentos e do prazo.
 */
export function effectiveOrderStatus(order: Order, now: Date = new Date()): OrderStatus {
  if (order.status === 'cancelado') return 'cancelado'
  const p = orderProgress(order, now)
  if (p.complete) return 'recebido'
  if (p.daysLeft < 0) return 'atrasado'
  return p.received > 0 ? 'parcial' : 'emitido'
}

export function lateOrders(orders: Order[], now: Date = new Date()): Order[] {
  return orders
    .filter((o) => effectiveOrderStatus(o, now) === 'atrasado')
    .sort((a, b) => daysUntil(a.dueAt, now) - daysUntil(b.dueAt, now))
}

// ---- Fornecedor ----------------------------------------------------------

/** Nota do fornecedor: média das avaliações dos pedidos recebidos. */
export function supplierRating(supplierId: number, orders: Order[], now: Date = new Date()): number | null {
  const rated = orders.filter(
    (o) => o.supplierId === supplierId && o.rating !== null && effectiveOrderStatus(o, now) === 'recebido'
  )
  if (!rated.length) return null
  const sum = rated.reduce((s, o) => s + (o.rating ?? 0), 0)
  return Math.round((sum / rated.length) * 10) / 10
}

export function supplierRatedCount(supplierId: number, orders: Order[], now: Date = new Date()): number {
  return orders.filter(
    (o) => o.supplierId === supplierId && o.rating !== null && effectiveOrderStatus(o, now) === 'recebido'
  ).length
}

/** Quanto já foi comprado deste fornecedor (pedidos não cancelados). */
export function supplierVolume(supplierId: number, orders: Order[]): number {
  return orders
    .filter((o) => o.supplierId === supplierId && o.status !== 'cancelado')
    .reduce((s, o) => s + orderTotal(o), 0)
}

/** Documentos vencidos do cadastro. */
export function expiredDocs(supplier: Supplier, now: Date = new Date()): string[] {
  return supplier.docs.filter((d) => daysUntil(d.until, now) < 0).map((d) => d.key)
}

// ---- Orçamento do centro de custo ---------------------------------------

/** A qual centro de custo um pedido pertence, pela cotação e requisição. */
export function orderCostCenter(order: Order, quotes: Quote[], requests: PurchaseRequest[]): number | null {
  const quote = quoteById(quotes, order.quoteId)
  if (!quote) return null
  const req = quote.requestIds.map((id) => requestById(requests, id)).find(Boolean)
  return req ? req.costCenterId : null
}

/**
 * Comprometido do centro de custo: requisições aprovadas ou em cotação (que
 * ainda não viraram pedido) mais os pedidos emitidos. Uma requisição atendida
 * já está representada pelo pedido — por isso não entra duas vezes.
 */
export function budgetState(
  costCenter: CostCenter,
  requests: PurchaseRequest[],
  orders: Order[],
  quotes: Quote[],
  items: Item[]
): BudgetState {
  const requested = requests
    .filter(
      (r) => r.costCenterId === costCenter.id && (r.status === 'aprovada' || r.status === 'em-cotacao')
    )
    .reduce((s, r) => s + requestValue(r, items), 0)

  const ordered = orders
    .filter((o) => o.status !== 'cancelado' && orderCostCenter(o, quotes, requests) === costCenter.id)
    .reduce((s, o) => s + orderTotal(o), 0)

  const committed = requested + ordered
  const ratio = costCenter.budget > 0 ? committed / costCenter.budget : 0

  return {
    costCenterId: costCenter.id,
    budget: costCenter.budget,
    requested,
    ordered,
    committed,
    available: costCenter.budget - committed,
    ratio,
    over: committed > costCenter.budget,
  }
}

export function budgetStates(
  costCenters: CostCenter[],
  requests: PurchaseRequest[],
  orders: Order[],
  quotes: Quote[],
  items: Item[]
): BudgetState[] {
  return costCenters.map((c) => budgetState(c, requests, orders, quotes, items))
}

// ---- Indicadores ---------------------------------------------------------

export function openRequests(requests: PurchaseRequest[]): PurchaseRequest[] {
  return requests.filter((r) => r.status === 'aguardando-aprovacao' || r.status === 'aprovada')
}

export function awaitingApproval(requests: PurchaseRequest[]): PurchaseRequest[] {
  return requests.filter((r) => r.status === 'aguardando-aprovacao')
}

export function openQuotes(quotes: Quote[]): Quote[] {
  return quotes.filter((q) => q.status === 'aberta')
}

/** Cotações abertas ao mercado e ainda dentro do prazo — o portal público. */
export function publicOpportunities(quotes: Quote[], now: Date = new Date()): Quote[] {
  return quotes
    .filter((q) => q.publicCall && q.status === 'aberta' && daysUntil(q.closesAt, now) >= 0)
    .sort((a, b) => daysUntil(a.closesAt, now) - daysUntil(b.closesAt, now))
}

/** Economia das cotações encerradas dentro da janela (em dias). */
export function savingsInWindow(quotes: Quote[], days: number, now: Date = new Date()): number {
  const from = addDays(now, -days).getTime()
  return quotes
    .filter((q) => q.status === 'encerrada' && new Date(q.closesAt).getTime() >= from)
    .reduce((s, q) => s + comparisonMap(q).savings, 0)
}

/** Prazo médio de compra: da abertura da requisição à emissão do pedido. */
export function avgPurchaseDays(orders: Order[], quotes: Quote[], requests: PurchaseRequest[]): number {
  // Uma compra fecha quando sai o PRIMEIRO pedido da cotação. As remessas
  // seguintes são entrega contra o mesmo pedido de compra e inflariam o prazo.
  const first = new Map<number, string>()
  orders.forEach((o) => {
    if (o.status === 'cancelado') return
    const current = first.get(o.quoteId)
    if (!current || new Date(o.issuedAt) < new Date(current)) first.set(o.quoteId, o.issuedAt)
  })

  const spans: number[] = []
  first.forEach((issuedAt, quoteId) => {
    const quote = quoteById(quotes, quoteId)
    if (!quote) return
    const req = quote.requestIds.map((id) => requestById(requests, id)).find(Boolean)
    if (!req) return
    const span = daysUntil(issuedAt, new Date(req.createdAt))
    if (span >= 0) spans.push(span)
  })
  if (!spans.length) return 0
  return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length)
}

/** Gasto por categoria dos pedidos emitidos (não cancelados). */
export function spendByCategory(orders: Order[], items: Item[], categories: Category[]): CategorySpend[] {
  const totals = new Map<number, number>()
  orders.forEach((o) => {
    if (o.status === 'cancelado') return
    o.lines.forEach((l) => {
      const cat = itemById(items, l.itemId)?.categoryId
      if (!cat) return
      totals.set(cat, (totals.get(cat) ?? 0) + l.qty * l.unitPrice)
    })
  })
  return categories
    .map((c) => ({
      categoryId: c.id,
      label: c.name,
      color: c.color,
      value: Math.round((totals.get(c.id) ?? 0) * 100) / 100,
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
}

/** Gasto mês a mês dos últimos `months` meses, pela data de emissão. */
export function spendByMonth(orders: Order[], months = 6, now: Date = new Date()): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const value = orders
      .filter((o) => o.status !== 'cancelado')
      .filter((o) => {
        const at = new Date(o.issuedAt).getTime()
        return at >= from.getTime() && at <= to.getTime()
      })
      .reduce((s, o) => s + orderTotal(o), 0)
    out.push({ label: from.toISOString().slice(0, 7), value: Math.round(value * 100) / 100 })
  }
  return out
}

/** Itens de uma requisição com nome, unidade e valor de referência resolvidos. */
export interface ResolvedLine {
  itemId: number
  item: Item | undefined
  qty: number
  note: string
  refPrice: number
  total: number
}

export function resolveLines(
  lines: { itemId: number; qty: number; note?: string }[],
  items: Item[]
): ResolvedLine[] {
  return lines.map((l) => {
    const item = itemById(items, l.itemId)
    const refPrice = item?.refPrice ?? 0
    return { itemId: l.itemId, item, qty: l.qty, note: l.note ?? '', refPrice, total: refPrice * l.qty }
  })
}
