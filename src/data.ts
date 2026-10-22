// Único módulo que conversa com o Firestore/Auth.
import { useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import {
  addDoc, collection, collectionGroup, deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { ATENDIMENTOS, CLINICA_PADRAO, CONVENIOS_SUGERIDOS, MODELOS_PADRAO, type ChaveModelo, type Destinatario, type Paciente, type Tipo } from './domain'
import type { Linha } from './csv'

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
const OPCIONAIS = ['observacoes', 'responsavelNome', 'responsavelWhatsapp', 'convenio', 'atendimento'] as const

export async function salvaPaciente(id: string | null, d: Dados) {
  const dados: Record<string, unknown> = {
    nome: d.nome, whatsapp: d.whatsapp, nascimento: d.nascimento, arquivado: d.arquivado, destinatario: d.destinatario,
  }
  for (const k of OPCIONAIS) {
    const v = d[k]?.trim()
    if (v) dados[k] = v
    else if (id) dados[k] = deleteField() // limpar um campo ao editar remove-o do documento
  }
  if (id) await updateDoc(doc(db, 'pacientes', id), dados)
  else await addDoc(collection(db, 'pacientes'), { ...dados, criadoEm: serverTimestamp() })
}

/** Importa em lotes de 400 (limite do Firestore é 500 por batch). Ignora quem já existe (mesmo nome + WhatsApp). */
export async function importaPacientes(linhas: Linha[], existentes: Paciente[]): Promise<{ novos: number; repetidos: number }> {
  const chave = (n: string, w: string) => `${n.trim().toLowerCase()}|${w}`
  const tem = new Set(existentes.map((p) => chave(p.nome, p.whatsapp)))
  const novas = linhas.filter((l) => !tem.has(chave(l.nome, l.whatsapp)) && tem.add(chave(l.nome, l.whatsapp)))
  for (let i = 0; i < novas.length; i += 400) {
    const b = writeBatch(db)
    novas.slice(i, i + 400).forEach((l) =>
      b.set(doc(collection(db, 'pacientes')), {
        nome: l.nome, whatsapp: l.whatsapp, nascimento: l.nascimento, arquivado: false, destinatario: 'paciente',
        ...(l.convenio ? { convenio: l.convenio } : {}), criadoEm: serverTimestamp(),
      }),
    )
    await b.commit()
  }
  return { novos: novas.length, repetidos: linhas.length - novas.length }
}
