import { useMemo, useState } from 'react'
import { entrarComGoogle, sair, salvaConfig, useConfig, useMensagens, usePacientes, useSessao } from './data'
import { aniversariantes, formataTelefone, hojeSP, type Filtro, type Paciente, type Tipo } from './domain'
import { ConfigModal, ImportarModal, ListaModal, MensagemModal, PacienteModal, PerfilModal } from './modals'
import { btn, cls } from './ui'

const Marca = () => (
  <div className="text-center">
    <p className="font-script text-4xl text-ouro">Bárbara Rabelo</p>
    <p className="font-serif text-sm tracking-[0.3em]">FONOAUDIOLOGIA</p>
  </div>
)

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

  if (estado === 'carregando') return <Tela><p className="text-sm text-tinta/50">Carregando…</p></Tela>
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
  const ehHoje = (p: Paciente) => p.nascimento.slice(5) === `${String(hoje.m).padStart(2, '0')}-${String(hoje.d).padStart(2, '0')}`

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2 py-3">
        <Marca />
        <div className="flex items-center gap-1 text-sm">
          <button className="min-h-11 px-2 text-tinta/60" title={email} onClick={sair}>Sair</button>
          <div className="relative">
            <button aria-label="Menu" aria-expanded={menu} className="flex size-11 flex-col items-center justify-center gap-1.5" onClick={() => setMenu(!menu)}>
              <span className="h-0.5 w-6 bg-tinta" /><span className="h-0.5 w-6 bg-tinta" /><span className="h-0.5 w-6 bg-tinta" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <nav className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-2xl border border-ouro/40 bg-white shadow-lg">
                  {([['config', 'Gerenciar mensagens'], ['planos', 'Planos de saúde'], ['servicos', 'Serviços']] as const).map(([t, rotulo]) => (
                    <button key={t} className="block min-h-12 w-full px-4 text-left hover:bg-ouro-claro" onClick={() => { setMenu(false); setAberto({ t }) }}>
                      {rotulo}
                    </button>
                  ))}
                </nav>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mt-4 rounded-3xl border border-ouro/40 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold">🎂 Aniversariantes</h2>
          <div className="flex rounded-full border border-tinta/15 p-0.5 text-sm">
            {(['hoje', 'semana', 'mes'] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={cls('min-h-10 rounded-full px-3', filtro === f ? 'bg-tinta text-white' : 'text-tinta/70')}
              >
                {{ hoje: 'Hoje', semana: 'Semana', mes: 'Mês' }[f]}
              </button>
            ))}
          </div>
        </div>
        {aniv.length === 0 ? (
          <p className="py-4 text-sm text-tinta/50">Nenhum aniversariante {{ hoje: 'hoje', semana: 'nesta semana', mes: 'neste mês' }[filtro]}.</p>
        ) : (
          <ul className="divide-y divide-tinta/10">
            {aniv.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-sm text-tinta/60">
                    {ehHoje(p) ? 'Hoje! 🎉' : dia(p.nascimento)}
                    {p.destinatario === 'responsavel' && ' · ao responsável'}
                    {parabensEnviado(p) && <span className="font-medium text-ouro"> · ✓ enviado</span>}
                  </p>
                </div>
                <button className={cls(btn.base, parabensEnviado(p) ? btn.linha : btn.ouro, 'shrink-0')} onClick={() => setAberto({ t: 'msg', p, tipo: 'aniversario' })}>
                  {parabensEnviado(p) ? 'Reenviar' : 'Parabéns'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold">Pacientes {pacientes && <span className="text-base text-tinta/50">({lista.filter((p) => !p.arquivado).length})</span>}</h2>
          <div className="flex gap-2">
            <button className={cls(btn.base, btn.linha)} onClick={() => setAberto({ t: 'importar' })}>Importar Word</button>
            <button className={cls(btn.base, btn.preto)} onClick={() => setAberto({ t: 'novo' })}>+ Novo paciente</button>
          </div>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          type="search"
          placeholder="Buscar por nome ou telefone"
          className="mb-3 min-h-12 w-full rounded-xl border border-tinta/20 px-4 focus:border-ouro focus:outline-none"
        />
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {[false, true].map((a) => (
            <button key={String(a)} onClick={() => setArquivados(a)} className={cls('min-h-10', arquivados === a ? 'border-b-2 border-ouro font-medium' : 'text-tinta/60')}>
              {a ? 'Arquivados' : 'Ativos'}
            </button>
          ))}
          {convenios.length > 0 && (
            <select value={convenio} onChange={(e) => setConvenio(e.target.value)} aria-label="Filtrar por convênio" className="ml-auto min-h-10 rounded-full border border-tinta/20 bg-white px-3 text-base">
              <option value="">Todos os convênios</option>
              {convenios.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>
        {pacientes === null ? (
          <p className="py-6 text-sm text-tinta/50">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p className="py-6 text-sm text-tinta/50">{lista.length === 0 ? 'Nenhum paciente ainda. Cadastre o primeiro ou importe uma planilha.' : 'Nada encontrado.'}</p>
        ) : (
          <ul className="divide-y divide-tinta/10">
            {visiveis.map((p) => (
              <li key={p.id}>
                <button onClick={() => setAberto({ t: 'perfil', p })} className="flex min-h-16 w-full items-center justify-between gap-3 py-2 text-left">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.nome}</span>
                    <span className="block truncate text-sm text-tinta/60">
                      {formataTelefone(p.whatsapp || p.responsavelWhatsapp || '')}
                      {p.convenio && ` · ${p.convenio}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-tinta/60">{ehHoje(p) && '🎂 '}{dia(p.nascimento)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aberto?.t === 'novo' && <PacienteModal paciente={null} planos={planos} servicos={config.servicos} onClose={() => setAberto(null)} />}
      {aberto?.t === 'editar' && <PacienteModal paciente={aberto.p} planos={planos} servicos={config.servicos} onClose={() => setAberto(null)} />}
      {aberto?.t === 'planos' && (
        <ListaModal
          titulo="Planos de saúde"
          descricao="Os planos e convênios que a clínica atende. Eles aparecem como sugestão ao cadastrar um paciente."
          itens={config.planos}
          onSalvar={(planos) => salvaConfig({ ...config, planos })}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.t === 'servicos' && (
        <ListaModal
          titulo="Serviços"
          descricao="Os tipos de atendimento da clínica. Remover um serviço daqui não altera pacientes já cadastrados."
          itens={config.servicos}
          onSalvar={(servicos) => salvaConfig({ ...config, servicos })}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.t === 'perfil' && (
        <PerfilModal
          paciente={aberto.p}
          mensagens={mensagens.get(aberto.p.id) ?? []}
          onMensagem={(tipo) => setAberto({ t: 'msg', p: aberto.p, tipo })}
          onEditar={() => setAberto({ t: 'editar', p: aberto.p })}
          onClose={() => setAberto(null)}
        />
      )}
      {aberto?.t === 'importar' && <ImportarModal existentes={lista} onClose={() => setAberto(null)} />}
      {aberto?.t === 'config' && <ConfigModal config={config} onClose={() => setAberto(null)} />}
      {aberto?.t === 'msg' && <MensagemModal paciente={aberto.p} tipo={aberto.tipo} config={config} onClose={() => setAberto(null)} />}
    </div>
  )
}
