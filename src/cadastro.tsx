// Formulário público (sem login) aberto pelo link ?cadastro=TOKEN que a equipe envia ao paciente.
import { useEffect, useState } from 'react'
import { buscaConvite, enviaCadastro } from './data'
import { hojeSP, idadeEm, normalizaNascimento, normalizaTelefone } from './domain'
import { btn, Campo, cls, Erro } from './ui'

const caixa = 'min-h-12 w-full rounded-xl border border-tinta/20 bg-white px-4 focus:border-ouro focus:outline-none'

type Estado = 'carregando' | 'invalido' | 'pronto' | 'enviado'

export default function CadastroPublico({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [planos, setPlanos] = useState<string[]>([])
  const [nome, setNome] = useState('')
  const [nasc, setNasc] = useState('')
  const [tel, setTel] = useState('')
  const [endereco, setEndereco] = useState('')
  const [convenio, setConvenio] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    buscaConvite(token).then((c) => {
      if (c) { setPlanos(c.planos); setEstado('pronto') } else setEstado('invalido')
    })
  }, [token])

  const nascISO = normalizaNascimento(nasc)
  const idade = nascISO ? idadeEm(nascISO, hojeSP()) : null

  async function enviar() {
    const whatsapp = normalizaTelefone(tel)
    if (!nome.trim()) return setErro('Informe seu nome completo.')
    if (!nascISO) return setErro('Informe sua data de nascimento.')
    if (!whatsapp) return setErro('Informe seu WhatsApp com DDD, ex.: (31) 99999-9999.')
    if (!endereco.trim()) return setErro('Informe seu endereço.')
    setErro('')
    setEnviando(true)
    try {
      await enviaCadastro(token, {
        nome: nome.trim(), whatsapp, nascimento: nascISO, arquivado: false, destinatario: 'paciente',
        endereco: endereco.trim(), convenio: convenio.trim(),
      })
      setEstado('enviado')
    } catch {
      setErro('Não foi possível enviar. Verifique a conexão e tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="font-script text-4xl text-ouro">Bárbara Rabelo</p>
        <p className="font-serif text-sm tracking-[0.3em]">FONOAUDIOLOGIA</p>
      </div>

      {estado === 'carregando' && <p className="text-center text-sm text-tinta/60">Carregando…</p>}

      {estado === 'invalido' && (
        <div className="rounded-3xl border border-tinta/15 p-6 text-center">
          <p className="font-serif text-2xl font-semibold">Link indisponível</p>
          <p className="mt-2 text-sm text-tinta/70">Este link já foi usado ou não existe mais. Peça um novo link à clínica.</p>
        </div>
      )}

      {estado === 'enviado' && (
        <div className="rounded-3xl border border-ouro/40 p-6 text-center">
          <p className="font-serif text-2xl font-semibold">Cadastro recebido</p>
          <p className="mt-2 text-sm text-tinta/70">Obrigada! Seus dados foram enviados para a clínica.</p>
        </div>
      )}

      {estado === 'pronto' && (
        <form
          className="rounded-3xl border border-ouro/40 p-5 sm:p-6"
          onSubmit={(e) => { e.preventDefault(); enviar() }}
        >
          <h1 className="mb-1 font-serif text-2xl font-semibold">Seu cadastro</h1>
          <p className="mb-5 text-sm text-tinta/70">Preencha os dados abaixo. Leva menos de 1 minuto.</p>
          <Erro>{erro}</Erro>

          <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
          <Campo
            rotulo="Data de nascimento"
            type="date"
            value={nasc}
            onChange={(e) => setNasc(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
            dica={idade !== null ? `Idade: ${idade} ${idade === 1 ? 'ano' : 'anos'}` : undefined}
          />
          <Campo rotulo="WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="(31) 99999-9999" required />
          <Campo rotulo="Endereço completo" value={endereco} onChange={(e) => setEndereco(e.target.value)} autoComplete="street-address" required />

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium">Plano de saúde</span>
            <input list="planos-cadastro" value={convenio} onChange={(e) => setConvenio(e.target.value)} className={caixa} placeholder="Particular ou nome do plano" />
            <datalist id="planos-cadastro">{planos.map((c) => <option key={c} value={c} />)}</datalist>
          </label>

          <button type="submit" disabled={enviando} className={cls(btn.base, btn.preto, 'mt-2 w-full')}>
            {enviando ? 'Enviando…' : 'Enviar cadastro'}
          </button>
        </form>
      )}
    </main>
  )
}
