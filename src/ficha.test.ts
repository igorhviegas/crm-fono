import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { extraiFicha, lerDocx } from './ficha'

// Só dados FICTÍCIOS, no mesmo formato das fichas reais.
const hoje = { a: 2026, m: 10, d: 27 }
const para = (...ps: string[]) => ({ paragrafos: ps })

describe('ficha de fonoterapia (sem DT no cabeçalho)', () => {
  const doc = {
    ...para(
      'Maria Exemplo da Silva – 6 anos – DN 08/05/2019',
      'QP: atraso na fala.',
      'Joana mãe, PA alta.',
      'Mãe relata que melhorou.', // não é nome de responsável
      '24/07/2025 M F',
      '14/08/2026 Articulação imprecisa.',
      'Fonoaudiologia',
      '15/07/25',
    ),
    criado: '2025-07-15',
    modificado: '2026-08-14',
  }
  it('usa a data de criação do arquivo como primeiro atendimento e a mais recente do texto como último', () => {
    expect(extraiFicha(doc, hoje)).toMatchObject({
      nome: 'Maria Exemplo da Silva', nascimento: '2019-05-08',
      primeiroAtendimento: '2025-07-15', origemPrimeiro: 'arquivo', ultimoAtendimento: '2026-08-14',
      atendimento: 'Fonoterapia', responsavelNome: 'Joana', destinatario: 'responsavel',
    })
  })
})

describe('laudo de audiometria (com DT)', () => {
  const doc = {
    ...para(
      'João Exemplo Souza – 60 anos , DN 26/10/1964',
      'DT 15/09/2025',
      'AUDIOMETRIA: OE: PERDA AUDITIVA.',
      'OTOSCOPIA: SEM OBSTRUÇÃO. CALIBRAÇÃO: 29/10/2024.',
    ),
    criado: '2025-09-14',
  }
  it('prioriza o DT do documento e ignora a data de calibração', () => {
    expect(extraiFicha(doc, hoje)).toMatchObject({
      primeiroAtendimento: '2025-09-15', origemPrimeiro: 'documento', ultimoAtendimento: '2025-09-15',
      atendimento: 'Audiometria', responsavelNome: undefined, destinatario: 'paciente',
    })
  })
})

describe('casos de borda', () => {
  it('rejeita ficha sem DN na primeira linha', () => {
    expect(extraiFicha(para('Fulano de Tal – 30 anos'), hoje)).toHaveProperty('erro')
  })
  it('ignora datas no futuro e antes do nascimento', () => {
    const f = extraiFicha({ ...para('Ana Exemplo – DN 01/01/2000', '01/01/1990 erro', '01/01/2030 erro', '10/10/2024 ok') }, hoje)
    expect(f).toMatchObject({ ultimoAtendimento: '2024-10-10' })
  })
  it('sem nenhuma data no texto usa as datas do arquivo', () => {
    expect(extraiFicha({ ...para('Ana Exemplo – DN 01/01/2000'), criado: '2025-01-02', modificado: '2025-03-04' }, hoje))
      .toMatchObject({ primeiroAtendimento: '2025-01-02', ultimoAtendimento: '2025-01-02' })
  })
})

describe('leitura do .docx', () => {
  it('extrai parágrafos (com entidades XML) e datas internas do arquivo', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Ana &amp; Cia – DN 01/01/2000</w:t></w:r></w:p><w:p><w:pPr/><w:r><w:t>DT 02/02/2025</w:t></w:r></w:p></w:body></w:document>'
    const core = '<cp:coreProperties><dcterms:created xsi:type="dcterms:W3CDTF">2025-02-01T10:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2025-03-01T10:00:00Z</dcterms:modified></cp:coreProperties>'
    const zip = zipSync({ 'word/document.xml': strToU8(xml), 'docProps/core.xml': strToU8(core) })
    expect(lerDocx(zip)).toEqual({ paragrafos: ['Ana & Cia – DN 01/01/2000', 'DT 02/02/2025'], criado: '2025-02-01', modificado: '2025-03-01' })
  })
  it('recusa arquivo que não é docx', () => {
    expect(() => lerDocx(strToU8('texto qualquer'))).toThrow()
  })
})
