import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, collectionGroup, getDocs, serverTimestamp } from 'firebase/firestore'

// Roda com: npm run test:rules (sobe o emulador do Firestore). Só dados fictícios.
let env: RulesTestEnvironment
const ok = { nome: 'Paciente Teste', whatsapp: '5531999999999', nascimento: '2015-03-05', arquivado: false, destinatario: 'paciente' }

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-crm-fono',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'membros/barbara@exemplo.com'), { papel: 'admin' })
    await setDoc(doc(c.firestore(), 'pacientes/p1'), ok)
  })
})
afterAll(() => env.cleanup())

const como = (email: string, verificado = true) => env.authenticatedContext('u-' + email, { email, email_verified: verificado }).firestore()

describe('Firestore rules', () => {
  it('não autenticado não lê nem escreve', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'pacientes/p1')))
    await assertFails(getDocs(collection(db, 'pacientes')))
    await assertFails(setDoc(doc(db, 'pacientes/x'), ok))
  })
  it('conta Google fora da lista não acessa nada', async () => {
    const db = como('estranho@gmail.com')
    await assertFails(getDoc(doc(db, 'pacientes/p1')))
    await assertFails(setDoc(doc(db, 'pacientes/x'), ok))
    await assertFails(setDoc(doc(db, 'membros/estranho@gmail.com'), { papel: 'admin' }))
  })
  it('e-mail não verificado é recusado mesmo estando na lista', async () => {
    await assertFails(getDoc(doc(como('barbara@exemplo.com', false), 'pacientes/p1')))
  })
  it('membro autorizado lê, cria, edita e arquiva', async () => {
    const db = como('barbara@exemplo.com')
    await assertSucceeds(getDoc(doc(db, 'pacientes/p1')))
    await assertSucceeds(setDoc(doc(db, 'pacientes/p2'), ok))
    await assertSucceeds(setDoc(doc(db, 'pacientes/p2'), { ...ok, arquivado: true }))
  })
  it('valida campos e nunca permite exclusão', async () => {
    const db = como('barbara@exemplo.com')
    await assertFails(setDoc(doc(db, 'pacientes/p3'), { ...ok, whatsapp: '123' }))
    await assertFails(setDoc(doc(db, 'pacientes/p3'), { ...ok, cpf: '000' }))
    await assertFails(deleteDoc(doc(db, 'pacientes/p1')))
  })
  it('responsável, convênio e datas de atendimento; WhatsApp pode faltar mas nunca ser inválido', async () => {
    const db = como('barbara@exemplo.com')
    const crianca = { ...ok, whatsapp: '', destinatario: 'responsavel', responsavelNome: 'Ana', responsavelWhatsapp: '5531911112222', convenio: 'Amagis Saúde', atendimento: 'Fonoterapia', primeiroAtendimento: '2025-07-15', ultimoAtendimento: '2026-08-14' }
    await assertSucceeds(setDoc(doc(db, 'pacientes/c1'), crianca))
    await assertSucceeds(setDoc(doc(db, 'pacientes/c2'), { ...ok, whatsapp: '' })) // importado de ficha Word, sem telefone
    await assertFails(setDoc(doc(db, 'pacientes/c3'), { ...ok, whatsapp: '123' }))
    await assertFails(setDoc(doc(db, 'pacientes/c4'), { ...crianca, destinatario: 'outro' }))
    await assertFails(setDoc(doc(db, 'pacientes/c5'), { ...crianca, ultimoAtendimento: '14/08/2026' }))
  })
  it('histórico de mensagens: cria como link_aberto, confirma, nunca apaga nem inventa envio', async () => {
    const db = como('barbara@exemplo.com')
    const m = doc(db, 'pacientes/p1/mensagens/m1')
    await assertFails(setDoc(m, { tipo: 'retorno', destinatario: 'paciente', status: 'envio_confirmado', criadoEm: serverTimestamp() }))
    await assertFails(setDoc(m, { tipo: 'retorno', destinatario: 'paciente', status: 'link_aberto', criadoEm: serverTimestamp(), texto: 'x' }))
    await assertSucceeds(setDoc(m, { tipo: 'retorno', destinatario: 'paciente', status: 'link_aberto', criadoEm: serverTimestamp() }))
    await assertSucceeds(updateDoc(m, { status: 'envio_confirmado' }))
    await assertFails(updateDoc(m, { tipo: 'aniversario' }))
    await assertFails(deleteDoc(m))
    await assertSucceeds(getDocs(collectionGroup(db, 'mensagens')))
    await assertFails(getDocs(collectionGroup(como('estranho@gmail.com'), 'mensagens')))
    await assertFails(getDocs(collectionGroup(env.unauthenticatedContext().firestore(), 'mensagens')))
  })
  it('config só aceita os campos previstos', async () => {
    const db = como('barbara@exemplo.com')
    await assertSucceeds(setDoc(doc(db, 'config/clinica'), { nomeClinica: 'X', modeloAniversario: 'Oi {nome}' }))
    await assertFails(setDoc(doc(db, 'config/clinica'), { nomeClinica: 'X', modeloAniversario: 'a', extra: 1 }))
    await assertSucceeds(setDoc(doc(db, 'config/clinica'), { nomeClinica: 'X', modeloAniversario: 'a', planos: ['IPSM'], servicos: ['Audiometria'] }))
    await assertFails(setDoc(doc(db, 'config/clinica'), { nomeClinica: 'X', planos: 'IPSM' }))
  })
})
