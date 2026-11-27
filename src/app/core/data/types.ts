// Domínio de compras. Nada aqui guarda número derivado: valor da requisição,
// total por fornecedor no mapa comparativo, saldo a receber de um pedido,
// nota do fornecedor e comprometido do centro de custo são sempre calculados
// em `query.ts` a partir destes registros.

export type ReqStatus =
  | 'rascunho'
  | 'aguardando-aprovacao'
  | 'aprovada'
  | 'recusada'
  | 'em-cotacao'
  | 'atendida'

export type QuoteStatus = 'aberta' | 'encerrada' | 'cancelada'
export type OrderStatus = 'emitido' | 'parcial' | 'recebido' | 'atrasado' | 'cancelado'
export type SupplierStatus = 'pendente' | 'homologado' | 'suspenso'
export type MemberRole = 'solicitante' | 'comprador' | 'gerente' | 'diretor'

export interface Category {
  id: number
  slug: string
  name: string
  icon: string
  /** Cor de apoio do gráfico de gasto por categoria. */
  color: string
}

export interface CostCenter {
  id: number
  code: string
  name: string
  /** Orçamento do exercício, em reais. */
  budget: number
}

export interface Item {
  id: number
  sku: string
  name: string
  /** Chave da unidade — traduzida por `units.<unit>`. */
  unit: string
  categoryId: number
  /**
   * Preço de referência da última compra. Serve só para estimar o valor da
   * requisição (alçada e orçamento) enquanto ainda não há proposta.
   */
  refPrice: number
}

export interface RequestLine {
  itemId: number
  qty: number
  note: string
}

export interface Approval {
  memberId: number
  at: string
  ok: boolean
  note: string
}

export interface PurchaseRequest {
  id: number
  code: string
  requesterId: number
  costCenterId: number
  createdAt: string
  neededBy: string
  justification: string
  lines: RequestLine[]
  status: ReqStatus
  approvals: Approval[]
}

export interface QuoteLine {
  itemId: number
  qty: number
}

export interface Bid {
  supplierId: number
  itemId: number
  unitPrice: number
  /** Prazo de entrega em dias corridos. */
  leadDays: number
  /** Chave da condição de pagamento — traduzida por `terms.<terms>`. */
  terms: string
  at: string
}

export interface Quote {
  id: number
  code: string
  slug: string
  /** Objeto da cotação, como aparece no portal do fornecedor. */
  title: string
  categoryId: number
  requestIds: number[]
  lines: QuoteLine[]
  supplierIds: number[]
  bids: Bid[]
  openedAt: string
  closesAt: string
  status: QuoteStatus
  winnerId: number | null
  winnerNote: string
  /** Aberta ao mercado: aparece em `/oportunidades`. */
  publicCall: boolean
}

export interface OrderLine {
  itemId: number
  qty: number
  unitPrice: number
}

export interface Receipt {
  itemId: number
  qty: number
  at: string
}

export interface Order {
  id: number
  code: string
  quoteId: number
  supplierId: number
  lines: OrderLine[]
  issuedAt: string
  dueAt: string
  /**
   * Só `emitido` e `cancelado` são de fato guardados. `parcial`, `recebido` e
   * `atrasado` saem de `effectiveOrderStatus()` a partir dos recebimentos e
   * do `dueAt` — nunca são escritos aqui.
   */
  status: OrderStatus
  receipts: Receipt[]
  /** Avaliação de 1 a 5 do pedido recebido. Alimenta a nota do fornecedor. */
  rating: number | null
}

export interface SupplierDoc {
  /** Chave do documento — traduzida por `docs.<key>`. */
  key: string
  /** Validade do documento. */
  until: string
}

export interface Supplier {
  id: number
  slug: string
  name: string
  cnpj: string
  categories: number[]
  status: SupplierStatus
  since: string
  /**
   * Retrato da nota no momento em que os dados foram semeados. A tela sempre
   * mostra `supplierRating()` — as avaliações dos pedidos são a fonte da
   * verdade, e fornecedor sem pedido recebido não tem nota.
   */
  rating: number | null
  contact: SupplierContact
  docs: SupplierDoc[]
  /** Sementes de imagem — capa e galeria da ficha do fornecedor. */
  seeds: string[]
}

export interface SupplierContact {
  name: string
  email: string
  phone: string
  city: string
  state: string
}

export interface Member {
  id: number
  name: string
  avatar: string
  role: MemberRole
  /** Alçada: valor máximo que este membro aprova sozinho. */
  limit: number
  email: string
}

// ---- Resultados derivados ------------------------------------------------

/** Uma coluna do mapa comparativo: o que um fornecedor ofereceu na cotação. */
export interface SupplierColumn {
  supplierId: number
  /** Quantas linhas da cotação o fornecedor cotou. */
  covered: number
  /** Total das linhas cotadas — só comparável quando `complete`. */
  total: number
  /** Cotou todas as linhas. */
  complete: boolean
  /** Maior prazo entre as linhas cotadas, em dias. */
  leadDays: number
  /** Condição de pagamento predominante. */
  terms: string
  /** Ganharia por preço se a escolha fosse automática. */
  cheapest: boolean
}

/** Uma linha do mapa comparativo: um item e o que cada fornecedor pediu. */
export interface MatrixRow {
  itemId: number
  qty: number
  cells: Record<number, Bid | undefined>
  /** Id do fornecedor com o menor preço unitário nesta linha. */
  bestSupplierId: number | null
  bestUnitPrice: number | null
}

export interface ComparisonMap {
  rows: MatrixRow[]
  columns: SupplierColumn[]
  /** Menor total entre as propostas completas. */
  cheapestTotal: number | null
  /** Maior total entre as propostas completas — base da economia. */
  highestTotal: number | null
  cheapestSupplierId: number | null
  /** Total do vencedor escolhido, quando já há um. */
  chosenTotal: number | null
  /** Economia = maior total − total escolhido (ou − menor total, na prévia). */
  savings: number
}

/** Situação da alçada de uma requisição. */
export interface ApprovalState {
  /** Valor estimado pelo preço de referência dos itens. */
  value: number
  /** Níveis que precisam assinar, do menor para o maior. */
  requiredRoles: MemberRole[]
  /** Níveis que já assinaram. */
  approvedRoles: MemberRole[]
  /** Próximo nível que falta assinar. */
  nextRole: MemberRole | null
  /** Quem, nominalmente, pode assinar agora. */
  nextApprovers: Member[]
  /** Todos os níveis assinaram. */
  done: boolean
  rejected: boolean
  rejectedBy: Member | null
}

/** Saldo de recebimento de uma linha do pedido. */
export interface ReceiptRow {
  itemId: number
  ordered: number
  received: number
  pending: number
  unitPrice: number
}

export interface OrderProgress {
  rows: ReceiptRow[]
  ordered: number
  received: number
  /** 0 a 1. */
  ratio: number
  /** Todas as linhas fecharam a quantidade. */
  complete: boolean
  /** Dias até o prazo (negativo = passou). */
  daysLeft: number
  late: boolean
  total: number
}

/** Orçamento de um centro de custo contra o comprometido. */
export interface BudgetState {
  costCenterId: number
  budget: number
  /** Requisições aprovadas/em cotação ainda sem pedido. */
  requested: number
  /** Pedidos emitidos (não cancelados). */
  ordered: number
  committed: number
  available: number
  /** 0 a 1 (pode passar de 1). */
  ratio: number
  over: boolean
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface CategorySpend extends SeriesPoint {
  categoryId: number
  color: string
}
