// Regras de negócio puras (sem Firebase/DOM) — cobertas por domain.test.ts.

export type Destinatario = 'paciente' | 'responsavel'
export type Tipo = 'aniversario' | 'retorno'

export type Paciente = {
  id: string
  nome: string
  whatsapp: string // 55DDDNUMERO; '' = ainda sem WhatsApp (ex.: veio de uma ficha em Word)
  nascimento: string // AAAA-MM-DD
  observacoes?: string
  arquivado: boolean
  destinatario: Destinatario // quem recebe as mensagens
  responsavelNome?: string
  responsavelWhatsapp?: string
  convenio?: string
  atendimento?: string
  primeiroAtendimento?: string // AAAA-MM-DD ("DT" das fichas)
  ultimoAtendimento?: string // AAAA-MM-DD
}

/** AAAA-MM-DD → DD/MM/AAAA */
export const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export type ChaveModelo = 'modeloAniversario' | 'modeloAniversarioResp' | 'modeloRetorno' | 'modeloRetornoResp'

// "Resp" = mensagem enviada ao responsável (fala do paciente em 3ª pessoa).
export const MODELOS_PADRAO: Record<ChaveModelo, string> = {
  modeloAniversario:
    'Olá, {nome}! 🎉 A equipe da {clinica} deseja a você um feliz aniversário, com muita saúde, alegria e momentos especiais! Que seu novo ciclo seja repleto de coisas boas. Um abraço de toda a nossa equipe! 💛',
  modeloAniversarioResp:
    'Olá, {nome}! 🎉 A equipe da {clinica} deseja um feliz aniversário a {paciente}, com muita saúde, alegria e momentos especiais! Que o novo ciclo seja repleto de coisas boas. Um abraço de toda a nossa equipe! 💛',
  modeloRetorno:
    'Olá, {nome}! Tudo bem? 😊 Aqui é da {clinica}. Estamos entrando em contato para saber como você está e verificar se gostaria de agendar ou conversar sobre o seu próximo atendimento. Ficamos à disposição!',
  modeloRetornoResp:
    'Olá, {nome}! Tudo bem? 😊 Aqui é da {clinica}. Estamos entrando em contato para saber como {paciente} está e verificar se gostariam de agendar ou conversar sobre o próximo atendimento. Ficamos à disposição!',
}

export const chaveModelo = (tipo: Tipo, resp: boolean): ChaveModelo =>
  `modelo${tipo === 'aniversario' ? 'Aniversario' : 'Retorno'}${resp ? 'Resp' : ''}`

export const CLINICA_PADRAO = 'Bárbara Rabelo Fonoaudiologia'

export const ATENDIMENTOS = ['Audiometria', 'Teste da orelhinha', 'Impedanciometria', 'Otoemissões', 'Fonoterapia', 'Avaliação / consulta', 'Outro']
export const CONVENIOS_SUGERIDOS = ['Particular', 'IPSM', 'Amagis Saúde', 'Cemig Saúde', 'Asseio', 'Abertta Saúde', 'SulAmérica', 'MedSênior']

/** Para quem a mensagem vai: o próprio paciente ou o responsável. */
export function destinatarioDe(p: Paciente): { nome: string; tel: string; responsavel: boolean } {
  return p.destinatario === 'responsavel'
    ? { nome: p.responsavelNome || p.nome, tel: p.responsavelWhatsapp ?? '', responsavel: true }
    : { nome: p.nome, tel: p.whatsapp, responsavel: false }
}

/** Aceita "(31) 99711-5766", "31997115766", "+55 31 ..." → "5531997115766"; null se inválido. */
export function normalizaTelefone(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '').replace(/^0+/, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return /^55\d{10,11}$/.test(d) ? d : null
}

export function formataTelefone(t: string): string {
  if (!t) return ''
  const n = t.slice(2)
  return n.length === 11
    ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
    : `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
}

const bissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0

/** Aceita "DD/MM/AAAA" ou "AAAA-MM-DD" → "AAAA-MM-DD"; null se não for uma data real. */
export function normalizaNascimento(entrada: string): string | null {
  const s = entrada.trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [a, me, d] = s.includes('/') ? [+m[3], +m[2], +m[1]] : [+m[1], +m[2], +m[3]]
  const dt = new Date(Date.UTC(a, me - 1, d))
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== me - 1 || dt.getUTCDate() !== d) return null
  if (a < 1900 || a > new Date().getFullYear()) return null
  return `${a}-${String(me).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export type Dia = { a: number; m: number; d: number }

/** "Hoje" no fuso de São Paulo, independente do fuso do aparelho. */
export function hojeSP(agora = new Date()): Dia {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora).split('-')
  return { a: +p[0], m: +p[1], d: +p[2] }
}

/** Dias até o próximo aniversário (0 = hoje). Só mês/dia contam; 29/02 cai em 28/02 em ano não bissexto. */
export function diasAteAniversario(nasc: string, hoje: Dia): number {
  const m = +nasc.slice(5, 7)
  const dia = +nasc.slice(8, 10)
  const alvo = (ano: number) => Date.UTC(ano, m - 1, m === 2 && dia === 29 && !bissexto(ano) ? 28 : dia)
  const h = Date.UTC(hoje.a, hoje.m - 1, hoje.d)
  const t = alvo(hoje.a) >= h ? alvo(hoje.a) : alvo(hoje.a + 1)
  return Math.round((t - h) / 86400000)
}

export type Filtro = 'hoje' | 'semana' | 'mes'

/** Aniversariantes do período, em ordem de data. "mes" = mês corrente inteiro (incluindo dias já passados). */
export function aniversariantes(ps: Paciente[], filtro: Filtro, hoje: Dia): Paciente[] {
  const ativos = ps.filter((p) => !p.arquivado)
  const alvo =
    filtro === 'mes'
      ? ativos
          .filter((p) => +p.nascimento.slice(5, 7) === hoje.m)
          .sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)))
      : ativos
          .filter((p) => diasAteAniversario(p.nascimento, hoje) <= (filtro === 'hoje' ? 0 : 6))
          .sort((a, b) => diasAteAniversario(a.nascimento, hoje) - diasAteAniversario(b.nascimento, hoje))
  return alvo
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

/** Só {nome}, {paciente} e {clinica}; qualquer outra variável é rejeitada na validação. */
export function variaveisInvalidas(modelo: string): string[] {
  return [...modelo.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]).filter((v) => !['nome', 'paciente', 'clinica'].includes(v))
}

/** {nome} = quem recebe; {paciente} = o paciente (útil quando quem recebe é o responsável). */
export function montaMensagem(modelo: string, destinatario: string, clinica: string, paciente = destinatario): string {
  return modelo
    .replaceAll('{nome}', primeiroNome(destinatario))
    .replaceAll('{paciente}', primeiroNome(paciente))
    .replaceAll('{clinica}', clinica)
}

export const linkWhatsApp = (tel: string, texto: string) => `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
