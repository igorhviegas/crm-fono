// Importação de fichas em Word (.docx): lê só dados ADMINISTRATIVOS (nome, nascimento, datas de
// atendimento, serviço, responsável). O conteúdo clínico (queixa, evolução, exames) nunca é copiado.
import { strFromU8, unzipSync } from 'fflate'
import { normalizaNascimento, type Destinatario, type Dia } from './domain'

export type Ficha = {
  nome: string
  nascimento: string // AAAA-MM-DD
  primeiroAtendimento?: string // "DT": informada no documento ou, senão, data de criação do arquivo
  origemPrimeiro?: 'documento' | 'arquivo'
  ultimoAtendimento?: string // a data mais recente citada no documento
  atendimento?: string
  responsavelNome?: string
  destinatario: Destinatario
  lembreteMeses?: number // 12 quando a ficha cita "Calibração" (revisão anual do aparelho)
}

export type Docx = { paragrafos: string[]; criado?: string; modificado?: string }

const entidades = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Lê parágrafos (inclusive de tabelas) e as datas internas de criação/modificação do arquivo. */
export function lerDocx(bytes: Uint8Array): Docx {
  const z = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' || f.name === 'docProps/core.xml' })
  if (!z['word/document.xml']) throw new Error('não é um .docx')
  const xml = strFromU8(z['word/document.xml'])
  const paragrafos = (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map((p) =>
    entidades([...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => m[1] ?? ' ').join('')).trim(),
  )
  const core = z['docProps/core.xml'] ? strFromU8(z['docProps/core.xml']) : ''
  // ponytail: usa a data em UTC; perto da meia-noite pode cair um dia diferente do horário de Brasília
  const data = (tag: string) => core.match(new RegExp(`<dcterms:${tag}[^>]*>(\\d{4}-\\d{2}-\\d{2})`))?.[1]
  return { paragrafos, criado: data('created'), modificado: data('modified') }
}

const DATA = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g
const iso = (d: string, m: string, a: string) => normalizaNascimento(`${d}/${m}/${a.length === 2 ? '20' + a : a}`)
const isoDia = (h: Dia) => `${h.a}-${String(h.m).padStart(2, '0')}-${String(h.d).padStart(2, '0')}`

function idade(nasc: string, h: Dia) {
  const [a, m, d] = nasc.split('-').map(Number)
  return h.a - a - (h.m < m || (h.m === m && h.d < d) ? 1 : 0)
}

export function extraiFicha(doc: Docx, hoje: Dia): Ficha | { erro: string } {
  const [cab, ...resto] = doc.paragrafos.filter(Boolean)
  const nome = cab?.split(/\s[–—-]\s/)[0].trim()
  const dn = cab?.match(/\bDN\b\s*[:.]?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  const nascimento = dn && iso(dn[1], dn[2], dn[3])
  if (!nome || !nascimento) return { erro: 'Não encontrei o nome e a data de nascimento (DN) na primeira linha.' }

  const limite = isoDia(hoje)
  const valida = (d: string | null | undefined): d is string => !!d && d >= nascimento && d <= limite

  let dt: string | undefined
  const datas: string[] = []
  for (const p of resto) {
    const t = p.match(/^DT\b\s*[:.]?\s*(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/i)
    if (t) dt = iso(t[1], t[2], t[3]) ?? dt
    if (/calibra[çc][ãa]o/i.test(p)) continue // data de calibração do aparelho, não é atendimento
    for (const m of p.matchAll(DATA)) datas.push(iso(m[1], m[2], m[3]) ?? '')
  }
  if (valida(dt)) datas.push(dt)
  const doTexto = datas.filter(valida).sort()

  const primeiro = valida(dt) ? dt : valida(doc.criado) ? doc.criado : undefined
  const ultimo = [...doTexto, ...(primeiro ? [primeiro] : [])].sort().at(-1) ?? (valida(doc.modificado) ? doc.modificado : undefined)

  const corpo = resto.join('\n')
  const atendimento = /audiometria|imitanciometria|otoscopia|\bIPRF\b/i.test(corpo)
    ? 'Audiometria'
    : /\bQP:|trabalh|trein|fonema|terapia/i.test(corpo) ? 'Fonoterapia' : undefined

  // "Daiane mãe, ..." no início de uma linha → só o nome é aproveitado, o resto da linha é ignorado
  const resp = resto.slice(0, 15).map((p) => p.match(/^([A-ZÀ-Ý][a-zà-ÿ]+(?:\s[A-ZÀ-Ý][a-zà-ÿ]+)?)\s+(?:mãe|pai|avó|avô|responsável)\b/)).find(Boolean)
  const responsavelNome = resp?.[1]

  return {
    nome, nascimento,
    primeiroAtendimento: primeiro, origemPrimeiro: primeiro ? (valida(dt) ? 'documento' : 'arquivo') : undefined,
    ultimoAtendimento: ultimo, atendimento, responsavelNome,
    lembreteMeses: resto.some((p) => /calibra[çc][ãa]o/i.test(p)) ? 12 : undefined,
    destinatario: idade(nascimento, hoje) < 18 && responsavelNome ? 'responsavel' : 'paciente',
  }
}
