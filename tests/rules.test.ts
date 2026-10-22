import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'

// Roda com: npm run test:rules (sobe o emulador do Firestore). Só dados fictícios.
let env: RulesTestEnvironment
const ok = { nome: 'Paciente Teste', whatsapp: '5531999999999', nascimento: '2015-03-05', arquivado: false }

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
  it('config só aceita os campos previstos', async () => {
    const db = como('barbara@exemplo.com')
    await assertSucceeds(setDoc(doc(db, 'config/clinica'), { nomeClinica: 'X', modeloAniversario: 'Oi {nome}' }))
    await assertFails(setDoc(doc(db, 'config/clinica'), { nomeClinica: 'X', modeloAniversario: 'a', extra: 1 }))
  })
})
