import type {
  Bid,
  Category,
  CostCenter,
  Item,
  Member,
  Order,
  PurchaseRequest,
  Quote,
  Receipt,
  Supplier,
} from './types'
import { requiredRoles } from './query'

// Conjuntos Unsplash curados (IDs já verificados no monorepo).
const IMG: Record<string, string[]> = {
  work: [
    '1497366216548-37526070297c',
    '1497366811353-6870744d04b2',
    '1542744173-8e7e53415bb0',
    '1568992687947-868a62a9f521',
    '1521737711867-e3b97375f902',
    '1504384308090-c894fdcc538d',
    '1560264280-88b68371db39',
    '1486312338219-ce68d2c6f44d',
    '1521791136064-7986c2920216',
    '1560472354-b33ff0c44a43',
    '1516321318423-f06f85e504b3',
    '1600880292203-757bb62b4baf',
  ],
  city: ['1477959858617-67f85cf4f1df', '1496568816309-51d7c20e3b21', '1480714378408-67cf0d13bc1b'],
  people: [
    '1500648767791-00dcc994a43e',
    '1494790108377-be9c29b29330',
    '1507003211169-0a1dd7228f2d',
    '1438761681033-6461ffad8d80',
    '1633332755192-727a05c4013d',
    '1573496359142-b8d87734a5a2',
  ],
}

function imgHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function imgCategory(seed: string): string {
  const s = seed.toLowerCase()
  if (/avatar|people|person|profile|staff|team|membro|equipe|depoimento|contato/.test(s)) return 'people'
  if (/city|cidade|hero|galpao|patio|fachada|sede/.test(s)) return 'city'
  return 'work'
}

function unsplash(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=70&auto=format`
}

/** URL determinística por semente — capas de fornecedor e avatares da equipe. */
export function prImage(seed: string, w = 960, h = 640): string {
  const ids = IMG[imgCategory(seed)]
  return unsplash(ids[imgHash('pr-' + seed) % ids.length], w, h)
}

const av = (seed: string) => unsplash(IMG.people[imgHash('pr-av-' + seed) % IMG.people.length], 160, 160)

// As datas são relativas ao dia de hoje — assim o prazo de resposta da cotação
// e o atraso do pedido continuam fazendo sentido em qualquer demonstração.
function daysAgo(days: number, hour = 9): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  d.setDate(d.getDate() - Math.round(days))
  return d.toISOString()
}

function daysAhead(days: number, hour = 9): string {
  return daysAgo(-days, hour)
}

/** PRNG determinístico — os dados são sempre os mesmos entre recargas. */
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20260821)
const money = (v: number) => Math.round(v * 100) / 100

// ---- Empresa -------------------------------------------------------------

export interface Company {
  name: string
  legalName: string
  cnpj: string
  email: string
  phone: string
  address: string
  /** Prazo padrão de resposta das cotações, em dias. */
  quoteDays: number
  /** Mínimo de propostas para encerrar uma cotação. */
  minBids: number
}

export const COMPANY: Company = {
  name: 'Suprir',
  legalName: 'Suprir Indústria e Comércio S.A.',
  cnpj: '18.402.775/0001-64',
  email: 'compras@suprir.com',
  phone: '(11) 4003-2210',
  address: 'Av. Eng. Luís Carlos Berrini, 1420 — São Paulo, SP',
  quoteDays: 7,
  minBids: 3,
}

// ---- Categorias ----------------------------------------------------------

export const CATEGORIES: Category[] = [
  { id: 1, slug: 'informatica', name: 'Informática e TI', icon: 'cpu', color: '#465fff' },
  { id: 2, slug: 'escritorio', name: 'Material de escritório', icon: 'clipboard', color: '#12b76a' },
  { id: 3, slug: 'epi', name: 'EPI e segurança', icon: 'shield-check', color: '#f79009' },
  { id: 4, slug: 'predial', name: 'Manutenção predial', icon: 'wrench', color: '#f04438' },
  { id: 5, slug: 'limpeza', name: 'Higiene e limpeza', icon: 'droplet', color: '#0ba5ec' },
  { id: 6, slug: 'mobiliario', name: 'Mobiliário', icon: 'armchair', color: '#7592ff' },
  { id: 7, slug: 'servicos', name: 'Serviços terceirizados', icon: 'briefcase', color: '#039855' },
  { id: 8, slug: 'logistica', name: 'Logística e embalagem', icon: 'box', color: '#dc6803' },
]

// ---- Centros de custo ----------------------------------------------------

export const COST_CENTERS: CostCenter[] = [
  { id: 1, code: 'CC-100', name: 'Administrativo', budget: 480000 },
  { id: 2, code: 'CC-200', name: 'Operações', budget: 1250000 },
  { id: 3, code: 'CC-300', name: 'Tecnologia', budget: 890000 },
  { id: 4, code: 'CC-400', name: 'Comercial', budget: 360000 },
  { id: 5, code: 'CC-500', name: 'Manutenção', budget: 540000 },
  { id: 6, code: 'CC-600', name: 'Qualidade', budget: 220000 },
]

// ---- Equipe e alçadas ----------------------------------------------------

export const MEMBERS: Member[] = [
  {
    id: 1,
    name: 'Helena Prado',
    avatar: av('helena'),
    role: 'comprador',
    limit: 15000,
    email: 'compras@suprir.com',
  },
  {
    id: 2,
    name: 'Rafael Nogueira',
    avatar: av('rafael'),
    role: 'comprador',
    limit: 15000,
    email: 'rafael.nogueira@suprir.com',
  },
  {
    id: 3,
    name: 'Marina Tavares',
    avatar: av('marina'),
    role: 'comprador',
    limit: 15000,
    email: 'marina.tavares@suprir.com',
  },
  {
    id: 4,
    name: 'Sérgio Bastos',
    avatar: av('sergio'),
    role: 'gerente',
    limit: 80000,
    email: 'sergio.bastos@suprir.com',
  },
  {
    id: 5,
    name: 'Cláudia Meireles',
    avatar: av('claudia'),
    role: 'gerente',
    limit: 80000,
    email: 'claudia.meireles@suprir.com',
  },
  {
    id: 6,
    name: 'Otávio Lins',
    avatar: av('otavio'),
    role: 'diretor',
    limit: 500000,
    email: 'otavio.lins@suprir.com',
  },
  {
    id: 7,
    name: 'Bianca Correia',
    avatar: av('bianca'),
    role: 'solicitante',
    limit: 0,
    email: 'bianca.correia@suprir.com',
  },
  {
    id: 8,
    name: 'Diego Fontes',
    avatar: av('diego'),
    role: 'solicitante',
    limit: 0,
    email: 'diego.fontes@suprir.com',
  },
  {
    id: 9,
    name: 'Paula Rezende',
    avatar: av('paula'),
    role: 'solicitante',
    limit: 0,
    email: 'paula.rezende@suprir.com',
  },
  {
    id: 10,
    name: 'Ricardo Amaral',
    avatar: av('ricardo'),
    role: 'solicitante',
    limit: 0,
    email: 'ricardo.amaral@suprir.com',
  },
]

/** Quem está logado na demonstração — a compradora Helena Prado. */
export const CURRENT_MEMBER_ID = 1

// ---- Catálogo ------------------------------------------------------------

export const ITEMS: Item[] = [
  { id: 1, sku: 'TI-0101', name: 'Notebook 14 pol. i5 16 GB', unit: 'un', categoryId: 1, refPrice: 4890 },
  { id: 2, sku: 'TI-0102', name: 'Monitor 24 pol. Full HD', unit: 'un', categoryId: 1, refPrice: 1180 },
  { id: 3, sku: 'TI-0103', name: 'Teclado ABNT2 com fio', unit: 'un', categoryId: 1, refPrice: 145 },
  { id: 4, sku: 'TI-0104', name: 'Mouse óptico USB', unit: 'un', categoryId: 1, refPrice: 89 },
  { id: 5, sku: 'TI-0105', name: 'Headset com microfone', unit: 'un', categoryId: 1, refPrice: 320 },
  { id: 6, sku: 'TI-0106', name: 'Switch gerenciável 24 portas', unit: 'un', categoryId: 1, refPrice: 2450 },
  { id: 7, sku: 'TI-0107', name: 'Cabo de rede Cat6 — caixa 305 m', unit: 'cx', categoryId: 1, refPrice: 890 },
  { id: 8, sku: 'TI-0108', name: 'SSD SATA 480 GB', unit: 'un', categoryId: 1, refPrice: 385 },

  { id: 9, sku: 'ES-0201', name: 'Papel sulfite A4 75 g', unit: 'resma', categoryId: 2, refPrice: 28.9 },
  { id: 10, sku: 'ES-0202', name: 'Caneta esferográfica azul — caixa 50', unit: 'cx', categoryId: 2, refPrice: 62 },
  { id: 11, sku: 'ES-0203', name: 'Grampeador de mesa 26/6', unit: 'un', categoryId: 2, refPrice: 47 },
  { id: 12, sku: 'ES-0204', name: 'Pasta suspensa kraft — caixa 25', unit: 'cx', categoryId: 2, refPrice: 98 },
  { id: 13, sku: 'ES-0205', name: 'Bloco autoadesivo 76 x 102 mm', unit: 'pct', categoryId: 2, refPrice: 19.5 },
  { id: 14, sku: 'ES-0206', name: 'Toner laser preto 3.000 páginas', unit: 'un', categoryId: 2, refPrice: 410 },

  { id: 15, sku: 'EP-0301', name: 'Capacete de segurança classe B', unit: 'un', categoryId: 3, refPrice: 42 },
  { id: 16, sku: 'EP-0302', name: 'Luva nitrílica antiderrapante', unit: 'par', categoryId: 3, refPrice: 8.9 },
  { id: 17, sku: 'EP-0303', name: 'Óculos de proteção incolor', unit: 'un', categoryId: 3, refPrice: 18.5 },
  { id: 18, sku: 'EP-0304', name: 'Protetor auricular tipo plug', unit: 'par', categoryId: 3, refPrice: 6.4 },
  { id: 19, sku: 'EP-0305', name: 'Bota de segurança bico composto', unit: 'par', categoryId: 3, refPrice: 139 },
  { id: 20, sku: 'EP-0306', name: 'Colete refletivo', unit: 'un', categoryId: 3, refPrice: 34 },

  { id: 21, sku: 'MP-0401', name: 'Lâmpada LED bulbo 18 W', unit: 'un', categoryId: 4, refPrice: 22.9 },
  { id: 22, sku: 'MP-0402', name: 'Tinta acrílica fosca 18 L', unit: 'lata', categoryId: 4, refPrice: 289 },
  { id: 23, sku: 'MP-0403', name: 'Disjuntor bipolar 32 A', unit: 'un', categoryId: 4, refPrice: 46 },
  { id: 24, sku: 'MP-0404', name: 'Fita isolante 19 mm x 20 m', unit: 'rolo', categoryId: 4, refPrice: 9.9 },
  { id: 25, sku: 'MP-0405', name: 'Filtro de ar-condicionado split', unit: 'un', categoryId: 4, refPrice: 118 },

  { id: 26, sku: 'HL-0501', name: 'Detergente neutro 5 L', unit: 'galao', categoryId: 5, refPrice: 38 },
  { id: 27, sku: 'HL-0502', name: 'Papel toalha interfolhado', unit: 'fardo', categoryId: 5, refPrice: 74 },
  { id: 28, sku: 'HL-0503', name: 'Álcool 70% 1 L', unit: 'un', categoryId: 5, refPrice: 12.9 },
  { id: 29, sku: 'HL-0504', name: 'Saco de lixo 100 L — pacote 100', unit: 'pct', categoryId: 5, refPrice: 58 },
  { id: 30, sku: 'HL-0505', name: 'Desinfetante concentrado 5 L', unit: 'galao', categoryId: 5, refPrice: 44 },

  { id: 31, sku: 'MB-0601', name: 'Cadeira ergonômica giratória', unit: 'un', categoryId: 6, refPrice: 1290 },
  { id: 32, sku: 'MB-0602', name: 'Mesa de trabalho 1,40 m', unit: 'un', categoryId: 6, refPrice: 890 },
  { id: 33, sku: 'MB-0603', name: 'Armário de aço 2 portas', unit: 'un', categoryId: 6, refPrice: 1150 },
  { id: 34, sku: 'MB-0604', name: 'Gaveteiro volante 3 gavetas', unit: 'un', categoryId: 6, refPrice: 640 },

  { id: 35, sku: 'SV-0701', name: 'Manutenção preventiva de split', unit: 'visita', categoryId: 7, refPrice: 380 },
  { id: 36, sku: 'SV-0702', name: 'Dedetização de área administrativa', unit: 'servico', categoryId: 7, refPrice: 2400 },
  { id: 37, sku: 'SV-0703', name: 'Calibração de instrumento de medição', unit: 'un', categoryId: 7, refPrice: 260 },
  { id: 38, sku: 'SV-0704', name: 'Treinamento NR-35 — trabalho em altura', unit: 'turma', categoryId: 7, refPrice: 3800 },

  { id: 39, sku: 'LG-0801', name: 'Caixa de papelão 40 x 30 x 30 cm', unit: 'un', categoryId: 8, refPrice: 4.6 },
  { id: 40, sku: 'LG-0802', name: 'Filme stretch 500 mm', unit: 'bobina', categoryId: 8, refPrice: 78 },
  { id: 41, sku: 'LG-0803', name: 'Pallet PBR 1,00 x 1,20 m', unit: 'un', categoryId: 8, refPrice: 96 },
  { id: 42, sku: 'LG-0804', name: 'Fita de empacotamento 48 mm', unit: 'rolo', categoryId: 8, refPrice: 7.4 },
]

const itemPrice = (id: number) => ITEMS.find((i) => i.id === id)?.refPrice ?? 0

// ---- Fornecedores --------------------------------------------------------

interface SupplierSeed {
  id: number
  slug: string
  name: string
  cnpj: string
  cats: number[]
  status: Supplier['status']
  sinceDays: number
  contact: [string, string, string, string]
  /** Validade dos três documentos; valor negativo = documento vencido. */
  docsUntil: [number, number, number]
}

const SUPPLIER_SEEDS: SupplierSeed[] = [
  { id: 1, slug: 'alfa-suprimentos', name: 'Alfa Suprimentos Corporativos', cnpj: '11.234.567/0001-08', cats: [1, 2, 5, 8], status: 'homologado', sinceDays: 1490, contact: ['Tiago Vasques', 'comercial@alfasuprimentos.com.br', '(11) 3255-4180', 'São Paulo'], docsUntil: [210, 320, 140] },
  { id: 2, slug: 'tecnosul-informatica', name: 'TecnoSul Informática', cnpj: '09.877.451/0001-32', cats: [1], status: 'homologado', sinceDays: 1120, contact: ['Aline Duarte', 'vendas@tecnosul.com.br', '(51) 3019-7744', 'Porto Alegre'], docsUntil: [400, 260, 190] },
  { id: 3, slug: 'prime-office', name: 'Prime Office Distribuidora', cnpj: '14.556.902/0001-77', cats: [2, 6], status: 'homologado', sinceDays: 980, contact: ['Rogério Salles', 'atendimento@primeoffice.com.br', '(11) 4141-2200', 'Barueri'], docsUntil: [150, 300, 240] },
  { id: 4, slug: 'guardiao-epi', name: 'Guardião EPI Indústria', cnpj: '07.331.208/0001-45', cats: [3], status: 'homologado', sinceDays: 1660, contact: ['Fernanda Küster', 'contato@guardiaoepi.com.br', '(47) 3322-9010', 'Joinville'], docsUntil: [280, 175, 360] },
  { id: 5, slug: 'nortelimp', name: 'NorteLimp Higiene Profissional', cnpj: '21.008.664/0001-19', cats: [5], status: 'homologado', sinceDays: 720, contact: ['Marcos Vinícius Lima', 'comercial@nortelimp.com.br', '(85) 3211-6640', 'Fortaleza'], docsUntil: [95, 220, 310] },
  { id: 6, slug: 'vertice-mobiliario', name: 'Vértice Mobiliário Corporativo', cnpj: '18.774.310/0001-52', cats: [6], status: 'homologado', sinceDays: 1310, contact: ['Sandra Bertoldo', 'projetos@verticemob.com.br', '(41) 3077-1188', 'Curitiba'], docsUntil: [340, 130, 205] },
  { id: 7, slug: 'delta-servicos', name: 'Delta Serviços Prediais', cnpj: '05.912.487/0001-90', cats: [4, 7], status: 'homologado', sinceDays: 1840, contact: ['Everton Pacheco', 'contratos@deltapredial.com.br', '(11) 2909-3355', 'Guarulhos'], docsUntil: [120, 265, 90] },
  { id: 8, slug: 'embalar-log', name: 'Embalar Log Embalagens', cnpj: '23.660.119/0001-27', cats: [8], status: 'homologado', sinceDays: 640, contact: ['Juliana Aquino', 'vendas@embalarlog.com.br', '(19) 3444-7720', 'Campinas'], docsUntil: [190, 330, 155] },
  { id: 9, slug: 'cedro-comercial', name: 'Cedro Comercial de Materiais', cnpj: '12.845.703/0001-61', cats: [1, 2, 4], status: 'homologado', sinceDays: 2050, contact: ['Paulo Sérgio Brandão', 'compras@cedrocomercial.com.br', '(31) 3288-4400', 'Belo Horizonte'], docsUntil: [270, 145, 380] },
  { id: 10, slug: 'infoparts', name: 'InfoParts Distribuidora', cnpj: '16.402.988/0001-14', cats: [1], status: 'homologado', sinceDays: 880, contact: ['Karina Estevão', 'corporativo@infoparts.com.br', '(11) 5090-8811', 'São Paulo'], docsUntil: [225, 410, 168] },
  { id: 11, slug: 'rocha-engenharia', name: 'Rocha Engenharia de Manutenção', cnpj: '08.117.554/0001-36', cats: [4, 7], status: 'homologado', sinceDays: 1550, contact: ['Anderson Rocha', 'obras@rochaeng.com.br', '(21) 3877-2020', 'Rio de Janeiro'], docsUntil: [310, 200, 125] },
  { id: 12, slug: 'safework', name: 'SafeWork Equipamentos', cnpj: '25.309.771/0001-83', cats: [3], status: 'homologado', sinceDays: 520, contact: ['Letícia Sanches', 'vendas@safeworkepi.com.br', '(48) 3255-9977', 'Florianópolis'], docsUntil: [175, 288, 340] },
  { id: 13, slug: 'global-papeis', name: 'Global Papéis e Descartáveis', cnpj: '19.223.640/0001-05', cats: [2, 5], status: 'homologado', sinceDays: 1210, contact: ['Wagner Toledo', 'atendimento@globalpapeis.com.br', '(11) 2166-3030', 'São Paulo'], docsUntil: [255, 110, 295] },
  { id: 14, slug: 'aurora-mobiliario', name: 'Aurora Mobiliário', cnpj: '31.556.208/0001-70', cats: [6], status: 'pendente', sinceDays: 48, contact: ['Renata Bittencourt', 'comercial@auroramob.com.br', '(54) 3444-1212', 'Caxias do Sul'], docsUntil: [400, 365, 300] },
  { id: 15, slug: 'br-tech-solucoes', name: 'BR Tech Soluções', cnpj: '29.884.117/0001-49', cats: [1, 7], status: 'pendente', sinceDays: 32, contact: ['Igor Meneghetti', 'comercial@brtechsol.com.br', '(11) 3030-5566', 'São Paulo'], docsUntil: [380, 290, 410] },
  { id: 16, slug: 'sigma-quimica', name: 'Sigma Química Industrial', cnpj: '27.446.902/0001-58', cats: [5], status: 'pendente', sinceDays: 61, contact: ['Débora Nakagawa', 'vendas@sigmaquimica.ind.br', '(11) 4788-2100', 'São Bernardo do Campo'], docsUntil: [340, 250, 320] },
  { id: 17, slug: 'maxima-embalagens', name: 'Máxima Embalagens', cnpj: '33.017.288/0001-92', cats: [8], status: 'pendente', sinceDays: 24, contact: ['Cristiano Vidal', 'comercial@maximaemb.com.br', '(19) 3701-4040', 'Piracicaba'], docsUntil: [360, 300, 275] },
  { id: 18, slug: 'ferragens-ipiranga', name: 'Ferragens Ipiranga', cnpj: '04.998.223/0001-11', cats: [4], status: 'suspenso', sinceDays: 2280, contact: ['Nelson Kawamura', 'vendas@ferragensipiranga.com.br', '(11) 2274-6600', 'São Paulo'], docsUntil: [-95, 140, -40] },
  { id: 19, slug: 'onix-tecnologia', name: 'Onix Tecnologia', cnpj: '22.775.031/0001-26', cats: [1], status: 'suspenso', sinceDays: 1390, contact: ['Fábio Quintela', 'comercial@onixtec.com.br', '(62) 3255-8080', 'Goiânia'], docsUntil: [180, -60, 210] },
  { id: 20, slug: 'vale-verde-servicos', name: 'Vale Verde Serviços', cnpj: '15.660.409/0001-73', cats: [7], status: 'suspenso', sinceDays: 1010, contact: ['Simone Aparecida Reis', 'contratos@valeverdeservicos.com.br', '(27) 3344-9090', 'Vitória'], docsUntil: [-130, -20, 95] },
]

const DOC_KEYS = ['cnd-federal', 'fgts', 'contrato-social'] as const

// Estados por cidade — evita repetir a sigla em cada semente.
const CITY_STATE: Record<string, string> = {
  'São Paulo': 'SP',
  'Porto Alegre': 'RS',
  Barueri: 'SP',
  Joinville: 'SC',
  Fortaleza: 'CE',
  Curitiba: 'PR',
  Guarulhos: 'SP',
  Campinas: 'SP',
  'Belo Horizonte': 'MG',
  'Rio de Janeiro': 'RJ',
  Florianópolis: 'SC',
  'Caxias do Sul': 'RS',
  'São Bernardo do Campo': 'SP',
  Piracicaba: 'SP',
  Goiânia: 'GO',
  Vitória: 'ES',
}

export const SUPPLIERS: Supplier[] = SUPPLIER_SEEDS.map((s) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  cnpj: s.cnpj,
  categories: [...s.cats],
  status: s.status,
  since: daysAgo(s.sinceDays),
  // Retrato semeado — a tela sempre mostra `supplierRating()`.
  rating: null,
  contact: {
    name: s.contact[0],
    email: s.contact[1],
    phone: s.contact[2],
    city: s.contact[3],
    state: CITY_STATE[s.contact[3]] ?? 'SP',
  },
  docs: DOC_KEYS.map((key, i) => ({ key, until: daysAhead(s.docsUntil[i]) })),
  seeds: [`${s.slug}-1`, `${s.slug}-2`, `${s.slug}-3`],
}))

// ---- Requisições ---------------------------------------------------------

type ReqSeed = [
  requesterId: number,
  costCenterId: number,
  createdAgo: number,
  neededIn: number,
  status: PurchaseRequest['status'],
  justification: string,
  lines: [number, number][],
]

const REQUEST_SEEDS: ReqSeed[] = [
  [7, 3, 2, 20, 'rascunho', 'Reposição de periféricos das estações do 3º andar.', [[3, 15], [4, 15]]],
  [8, 1, 3, 25, 'rascunho', 'Material de escritório para o novo time comercial.', [[9, 60], [10, 8], [13, 40]]],
  [9, 5, 1, 30, 'rascunho', 'Insumos elétricos para a revisão do galpão B.', [[21, 120], [23, 20], [24, 60]]],
  [10, 6, 4, 45, 'rascunho', 'Calibração anual dos instrumentos do laboratório.', [[37, 18]]],

  [7, 3, 6, 21, 'aguardando-aprovacao', 'Renovação dos notebooks fora de garantia do time de engenharia.', [[1, 40], [2, 40]]],
  [8, 1, 5, 15, 'aguardando-aprovacao', 'Reposição de papel e toner do andar administrativo.', [[9, 120], [14, 10]]],
  [9, 2, 8, 18, 'aguardando-aprovacao', 'EPI para os três turnos da linha de montagem.', [[15, 90], [16, 400], [19, 90]]],
  [10, 5, 7, 30, 'aguardando-aprovacao', 'Pintura das áreas comuns antes da auditoria de qualidade.', [[22, 24], [24, 40]]],
  [7, 4, 9, 25, 'aguardando-aprovacao', 'Mobiliário das novas posições do comercial.', [[31, 24], [32, 24], [34, 24]]],
  [8, 2, 11, 20, 'aguardando-aprovacao', 'Material de limpeza para o refeitório e os vestiários.', [[26, 40], [27, 60], [29, 80]]],
  [9, 6, 12, 40, 'aguardando-aprovacao', 'Treinamento NR-35 para a equipe de manutenção predial.', [[38, 3]]],

  [10, 1, 14, 28, 'aprovada', 'Reposição de pastas e blocos do arquivo central.', [[12, 30], [13, 60]]],
  [7, 3, 16, 25, 'aprovada', 'Ampliação da rede do datacenter para o novo rack.', [[6, 4], [7, 10]]],
  [8, 5, 18, 30, 'aprovada', 'Troca dos filtros dos splits do prédio 2.', [[25, 45], [35, 45]]],
  [9, 2, 20, 35, 'aprovada', 'Embalagem para o pico de expedição do trimestre.', [[39, 4000], [40, 120], [42, 300]]],
  [10, 4, 22, 30, 'aprovada', 'Cadeiras para a sala de reunião do 5º andar.', [[31, 18]]],

  [7, 6, 24, 20, 'recusada', 'Compra fora do calendário de suprimentos do trimestre.', [[5, 60]]],
  [8, 1, 26, 15, 'recusada', 'Pedido duplicado de material que já está em cotação.', [[9, 80]]],
  [9, 4, 28, 22, 'recusada', 'Item sem cobertura orçamentária no exercício.', [[33, 20], [34, 20]]],

  [7, 3, 30, 25, 'em-cotacao', 'Renovação do parque de notebooks e monitores da engenharia.', [[1, 40], [2, 40], [3, 40], [4, 40], [5, 25], [8, 30]]],
  [8, 2, 32, 20, 'em-cotacao', 'EPI do semestre para toda a operação.', [[15, 120], [16, 600], [17, 150], [18, 300], [20, 120]]],
  [9, 1, 34, 18, 'em-cotacao', 'Suprimento de escritório do trimestre.', [[9, 240], [10, 20], [11, 25], [13, 120]]],
  [7, 4, 38, 35, 'em-cotacao', 'Mobiliário do novo andar comercial.', [[31, 40], [32, 40], [34, 40]]],
  [8, 2, 40, 25, 'em-cotacao', 'Higiene e limpeza para o segundo semestre.', [[26, 120], [27, 180], [28, 240], [29, 240], [30, 120]]],

  [10, 5, 128, -88, 'atendida', 'Manutenção predial — insumos elétricos do galpão A.', [[21, 300], [23, 40], [24, 120]]],
  [9, 6, 142, -102, 'atendida', 'Serviços de calibração e dedetização do semestre.', [[36, 4], [37, 30]]],
  [10, 3, 72, -32, 'atendida', 'Reposição de SSD das estações da produção.', [[8, 60]]],
  [7, 1, 88, -48, 'atendida', 'Papel e toner do primeiro trimestre.', [[9, 300], [14, 24]]],
  [8, 5, 104, -62, 'atendida', 'Troca das lâmpadas LED de toda a fábrica.', [[21, 600]]],
  [9, 2, 118, -78, 'atendida', 'Embalagem do fechamento do ano.', [[39, 6000], [40, 200]]],
]

const APPROVER_NOTES = [
  'Dentro do previsto para o centro de custo.',
  'De acordo. Seguir com a cotação.',
  'Aprovado com o prazo ajustado ao calendário.',
  'Aprovado. Priorizar fornecedor homologado.',
  'Sem ressalvas.',
]

const REJECT_NOTES = [
  'Fora do calendário de suprimentos deste trimestre.',
  'Material já contemplado em cotação aberta.',
  'Sem cobertura orçamentária no exercício.',
]

function memberOfRole(role: Member['role'], salt: number): Member {
  const pool = MEMBERS.filter((m) => m.role === role)
  return pool[salt % pool.length]
}

export const REQUESTS: PurchaseRequest[] = REQUEST_SEEDS.map((seed, idx) => {
  const [requesterId, costCenterId, createdAgo, neededIn, status, justification, lines] = seed
  const id = idx + 1
  const value = lines.reduce((sum, [itemId, qty]) => sum + itemPrice(itemId) * qty, 0)
  const chain = requiredRoles(value, MEMBERS)
  const createdAt = daysAgo(createdAgo)

  let signed: typeof chain = []
  let rejects = false
  // Metade da fila nasce sem nenhuma assinatura — assim a demonstração vê a
  // alçada subir de nível; a outra metade já espera só o último nível.
  if (status === 'aguardando-aprovacao') signed = id % 2 === 0 ? chain.slice(0, Math.max(0, chain.length - 1)) : []
  else if (status === 'recusada') {
    signed = chain.slice(0, Math.max(0, chain.length - 1))
    rejects = true
  } else if (status !== 'rascunho') signed = [...chain]

  const approvals = signed.map((role, i) => ({
    memberId: memberOfRole(role, id + i).id,
    at: daysAgo(Math.max(0, createdAgo - (i + 1))),
    ok: true,
    note: APPROVER_NOTES[(id + i) % APPROVER_NOTES.length],
  }))

  if (rejects) {
    const role = chain[chain.length - 1]
    approvals.push({
      memberId: memberOfRole(role, id).id,
      at: daysAgo(Math.max(0, createdAgo - signed.length - 1)),
      ok: false,
      note: REJECT_NOTES[id % REJECT_NOTES.length],
    })
  }

  return {
    id,
    code: `RC-2026-${String(id).padStart(4, '0')}`,
    requesterId,
    costCenterId,
    createdAt,
    neededBy: daysAhead(neededIn),
    justification,
    lines: lines.map(([itemId, qty]) => ({ itemId, qty, note: '' })),
    status,
    approvals,
  }
})

const requestById = (id: number) => REQUESTS.find((r) => r.id === id)!

// ---- Cotações ------------------------------------------------------------

export const TERMS = ['a-vista', 'd15', 'd28', 'd30-60', 'd30-60-90'] as const

interface BidPlan {
  supplierId: number
  /** Multiplicador sobre o preço de referência de cada item. */
  factor: number
  leadDays: number
  terms: string
  /** Quantas linhas da cotação o fornecedor cotou (ausente = todas). */
  covers?: number
  /** Preço fechado por item, quando o roteiro pede um número específico. */
  prices?: Record<number, number>
}

interface QuoteSeed {
  slug: string
  title: string
  categoryId: number
  requestIds: number[]
  openedAgo: number
  closesIn: number
  status: Quote['status']
  publicCall: boolean
  winnerId: number | null
  winnerNote: string
  plans: BidPlan[]
}

const QUOTE_SEEDS: QuoteSeed[] = [
  {
    slug: 'renovacao-parque-notebooks-monitores',
    title: 'Renovação do parque de notebooks e monitores',
    categoryId: 1,
    requestIds: [20],
    openedAgo: 9,
    closesIn: 6,
    status: 'aberta',
    publicCall: true,
    winnerId: null,
    winnerNote: '',
    // O mapa comparativo da demonstração: a InfoParts é a mais barata no total,
    // mas entrega em 30 dias; a TecnoSul entrega em 12 e ganha por item em dois
    // pontos. Escolher a TecnoSul é o caso que exige justificativa.
    plans: [
      { supplierId: 2, factor: 1, leadDays: 12, terms: 'd28', prices: { 1: 4590, 2: 1090, 3: 152, 4: 94, 5: 305, 8: 341 } },
      { supplierId: 10, factor: 1, leadDays: 30, terms: 'a-vista', prices: { 1: 4480, 2: 1120, 3: 138, 4: 82, 5: 289, 8: 349 } },
      { supplierId: 9, factor: 1, leadDays: 18, terms: 'd30-60', prices: { 1: 4790, 2: 1165, 3: 149, 4: 97, 5: 318, 8: 380 } },
      { supplierId: 15, factor: 1, leadDays: 21, terms: 'd28', covers: 4, prices: { 1: 4520, 2: 1075, 3: 141, 4: 91 } },
    ],
  },
  {
    slug: 'epi-semestre-operacao',
    title: 'EPI do semestre para a operação',
    categoryId: 3,
    requestIds: [21],
    openedAgo: 6,
    closesIn: 9,
    status: 'aberta',
    publicCall: true,
    winnerId: null,
    winnerNote: '',
    plans: [
      { supplierId: 4, factor: 0.94, leadDays: 15, terms: 'd28' },
      { supplierId: 12, factor: 0.97, leadDays: 10, terms: 'd15' },
      { supplierId: 1, factor: 1.03, leadDays: 20, terms: 'd30-60', covers: 3 },
    ],
  },
  {
    slug: 'suprimento-escritorio-trimestre',
    title: 'Suprimento de escritório do trimestre',
    categoryId: 2,
    requestIds: [22],
    openedAgo: 4,
    closesIn: 11,
    status: 'aberta',
    publicCall: false,
    winnerId: null,
    winnerNote: '',
    plans: [
      { supplierId: 3, factor: 0.96, leadDays: 8, terms: 'd28' },
      { supplierId: 13, factor: 0.99, leadDays: 12, terms: 'd30-60' },
      { supplierId: 1, factor: 1.05, leadDays: 6, terms: 'a-vista' },
      { supplierId: 9, factor: 1.01, leadDays: 14, terms: 'd15', covers: 2 },
    ],
  },
  {
    slug: 'mobiliario-novo-andar-comercial',
    title: 'Mobiliário do novo andar comercial',
    categoryId: 6,
    requestIds: [24],
    openedAgo: 11,
    closesIn: 3,
    status: 'aberta',
    publicCall: true,
    winnerId: null,
    winnerNote: '',
    plans: [
      { supplierId: 6, factor: 0.95, leadDays: 35, terms: 'd30-60-90' },
      { supplierId: 3, factor: 1.02, leadDays: 28, terms: 'd30-60' },
      { supplierId: 14, factor: 0.91, leadDays: 45, terms: 'd28', covers: 2 },
    ],
  },
  {
    slug: 'higiene-limpeza-segundo-semestre',
    title: 'Higiene e limpeza para o segundo semestre',
    categoryId: 5,
    requestIds: [25],
    openedAgo: 2,
    closesIn: 13,
    status: 'aberta',
    publicCall: false,
    winnerId: null,
    winnerNote: '',
    plans: [
      { supplierId: 5, factor: 0.93, leadDays: 9, terms: 'd28' },
      { supplierId: 13, factor: 0.98, leadDays: 7, terms: 'd15' },
      { supplierId: 16, factor: 1.04, leadDays: 16, terms: 'a-vista', covers: 3 },
    ],
  },

  {
    slug: 'ssd-estacoes-producao',
    title: 'Reposição de SSD das estações da produção',
    categoryId: 1,
    requestIds: [27],
    openedAgo: 36,
    closesIn: -26,
    status: 'encerrada',
    publicCall: false,
    winnerId: 10,
    winnerNote: '',
    plans: [
      { supplierId: 10, factor: 0.9, leadDays: 10, terms: 'd28' },
      { supplierId: 2, factor: 0.95, leadDays: 8, terms: 'd15' },
      { supplierId: 9, factor: 1.02, leadDays: 15, terms: 'd30-60' },
      { supplierId: 15, factor: 0.98, leadDays: 22, terms: 'a-vista' },
    ],
  },
  {
    slug: 'papel-toner-primeiro-trimestre',
    title: 'Papel e toner do primeiro trimestre',
    categoryId: 2,
    requestIds: [28],
    openedAgo: 30,
    closesIn: -20,
    status: 'encerrada',
    publicCall: false,
    winnerId: 3,
    winnerNote:
      'Único com estoque para as 300 resmas na semana pedida. A diferença de 2,4% se paga no frete incluso.',
    plans: [
      { supplierId: 3, factor: 0.94, leadDays: 7, terms: 'd28' },
      { supplierId: 13, factor: 0.92, leadDays: 21, terms: 'a-vista' },
      { supplierId: 1, factor: 1.01, leadDays: 12, terms: 'd30-60' },
      { supplierId: 9, factor: 1.06, leadDays: 9, terms: 'd15' },
    ],
  },
  {
    slug: 'lampadas-led-fabrica',
    title: 'Troca das lâmpadas LED de toda a fábrica',
    categoryId: 4,
    requestIds: [29],
    openedAgo: 70,
    closesIn: -60,
    status: 'encerrada',
    publicCall: true,
    winnerId: 9,
    winnerNote: '',
    plans: [
      { supplierId: 9, factor: 0.88, leadDays: 12, terms: 'd28' },
      { supplierId: 11, factor: 0.96, leadDays: 10, terms: 'd15' },
      { supplierId: 7, factor: 1.03, leadDays: 14, terms: 'd30-60' },
      { supplierId: 18, factor: 0.99, leadDays: 20, terms: 'a-vista' },
    ],
  },
  {
    slug: 'embalagem-fechamento-do-ano',
    title: 'Embalagem do fechamento do ano',
    categoryId: 8,
    requestIds: [30],
    openedAgo: 96,
    closesIn: -86,
    status: 'encerrada',
    publicCall: true,
    winnerId: 8,
    winnerNote: '',
    plans: [
      { supplierId: 8, factor: 0.89, leadDays: 9, terms: 'd28' },
      { supplierId: 17, factor: 0.93, leadDays: 18, terms: 'a-vista' },
      { supplierId: 1, factor: 1.02, leadDays: 11, terms: 'd30-60' },
      { supplierId: 9, factor: 1.08, leadDays: 8, terms: 'd15' },
    ],
  },
  {
    slug: 'insumos-eletricos-galpao-a',
    title: 'Manutenção predial — insumos elétricos do galpão A',
    categoryId: 4,
    requestIds: [25],
    openedAgo: 120,
    closesIn: -110,
    status: 'encerrada',
    publicCall: false,
    winnerId: 11,
    winnerNote: 'Instalação inclusa no preço; o concorrente cotava só o material.',
    plans: [
      { supplierId: 11, factor: 0.97, leadDays: 14, terms: 'd28' },
      { supplierId: 9, factor: 0.93, leadDays: 20, terms: 'a-vista' },
      { supplierId: 7, factor: 1.04, leadDays: 12, terms: 'd30-60' },
      { supplierId: 18, factor: 1.09, leadDays: 25, terms: 'd15' },
    ],
  },
  {
    slug: 'calibracao-e-dedetizacao',
    title: 'Serviços de calibração e dedetização do semestre',
    categoryId: 7,
    requestIds: [26],
    openedAgo: 140,
    closesIn: -130,
    status: 'encerrada',
    publicCall: false,
    winnerId: 7,
    winnerNote: '',
    plans: [
      { supplierId: 7, factor: 0.91, leadDays: 15, terms: 'd28' },
      { supplierId: 11, factor: 0.98, leadDays: 12, terms: 'd15' },
      { supplierId: 20, factor: 1.05, leadDays: 18, terms: 'a-vista' },
      { supplierId: 15, factor: 1.11, leadDays: 21, terms: 'd30-60' },
    ],
  },

  {
    slug: 'armarios-e-gaveteiros-arquivo',
    title: 'Armários e gaveteiros para o arquivo',
    categoryId: 6,
    requestIds: [19],
    openedAgo: 27,
    closesIn: -19,
    status: 'cancelada',
    publicCall: false,
    winnerId: null,
    winnerNote: '',
    plans: [
      { supplierId: 6, factor: 0.97, leadDays: 30, terms: 'd30-60' },
      { supplierId: 14, factor: 0.94, leadDays: 40, terms: 'd28', covers: 1 },
    ],
  },
]

export const QUOTES: Quote[] = QUOTE_SEEDS.map((seed, idx) => {
  const id = idx + 1
  const lines = seed.requestIds
    .flatMap((rid) => requestById(rid).lines)
    .map((l) => ({ itemId: l.itemId, qty: l.qty }))
  const openedAt = daysAgo(seed.openedAgo)

  const bids: Bid[] = []
  seed.plans.forEach((plan, pi) => {
    const covered = plan.covers ?? lines.length
    lines.slice(0, covered).forEach((line) => {
      const explicit = plan.prices?.[line.itemId]
      const base = itemPrice(line.itemId) * plan.factor
      const jitter = explicit ? 0 : (rnd() - 0.5) * 0.05
      bids.push({
        supplierId: plan.supplierId,
        itemId: line.itemId,
        unitPrice: money(explicit ?? base * (1 + jitter)),
        leadDays: plan.leadDays,
        terms: plan.terms,
        at: daysAgo(Math.max(0, seed.openedAgo - 1 - pi)),
      })
    })
  })

  return {
    id,
    code: `CT-2026-${String(id).padStart(4, '0')}`,
    slug: seed.slug,
    title: seed.title,
    categoryId: seed.categoryId,
    requestIds: [...seed.requestIds],
    lines,
    supplierIds: seed.plans.map((p) => p.supplierId),
    bids,
    openedAt,
    closesAt: daysAhead(seed.closesIn),
    status: seed.status,
    winnerId: seed.winnerId,
    winnerNote: seed.winnerNote,
    publicCall: seed.publicCall,
  }
})

const quoteById = (id: number) => QUOTES.find((q) => q.id === id)!

// ---- Pedidos -------------------------------------------------------------

type OrderSeed = [
  quoteId: number,
  /** Fatia das quantidades da cotação nesta remessa. */
  share: number,
  issuedAgo: number,
  /** Dias entre a emissão e o prazo de entrega. */
  dueIn: number,
  /** Fração já recebida (1 = tudo). */
  receivedRatio: number,
  rating: number | null,
  cancelled: boolean,
]

const ORDER_SEEDS: OrderSeed[] = [
  // Embalagem (cotação 9) — três remessas, todas recebidas e avaliadas.
  [9, 0.4, 84, 15, 1, 5, false],
  [9, 0.35, 62, 15, 1, 4, false],
  [9, 0.25, 40, 15, 1, 5, false],
  // Lâmpadas LED (cotação 8).
  [8, 0.4, 58, 20, 1, 4, false],
  [8, 0.35, 40, 20, 1, 3, false],
  [8, 0.25, 22, 20, 1, 4, false],
  // Insumos elétricos (cotação 10) — a última remessa ficou em aberto e venceu.
  [10, 0.4, 105, 18, 1, 5, false],
  [10, 0.35, 80, 18, 1, 4, false],
  [10, 0.25, 55, 18, 0.6, null, false],
  // Serviços (cotação 11) — a terceira remessa acabou de ser emitida.
  [11, 0.4, 125, 25, 1, 5, false],
  [11, 0.35, 95, 25, 1, 4, false],
  [11, 0.25, 5, 25, 0, null, false],
  // Papel e toner (cotação 7) — uma atrasada e uma parcial dentro do prazo.
  [7, 0.4, 18, 10, 1, 4, false],
  [7, 0.35, 10, 6, 0.55, null, false],
  [7, 0.25, 3, 22, 0.4, null, false],
  // SSD (cotação 6) — uma recebida, uma atrasada e uma cancelada.
  [6, 0.4, 24, 12, 1, 5, false],
  [6, 0.35, 16, 10, 0.7, null, false],
  [6, 0.25, 6, 16, 0, null, true],
]

export const ORDERS: Order[] = ORDER_SEEDS.map((seed, idx) => {
  const [quoteId, share, issuedAgo, dueIn, receivedRatio, rating, cancelled] = seed
  const id = idx + 1
  const quote = quoteById(quoteId)
  const supplierId = quote.winnerId!
  const lines = quote.lines.map((l) => {
    const bid = quote.bids.find((b) => b.supplierId === supplierId && b.itemId === l.itemId)
    return {
      itemId: l.itemId,
      qty: Math.max(1, Math.round(l.qty * share)),
      unitPrice: bid ? bid.unitPrice : money(itemPrice(l.itemId)),
    }
  })

  const receipts: Receipt[] = []
  if (!cancelled && receivedRatio > 0) {
    lines.forEach((l, li) => {
      // Abaixo de 100% a remessa fecha sempre com saldo em aberto — é o que
      // mantém o pedido em `parcial` (ou `atrasado`, se o prazo passou).
      const qty = receivedRatio >= 1 ? l.qty : Math.min(Math.max(1, Math.round(l.qty * receivedRatio)), l.qty - 1)
      if (qty <= 0) return
      receipts.push({ itemId: l.itemId, qty, at: daysAgo(Math.max(0, issuedAgo - dueIn + 2 + li)) })
    })
  }

  return {
    id,
    code: `PC-2026-${String(id).padStart(4, '0')}`,
    quoteId,
    supplierId,
    lines,
    issuedAt: daysAgo(issuedAgo),
    dueAt: daysAgo(issuedAgo - dueIn),
    // Só `emitido` e `cancelado` são guardados; o resto é derivado.
    status: cancelled ? 'cancelado' : 'emitido',
    receipts,
    rating: cancelled ? null : rating,
  }
})

// ---- Conteúdo do site público -------------------------------------------

export const INTEGRITY_TOPICS = ['isonomia', 'sigilo', 'conflito', 'canal'] as const
export const HOW_STEPS = ['cadastro', 'homologacao', 'convite', 'proposta'] as const
export const POLICY_FAQ = ['prazo', 'documentos', 'brinde', 'parente', 'pagamento', 'recusa'] as const
export const SIGNUP_DOCS = ['cnd-federal', 'fgts', 'contrato-social'] as const

/** Canal de integridade — dado, nunca texto traduzido. */
export const CHANNEL = {
  email: 'integridade@suprir.com',
  phone: '0800 771 2210',
}
