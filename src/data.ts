// Único módulo que conversa com o Firestore/Auth.
import { useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import {
  addDoc, Bytes, collection, collectionGroup, deleteField, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { ATENDIMENTOS, CLINICA_PADRAO, CONVENIOS_SUGERIDOS, MODELOS_PADRAO, type ChaveModelo, type Destinatario, type Paciente, type Tipo } from './domain'
import type { Ficha } from './ficha'

export type Sessao = { estado: 'carregando' | 'deslogada' | 'sem-acesso' | 'ok'; user: User | null }

export function useSessao(): Sessao {
  const [s, setS] = useState<Sessao>({ estado: 'carregando', user: null })
  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user?.email) return setS({ estado: 'deslogada', user: null })
        // A lista de quem pode entrar fica em membros/{email} (criada só pelo console do Firebase).
        const ok = await getDoc(doc(db, 'membros', user.email)).then((d) => d.exists(), () => false)
        setS({ estado: ok ? 'ok' : 'sem-acesso', user })
      }),
    [],
  )
  return s
}

export const entrarComGoogle = () => signInWithPopup(auth, new GoogleAuthProvider())
export const sair = () => signOut(auth)

export function usePacientes(ativo: boolean): Paciente[] | null {
  const [ps, setPs] = useState<Paciente[] | null>(null)
  useEffect(() => {
    if (!ativo) return
    return onSnapshot(collection(db, 'pacientes'), (q) =>
      setPs(
        q.docs
          .map((d) => ({ arquivado: false, destinatario: 'paciente', ...d.data(), id: d.id }) as Paciente)
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      ),
    )
  }, [ativo])
  return ps
}

// planos = planos de saúde/convênios; servicos = tipos de atendimento. Ambos editáveis pelo menu.
export type Config = { nomeClinica: string; planos: string[]; servicos: string[] } & Record<ChaveModelo, string>

const CONFIG_PADRAO: Config = { nomeClinica: CLINICA_PADRAO, planos: CONVENIOS_SUGERIDOS, servicos: ATENDIMENTOS, ...MODELOS_PADRAO }

export function useConfig(ativo: boolean): Config {
  const [c, setC] = useState<Config>(CONFIG_PADRAO)
  useEffect(() => {
    if (!ativo) return
    return onSnapshot(doc(db, 'config', 'clinica'), (d) => d.exists() && setC({ ...CONFIG_PADRAO, ...(d.data() as Partial<Config>) }))
  }, [ativo])
  return c
}

export const salvaConfig = (c: Config) => setDoc(doc(db, 'config', 'clinica'), c)

// ---- histórico de mensagens (não guarda o texto; só tipo, destinatário e status) ----

export type Msg = {
  id: string
  pacienteId: string
  tipo: Tipo
  destinatario: Destinatario
  status: 'link_aberto' | 'envio_confirmado'
  criadoEm: Date
}

/** Todas as mensagens agrupadas por paciente (mais recentes primeiro). */
export function useMensagens(ativo: boolean): Map<string, Msg[]> {
  const [m, setM] = useState<Map<string, Msg[]>>(new Map())
  useEffect(() => {
    if (!ativo) return
    return onSnapshot(collectionGroup(db, 'mensagens'), (q) => {
      const mapa = new Map<string, Msg[]>()
      q.docs.forEach((d) => {
        const x = d.data({ serverTimestamps: 'estimate' })
        const pacienteId = d.ref.parent.parent!.id
        mapa.set(pacienteId, [...(mapa.get(pacienteId) ?? []), { ...x, id: d.id, pacienteId, criadoEm: x.criadoEm.toDate() } as Msg])
      })
      mapa.forEach((l) => l.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()))
      setM(mapa)
    })
  }, [ativo])
  return m
}

/** Registra que o link do WhatsApp foi aberto — NÃO significa que a mensagem foi enviada. */
export async function registraMensagem(pacienteId: string, tipo: Tipo, destinatario: Destinatario): Promise<string> {
  const r = await addDoc(collection(db, 'pacientes', pacienteId, 'mensagens'), {
    tipo, destinatario, status: 'link_aberto', criadoEm: serverTimestamp(),
  })
  return r.id
}

export const confirmaEnvio = (pacienteId: string, msgId: string) =>
  updateDoc(doc(db, 'pacientes', pacienteId, 'mensagens', msgId), { status: 'envio_confirmado' })

// ---- pacientes ----

type Dados = Omit<Paciente, 'id'>
const OPCIONAIS = ['observacoes', 'responsavelNome', 'responsavelWhatsapp', 'convenio', 'atendimento', 'primeiroAtendimento', 'ultimoAtendimento'] as const

export async function salvaPaciente(id: string | null, d: Dados) {
  const dados: Record<string, unknown> = {
    nome: d.nome, whatsapp: d.whatsapp, nascimento: d.nascimento, arquivado: d.arquivado, destinatario: d.destinatario,
  }
  for (const k of OPCIONAIS) {
    const v = d[k]?.trim()
    if (v) dados[k] = v
    else if (id) dados[k] = deleteField() // limpar um campo ao editar remove-o do documento
  }
  if (d.lembreteMeses) dados.lembreteMeses = d.lembreteMeses
  else if (id) dados.lembreteMeses = deleteField()
  if (id) await updateDoc(doc(db, 'pacientes', id), dados)
  else await addDoc(collection(db, 'pacientes'), { ...dados, criadoEm: serverTimestamp() })
}

/**
 * Importa fichas do Word. Sem WhatsApp (as fichas não têm telefone): o cadastro é completado depois.
 * Quem já existe (mesmo nome + nascimento) não é duplicado; só ganha o último atendimento, se for mais novo.
 */
export type Importado = { ficha: Ficha; arquivo: string; bytes: Uint8Array }

export async function importaFichas(
  importados: Importado[], existentes: Paciente[],
): Promise<{ novos: number; atualizados: number; repetidos: number; relatorios: number; grandes: number }> {
  const chave = (nome: string, nasc: string) => `${nome.trim().toLowerCase()}|${nasc}`
  const porChave = new Map(existentes.map((p) => [chave(p.nome, p.nascimento), p]))
  const ops: { run: (b: ReturnType<typeof writeBatch>) => void; peso: number }[] = []
  let novos = 0, atualizados = 0, repetidos = 0, relatorios = 0, grandes = 0
  // o arquivo Word original fica guardado no relatório do paciente; mesmo nome de arquivo = mesmo relatório (reimportar não duplica)
  const guardaRelatorio = (pacienteId: string, arquivo: string, bytes: Uint8Array) => {
    if (bytes.length > LIMITE_RELATORIO) return void grandes++
    const ref = doc(db, 'pacientes', pacienteId, 'relatorios', 'docx-' + arquivo.replaceAll('/', '_').slice(0, 150))
    ops.push({ run: (b) => b.set(ref, { nome: arquivo.slice(0, 200), arquivo: Bytes.fromUint8Array(bytes), criadoEm: serverTimestamp() }), peso: bytes.length })
    relatorios++
  }
  for (const { ficha: f, arquivo, bytes } of importados) {
    const k = chave(f.nome, f.nascimento)
    const ex = porChave.get(k)
    if (ex) {
      const novo: Record<string, unknown> = {}
      if (f.ultimoAtendimento && f.ultimoAtendimento > (ex.ultimoAtendimento ?? '')) novo.ultimoAtendimento = f.ultimoAtendimento
      if (f.lembreteMeses && !ex.lembreteMeses) novo.lembreteMeses = f.lembreteMeses
      if (Object.keys(novo).length) { ops.push({ run: (b) => b.update(doc(db, 'pacientes', ex.id), novo), peso: 1000 }); atualizados++ } else repetidos++
      guardaRelatorio(ex.id, arquivo, bytes)
      continue
    }
    const novo = doc(collection(db, 'pacientes'))
    porChave.set(k, { id: novo.id, ultimoAtendimento: f.ultimoAtendimento, lembreteMeses: f.lembreteMeses } as Paciente) // evita duplicar dentro do mesmo lote
    const dados: Record<string, unknown> = { nome: f.nome, whatsapp: '', nascimento: f.nascimento, arquivado: false, destinatario: f.destinatario, criadoEm: serverTimestamp() }
    for (const c of ['responsavelNome', 'atendimento', 'primeiroAtendimento', 'ultimoAtendimento', 'lembreteMeses'] as const) if (f[c]) dados[c] = f[c]
    ops.push({ run: (b) => b.set(novo, dados), peso: 1000 })
    novos++
    guardaRelatorio(novo.id, arquivo, bytes)
  }
  // lotes de até 400 operações e ~5 MB (limite do Firestore: 10 MB por lote)
  for (let i = 0; i < ops.length;) {
    const b = writeBatch(db)
    let n = 0, peso = 0
    while (i < ops.length && n < 400 && (n === 0 || peso + ops[i].peso < 5_000_000)) { ops[i].run(b); peso += ops[i].peso; n++; i++ }
    await b.commit()
  }
  return { novos, atualizados, repetidos, relatorios, grandes }
}

// ---- consultas e relatórios em Word (subcoleções do paciente) ----

export type Consulta = { id: string; data: string; servico: string }
export type Relatorio = { id: string; nome: string; criadoEm: Date; bytes: Uint8Array }

function useSub<T>(pacienteId: string, sub: 'consultas' | 'relatorios', campo: string, mapa: (id: string, d: Record<string, any>) => T): T[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [l, setL] = useState<T[]>([])
  useEffect(
    () => onSnapshot(query(collection(db, 'pacientes', pacienteId, sub), orderBy(campo, 'desc')), (q) =>
      setL(q.docs.map((d) => mapa(d.id, d.data({ serverTimestamps: 'estimate' })))),
    ),
    [pacienteId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return l
}

export const useConsultas = (pid: string) => useSub<Consulta>(pid, 'consultas', 'data', (id, d) => ({ id, data: d.data, servico: d.servico }))
// ponytail: o arquivo vai dentro do documento (limite 1 MB do Firestore); acima disso, migrar para Firebase Storage (plano Blaze)
export const useRelatorios = (pid: string) =>
  useSub<Relatorio>(pid, 'relatorios', 'criadoEm', (id, d) => ({ id, nome: d.nome, criadoEm: d.criadoEm.toDate(), bytes: d.arquivo.toUint8Array() }))

export const LIMITE_RELATORIO = 900_000

export const salvaRelatorio = (pacienteId: string, nome: string, bytes: Uint8Array) =>
  addDoc(collection(db, 'pacientes', pacienteId, 'relatorios'), { nome, arquivo: Bytes.fromUint8Array(bytes), criadoEm: serverTimestamp() })

/** Registra a consulta e mantém 1º/último atendimento e serviço do cadastro em dia (só avança, nunca recua o último). */
export async function salvaConsulta(p: Paciente, data: string, servico: string) {
  const b = writeBatch(db)
  b.set(doc(collection(db, 'pacientes', p.id, 'consultas')), { data, servico, criadoEm: serverTimestamp() })
  const novo: Record<string, string> = {}
  if (data >= (p.ultimoAtendimento ?? '')) { novo.ultimoAtendimento = data; if (servico) novo.atendimento = servico }
  if (!p.primeiroAtendimento || data < p.primeiroAtendimento) novo.primeiroAtendimento = data
  if (Object.keys(novo).length) b.update(doc(db, 'pacientes', p.id), novo)
  await b.commit()
}
