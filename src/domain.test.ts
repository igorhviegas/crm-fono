import { describe, expect, it } from 'vitest'
import {
  aniversariantes, diasAteAniversario, linkWhatsApp, montaMensagem, normalizaNascimento,
  normalizaTelefone, variaveisInvalidas, vencimentoRetorno, retornosDoMes, destinatarioDe, chaveModelo, type Paciente,
} from './domain'

const p = (nome: string, nascimento: string, arquivado = false): Paciente => ({
  id: nome, nome, nascimento, arquivado, whatsapp: '5531997115766', destinatario: 'paciente',
})

describe('telefone', () => {
  it('normaliza formatos comuns', () => {
    expect(normalizaTelefone('(31) 99711-5766')).toBe('5531997115766')
    expect(normalizaTelefone('+55 31 3333-4444')).toBe('553133334444')
    expect(normalizaTelefone('031997115766')).toBe('5531997115766')
  })
  it('rejeita inválidos', () => {
    expect(normalizaTelefone('12345')).toBeNull()
    expect(normalizaTelefone('')).toBeNull()
  })
})

describe('nascimento', () => {
  it('aceita DD/MM/AAAA e ISO', () => {
    expect(normalizaNascimento('5/3/2015')).toBe('2015-03-05')
    expect(normalizaNascimento('2015-03-05')).toBe('2015-03-05')
  })
  it('rejeita datas impossíveis', () => {
    expect(normalizaNascimento('31/02/2015')).toBeNull()
    expect(normalizaNascimento('29/02/2023')).toBeNull()
    expect(normalizaNascimento('abc')).toBeNull()
  })
})

describe('aniversários', () => {
  it('ignora o ano de nascimento', () => {
    const hoje = { a: 2026, m: 10, d: 21 }
    expect(diasAteAniversario('1990-10-21', hoje)).toBe(0)
    expect(diasAteAniversario('2020-10-22', hoje)).toBe(1)
    expect(diasAteAniversario('2020-10-20', hoje)).toBe(364)
  })
  it('virada de ano', () => {
    expect(diasAteAniversario('2000-01-02', { a: 2026, m: 12, d: 30 })).toBe(3)
  })
  it('29/02 cai em 28/02 em ano não bissexto e em 29/02 em bissexto', () => {
    expect(diasAteAniversario('2016-02-29', { a: 2027, m: 2, d: 28 })).toBe(0)
    expect(diasAteAniversario('2016-02-29', { a: 2028, m: 2, d: 28 })).toBe(1)
    expect(diasAteAniversario('2016-02-29', { a: 2028, m: 2, d: 29 })).toBe(0)
  })
  it('filtros hoje / semana / mês, sem arquivados', () => {
    const hoje = { a: 2026, m: 10, d: 21 }
    const ps = [p('A', '2000-10-21'), p('B', '2000-10-27'), p('C', '2000-10-28'), p('D', '2000-10-05'), p('E', '2000-10-21', true)]
    expect(aniversariantes(ps, 'hoje', hoje).map((x) => x.nome)).toEqual(['A'])
    expect(aniversariantes(ps, 'semana', hoje).map((x) => x.nome)).toEqual(['A', 'B'])
    expect(aniversariantes(ps, 'mes', hoje).map((x) => x.nome)).toEqual(['D', 'A', 'B', 'C'])
  })
})

describe('mensagem', () => {
  it('usa primeiro nome e clínica', () => {
    expect(montaMensagem('Oi {nome}, {clinica}', 'Maria da Silva', 'Clínica X')).toBe('Oi Maria, Clínica X')
  })
  it('detecta variáveis desconhecidas', () => {
    expect(variaveisInvalidas('{nome} {paciente} {clinica} {cpf}')).toEqual(['cpf'])
  })
  it('{paciente} difere de {nome} quando o destinatário é o responsável', () => {
    expect(montaMensagem('{nome} / {paciente}', 'Ana Souza', 'C', 'Pedro Souza')).toBe('Ana / Pedro')
  })
  it('escolhe o destinatário e o modelo certos', () => {
    const crianca: Paciente = { ...p('Pedro Souza', '2018-05-01'), whatsapp: '', destinatario: 'responsavel', responsavelNome: 'Ana Souza', responsavelWhatsapp: '5531911112222' }
    expect(destinatarioDe(crianca)).toEqual({ nome: 'Ana Souza', tel: '5531911112222', responsavel: true })
    expect(destinatarioDe(p('Maria', '2000-01-01')).responsavel).toBe(false)
    expect(chaveModelo('retorno', true)).toBe('modeloRetornoResp')
    expect(chaveModelo('aniversario', false)).toBe('modeloAniversario')
  })
  it('gera link wa.me codificado', () => {
    expect(linkWhatsApp('5531997115766', 'Olá! 🎉')).toBe('https://wa.me/5531997115766?text=Ol%C3%A1!%20%F0%9F%8E%89')
  })
})

describe('lembrete de retorno', () => {
  const r = (ultimo: string, meses: number, arquivado = false): Paciente => ({ ...p('X', '2000-01-01', arquivado), ultimoAtendimento: ultimo, lembreteMeses: meses })
  it('soma meses ao último atendimento, com virada de ano e mês curto', () => {
    expect(vencimentoRetorno(r('2026-04-10', 6))).toBe('2026-10-10')
    expect(vencimentoRetorno(r('2026-11-15', 3))).toBe('2027-02-15')
    expect(vencimentoRetorno(r('2026-08-31', 1))).toBe('2026-09-30')
    expect(vencimentoRetorno(p('Sem', '2000-01-01'))).toBeNull()
  })
  it('lista só quem vence no mês e não está arquivado', () => {
    const hoje = { a: 2026, m: 10, d: 21 }
    const ps = [r('2026-04-25', 6), r('2026-04-05', 6), r('2026-04-25', 5), r('2026-04-25', 6, true)]
    expect(retornosDoMes(ps, hoje).map((x) => x.vence)).toEqual(['2026-10-05', '2026-10-25'])
  })
})
