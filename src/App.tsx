import { useEffect, useMemo, useState } from 'react'
import { entrarComGoogle, sair, salvaConfig, useConfig, useMensagens, usePacientes, useSessao } from './data'
import { aniversariantes, destinatarioDe, diasAteAniversario, formataTelefone, hojeSP, primeiroNome, type Filtro, type Paciente, type Tipo } from './domain'
import { ConfigModal, ImportarModal, ListaModal, MensagemModal, PacienteModal, PerfilModal } from './modals'
import { btn, cls } from './ui'

const Marca = ({ alinha = 'text-center' }: { alinha?: string }) => (
  <div className={alinha}>
    <p className="font-script text-4xl text-ouro">Bárbara Rabelo</p>
    <p className="font-serif text-sm tracking-[0.3em]">FONOAUDIOLOGIA</p>
  </div>
)

const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}
const Avatar = ({ nome }: { nome: string }) => (
  <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ouro-claro font-serif text-[17px] font-semibold">{iniciais(nome)}</span>
)

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** O painel lateral do paciente só cabe a partir de 1024px; abaixo disso perfil e mensagem abrem como janela. */
function useDesktop() {
  const q = '(min-width: 1024px)'
  const [v, setV] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setV(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return v
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <Marca />
      {children}
    </main>
  )
}

export default function App() {
  const { estado, user } = useSessao()
  const [erroLogin, setErroLogin] = useState('')

  if (estado === 'carregando') return <Tela><p className="text-sm text-tinta/60">Carregando…</p></Tela>
  if (estado === 'deslogada')
    return (
      <Tela>
        <button
          className={cls(btn.base, btn.preto, 'w-full')}
          onClick={() => entrarComGoogle().catch(() => setErroLogin('Não foi possível entrar. Tente novamente.'))}
        >
          Entrar com Google
        </button>
        {erroLogin && <p role="alert" className="text-sm text-red-700">{erroLogin}</p>}
      </Tela>
    )
  if (estado === 'sem-acesso')
    return (
      <Tela>
        <p className="text-sm">
          A conta <b>{user?.email}</b> não tem acesso a este sistema. Peça à responsável para liberar o seu e-mail.
        </p>
        <button className={cls(btn.base, btn.linha)} onClick={sair}>Sair</button>
      </Tela>
    )
  return <Painel email={user!.email!} />
}

type Aberto =
  | { t: 'novo' } | { t: 'editar'; p: Paciente } | { t: 'importar' } | { t: 'config' } | { t: 'planos' } | { t: 'servicos' }
  | { t: 'perfil'; p: Paciente } | { t: 'msg'; p: Paciente; tipo: Tipo }
  | null

function Painel({ email }: { email: string }) {
  const pacientes = usePacientes(true)
  const config = useConfig(true)
  const mensagens = useMensagens(true)
  const [filtro, setFiltro] = useState<Filtro>('semana')
  const [busca, setBusca] = useState('')
  const [convenio, setConvenio] = useState('')
  const [arquivados, setArquivados] = useState(false)
  const [menu, setMenu] = useState(false)
  const [aberto, setAberto] = useState<Aberto>(null)
  const desktop = useDesktop()
  const hoje = hojeSP()

  const lista = pacientes ?? []
  const aniv = useMemo(() => aniversariantes(lista, filtro, hoje), [lista, filtro, hoje.d, hoje.m]) // eslint-disable-line react-hooks/exhaustive-deps
  const q = busca.trim().toLowerCase()
  const qDigitos = q.replace(/\D/g, '')
  const convenios = [...new Set(lista.map((p) => p.convenio).filter(Boolean) as string[])].sort()
  const planos = [...new Set([...config.planos, ...convenios])] // inclui planos já usados mesmo que removidos da lista
  const visiveis = lista.filter(
    (p) =>
      p.arquivado === arquivados &&
      (!convenio || p.convenio === convenio) &&
      (!q || p.nome.toLowerCase().includes(q) || (qDigitos && (p.whatsapp + (p.responsavelWhatsapp ?? '')).includes(qDigitos))),
  )
  // "Parabéns enviado" só vale com envio confirmado neste ano; link aberto não conta como enviado.
  const parabensEnviado = (p: Paciente) =>
    mensagens.get(p.id)?.some((m) => m.tipo === 'aniversario' && m.status === 'envio_confirmado' && m.criadoEm.getFullYear() === hoje.a)
  const dia = (n: string) => `${n.slice(8)}/${n.slice(5, 7)}`
  const ehHoje = (p: Paciente) => diasAteAniversario(p.nascimento, hoje) === 0
  const quando = (p: Paciente) => {
    const dias = diasAteAniversario(p.nascimento, hoje)
    if (dias === 0) return `Hoje · faz ${hoje.a - +p.nascimento.slice(0, 4)} anos`
    // o filtro "mês" inclui dias já passados, que diasAteAniversario conta para o ano seguinte
    if (+p.nascimento.slice(5, 7) === hoje.m && +p.nascimento.slice(8) < hoje.d) return 'Já passou'
    return dias === 1 ? 'Amanhã' : `Em ${dias} dias`
  }
  const semana = aniversariantes(lista, 'semana', hoje)
  const pendentes = semana.filter((p) => !parabensEnviado(p)).length
  const sp = { timeZone: 'America/Sao_Paulo' } as const
  const hora = +new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', ...sp }).format(new Date())
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const dataExtenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', ...sp }).format(new Date())
  const ativos = lista.filter((p) => !p.arquivado).length
  const fechar = () => setAberto(null)
  const nav = [['config', 'Modelos de mensagem'], ['planos', 'Planos de saúde'], ['servicos', 'Serviços']] as const
  const selecionado = aberto?.t === 'perfil' || aberto?.t === 'msg' ? aberto.p : null

  return (
    <div className="pb-24">
      <header className="border-b border-tinta/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-10">
          <Marca alinha="text-left" />
          <nav aria-label="Seções" className="hidden flex-1 gap-5 text-sm font-medium md:flex">
            <span aria-current="page" className="flex min-h-11 items-center border-b-2 border-ouro">Painel</span>
            {nav.map(([t, rotulo]) => (
              <button key={t} className="min-h-11 border-b-2 border-transparent text-tinta/60 hover:text-tinta" onClick={() => setAberto({ t })}>{rotulo}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden text-tinta/60 lg:inline">{email}</span>
            <button className={cls(btn.base, btn.linha, 'min-h-10 px-4')} title={email} onClick={sair}>Sair</button>
            <div className="relative md:hidden">
              <button aria-label="Menu" aria-expanded={menu} className="flex size-11 flex-col items-center justify-center gap-1.5" onClick={() => setMenu(!menu)}>
                <span className="h-0.5 w-6 bg-tinta" /><span className="h-0.5 w-6 bg-tinta" /><span className="h-0.5 w-6 bg-tinta" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                  <nav className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-2xl border border-ouro/40 bg-white shadow-lg">
                    {nav.map(([t, rotulo]) => (
                      <button key={t} className="block min-h-12 w-full px-4 text-left hover:bg-ouro-claro" onClick={() => { setMenu(false); setAberto({ t }) }}>
                        {rotulo}
                      </button>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pt-8 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm capitalize text-tinta/60">{dataExtenso}</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold sm:text-[40px] sm:leading-[48px]">{saudacao}, Bárbara</h1>
            <p className="mt-1 text-tinta/70">
              {semana.length === 1 ? '1 aniversário' : `${semana.length} aniversários`} nesta semana
              {pendentes ? `, ${pendentes} sem parabéns enviado.` : semana.length ? ', todos com parabéns enviado.' : '.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={cls(btn.base, btn.linha)} onClick={() => setAberto({ t: 'importar' })}>Importar Word</button>
            <button className={cls(btn.base, btn.preto)} onClick={() => setAberto({ t: 'novo' })}>+ Novo paciente</button>
          </div>
        </div>

        <section aria-labelledby="t-aniv" className="flex flex-col gap-5 rounded-3xl border border-ouro/40 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="t-aniv" className="font-serif text-2xl font-semibold">Aniversariantes</h2>
              <p className="text-sm text-tinta/60">
                {semana.filter(ehHoje).length} hoje · {semana.length} nos próximos 7 dias · {pendentes} pendente{pendentes === 1 ? '' : 's'}
              </p>
            </div>
            <div role="group" aria-label="Período" className="flex rounded-full border border-tinta/15 p-0.5 text-sm font-medium">
              {(['hoje', 'semana', 'mes'] as Filtro[]).map((f) => (
                <button
                  key={f}
                  aria-pressed={filtro === f}
                  onClick={() => setFiltro(f)}
                  className={cls('min-h-10 rounded-full px-4', filtro === f ? 'bg-tinta text-white' : 'text-tinta/70')}
                >
                  {{ hoje: 'Hoje', semana: 'Semana', mes: 'Mês' }[f]}
                </button>
              ))}
            </div>
          </div>
          {aniv.length === 0 ? (
            <p className="py-4 text-sm text-tinta/60">Nenhum aniversariante {{ hoje: 'hoje', semana: 'nesta semana', mes: 'neste mês' }[filtro]}.</p>
          ) : (
            <ul className="-mr-4 flex snap-x gap-3 overflow-x-auto pr-4 sm:mr-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:overflow-visible sm:pr-0">
              {aniv.map((p) => {
                const enviado = parabensEnviado(p)
                const hojeP = ehHoje(p)
                const d = destinatarioDe(p)
                return (
                  <li key={p.id} className={cls('flex w-60 shrink-0 snap-start flex-col gap-4 rounded-2xl border p-4 sm:w-auto', hojeP ? 'border-ouro bg-[#fbf8f1]' : 'border-tinta/15')}>
                    <div className="flex items-start gap-3">
                      <div className={cls('flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-xl', hojeP ? 'bg-ouro' : 'bg-ouro-claro')}>
                        <span className="font-serif text-[26px] font-semibold leading-[26px]">{p.nascimento.slice(8)}</span>
                        <span className="text-xs">{MESES[+p.nascimento.slice(5, 7) - 1]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-tinta/70">{quando(p)}</p>
                        <p className="truncate font-medium">{p.nome}</p>
                        <p className="truncate text-sm text-tinta/60">{d.responsavel ? `Para ${primeiroNome(d.nome)} (responsável)` : 'Para o paciente'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {enviado ? (
                        <span className="rounded-full bg-ouro-claro px-2.5 py-1 text-[13px] font-medium">✓ Enviado</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-tinta/20 px-2.5 py-1 text-[13px] text-tinta/70">
                          <span aria-hidden className="size-1.5 rounded-full bg-ouro" />Pendente
                        </span>
                      )}
                      <button className={cls(btn.base, enviado ? btn.linha : btn.ouro, 'min-h-10 px-4')} onClick={() => setAberto({ t: 'msg', p, tipo: 'aniversario' })}>
                        {enviado ? 'Reenviar' : 'Parabéns'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="t-pac" className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="t-pac" className="font-serif text-2xl font-semibold">Pacientes</h2>
              {pacientes && <span className="text-sm text-tinta/60">{ativos} ativo{ativos === 1 ? '' : 's'}</span>}
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              type="search"
              aria-label="Buscar paciente"
              placeholder="Buscar por nome ou telefone"
              className="min-h-12 w-full rounded-xl border border-tinta/20 px-4 focus:border-ouro focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <div role="group" aria-label="Situação" className="flex rounded-full border border-tinta/15 p-0.5">
                {[false, true].map((a) => (
                  <button key={String(a)} aria-pressed={arquivados === a} onClick={() => setArquivados(a)} className={cls('min-h-10 rounded-full px-3.5', arquivados === a ? 'bg-tinta text-white' : 'text-tinta/70')}>
                    {a ? 'Arquivados' : 'Ativos'}
                  </button>
                ))}
              </div>
              {convenios.length > 0 && (
                <select value={convenio} onChange={(e) => setConvenio(e.target.value)} aria-label="Filtrar por convênio" className="min-h-10 rounded-full border border-tinta/20 bg-white px-3.5 text-sm">
                  <option value="">Convênio: todos</option>
                  {convenios.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </div>
            {pacientes === null ? (
              <p className="py-6 text-sm text-tinta/60">Carregando…</p>
            ) : visiveis.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-tinta/20 px-4 py-8 text-center">
                <p>{lista.length === 0 ? 'Nenhum paciente ainda.' : 'Nada encontrado.'}</p>
                <p className="mt-1 text-sm text-tinta/60">{lista.length === 0 ? 'Cadastre o primeiro ou importe uma planilha.' : 'Confira a grafia ou limpe os filtros.'}</p>
                {lista.length > 0 && <button className={cls(btn.base, btn.linha, 'mt-3')} onClick={() => { setBusca(''); setConvenio('') }}>Limpar filtros</button>}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {visiveis.map((p) => {
                  const atual = selecionado?.id === p.id
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setAberto({ t: 'perfil', p })}
                        aria-current={atual || undefined}
                        className={cls('flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-ouro-claro', atual ? 'bg-ouro-claro' : '')}
                      >
                        <Avatar nome={p.nome} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.nome}</span>
                          <span className="block truncate text-sm text-tinta/60">
                            {formataTelefone(p.whatsapp || p.responsavelWhatsapp || '')}
                            {!p.whatsapp && ' (resp.)'}
                            {p.convenio && ` · ${p.convenio}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-tinta/60">{ehHoje(p) && 'Hoje · '}{dia(p.nascimento)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {desktop && (
            <aside aria-label="Paciente selecionado" className="min-w-0 flex-[1_1_420px]">
              {aberto?.t === 'perfil' && (
                <PerfilModal inline paciente={aberto.p} mensagens={mensagens.get(aberto.p.id) ?? []} onMensagem={(tipo) => setAberto({ t: 'msg', p: aberto.p, tipo })} onEditar={() => setAberto({ t: 'editar', p: aberto.p })} onClose={fechar} />
              )}
              {aberto?.t === 'msg' && <MensagemModal inline key={aberto.p.id + aberto.tipo} paciente={aberto.p} tipo={aberto.tipo} config={config} onClose={() => setAberto({ t: 'perfil', p: aberto.p })} />}
              {!selecionado && (
                <p className="rounded-3xl border border-tinta/15 px-6 py-12 text-center text-sm text-tinta/60">Escolha um paciente na lista para ver o cadastro e o histórico.</p>
              )}
            </aside>
          )}
        </section>
      </main>

      {aberto?.t === 'novo' && <PacienteModal paciente={null} planos={planos} servicos={config.servicos} onClose={fechar} />}
      {aberto?.t === 'editar' && <PacienteModal paciente={aberto.p} planos={planos} servicos={config.servicos} onClose={fechar} />}
      {aberto?.t === 'planos' && (
        <ListaModal
          titulo="Planos de saúde"
          descricao="Os planos e convênios que a clínica atende. Eles aparecem como sugestão ao cadastrar um paciente."
          itens={config.planos}
          onSalvar={(planos) => salvaConfig({ ...config, planos })}
          onClose={fechar}
        />
      )}
      {aberto?.t === 'servicos' && (
        <ListaModal
          titulo="Serviços"
          descricao="Os tipos de atendimento da clínica. Remover um serviço daqui não altera pacientes já cadastrados."
          itens={config.servicos}
          onSalvar={(servicos) => salvaConfig({ ...config, servicos })}
          onClose={fechar}
        />
      )}
      {!desktop && aberto?.t === 'perfil' && (
        <PerfilModal
          paciente={aberto.p}
          mensagens={mensagens.get(aberto.p.id) ?? []}
          onMensagem={(tipo) => setAberto({ t: 'msg', p: aberto.p, tipo })}
          onEditar={() => setAberto({ t: 'editar', p: aberto.p })}
          onClose={fechar}
        />
      )}
      {aberto?.t === 'importar' && <ImportarModal existentes={lista} onClose={fechar} />}
      {aberto?.t === 'config' && <ConfigModal config={config} onClose={fechar} />}
      {!desktop && aberto?.t === 'msg' && <MensagemModal paciente={aberto.p} tipo={aberto.tipo} config={config} onClose={fechar} />}
    </div>
  )
}
