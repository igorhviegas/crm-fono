import Papa from 'papaparse'
import { normalizaNascimento, normalizaTelefone } from './domain'

export type Linha = { nome: string; whatsapp: string; nascimento: string }
export type Resultado = { validas: Linha[]; erros: string[] }

const sem = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const acha = (cols: string[], chaves: string[]) => cols.find((c) => chaves.some((k) => sem(c).includes(k)))

/** Lê CSV com cabeçalho; reconhece colunas por nome (nome / telefone|whatsapp|celular / nascimento|aniversario). */
export function lerCsv(texto: string): Resultado {
  const { data, meta } = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: true })
  const cols = meta.fields ?? []
  const [cN, cT, cD] = [acha(cols, ['nome', 'name']), acha(cols, ['whats', 'telefone', 'celular', 'fone']), acha(cols, ['nasc', 'aniver'])]
  if (!cN || !cT || !cD)
    return { validas: [], erros: ['Não encontrei as colunas. A primeira linha precisa ter: Nome, WhatsApp (ou Telefone) e Nascimento.'] }

  const validas: Linha[] = []
  const erros: string[] = []
  data.forEach((r, i) => {
    const nome = (r[cN] ?? '').trim()
    const whatsapp = normalizaTelefone(r[cT] ?? '')
    const nascimento = normalizaNascimento(r[cD] ?? '')
    if (nome && whatsapp && nascimento) validas.push({ nome, whatsapp, nascimento })
    else erros.push(`Linha ${i + 2}: ${nome || '(sem nome)'} — ${!whatsapp ? 'telefone inválido' : 'data inválida'}`)
  })
  return { validas, erros }
}
