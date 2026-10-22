// Único módulo que conversa com o Firestore/Auth.
import { useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { auth, db } from './firebase'
import { CLINICA_PADRAO, MODELO_PADRAO, type Paciente } from './domain'
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
      setPs(q.docs.map((d) => ({ arquivado: false, ...d.data(), id: d.id }) as Paciente).sort((a, b) => a.nome.localeCompare(b.nome))),
    )
  }, [ativo])
  return ps
}

export type Config = { nomeClinica: string; modeloAniversario: string }

export function useConfig(ativo: boolean): Config {
  const [c, setC] = useState<Config>({ nomeClinica: CLINICA_PADRAO, modeloAniversario: MODELO_PADRAO })
  useEffect(() => {
    if (!ativo) return
    return onSnapshot(doc(db, 'config', 'clinica'), (d) => d.exists() && setC({ ...c, ...(d.data() as Config) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo])
  return c
}

export const salvaConfig = (c: Config) => setDoc(doc(db, 'config', 'clinica'), c)

type Dados = Omit<Paciente, 'id'>

export async function salvaPaciente(id: string | null, d: Dados) {
  const limpo = { ...d, observacoes: d.observacoes?.trim() || undefined }
  if (!limpo.observacoes) delete limpo.observacoes
  if (id) await updateDoc(doc(db, 'pacientes', id), limpo)
  else await addDoc(collection(db, 'pacientes'), { ...limpo, criadoEm: serverTimestamp() })
}

/** Importa em lotes de 400 (limite do Firestore é 500 por batch). Ignora quem já existe (mesmo nome + WhatsApp). */
export async function importaPacientes(linhas: Linha[], existentes: Paciente[]): Promise<{ novos: number; repetidos: number }> {
  const chave = (n: string, w: string) => `${n.trim().toLowerCase()}|${w}`
  const tem = new Set(existentes.map((p) => chave(p.nome, p.whatsapp)))
  const novas = linhas.filter((l) => !tem.has(chave(l.nome, l.whatsapp)) && tem.add(chave(l.nome, l.whatsapp)))
  for (let i = 0; i < novas.length; i += 400) {
    const b = writeBatch(db)
    novas.slice(i, i + 400).forEach((l) => b.set(doc(collection(db, 'pacientes')), { ...l, arquivado: false, criadoEm: serverTimestamp() }))
    await b.commit()
  }
  return { novos: novas.length, repetidos: linhas.length - novas.length }
}
