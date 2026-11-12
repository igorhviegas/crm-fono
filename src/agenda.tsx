import { useState } from 'react'
import { apagaAgendamento, confirmaLembrete, salvaAgendamento, salvaConfig, salvaPaciente, type Config } from './data'
import {
  dataCurta, dataPorExtenso, destinatarioDe, DURACAO_PADRAO, duracaoDe, horaFim, variaveisInvalidas, formataTelefone, hojeSP, isoDe, linkWhatsApp, montaMensagem, normalizaTelefone, porHorario, semAcento, somaDias,
  type Agendamento, type Paciente,
} from './domain'
import { btn, Campo, cls, Erro, Modal } from './ui'

const caixa = 'min-h-12 w-full rounded-xl border border-tinta/20 bg-white px-4 focus:border-ouro focus:outline-none'
const msgErro = () => 'Não foi possível salvar. Verifique a conexão e tente novamente.'

/** Marcar ou editar uma consulta. Paciente existente é escolhido pelo nome; nome novo cria o cadastro junto. */
export function AgendarModal({ ag, ags, dataInicial, pacientes, planos, config, onClose }: {
  ag: Agendamento | null; ags: Agendamento[]; dataInicial: string; pacientes: Paciente[]; planos: string[]; config: Config; onClose: () => void
}) {
  const { servicos, duracoes } = config
  const [nome, setNome] = useState(ag?.nome ?? '')
  const [tel, setTel] = useState(ag?.whatsapp ? formataTelefone(ag.whatsapp) : '')
  const [data, setData] = useState(ag?.data ?? dataInicial)
  const [hora, setHora] = useState(ag?.hora ?? '')
  const [servico, setServico] = useState(ag?.servico ?? '')
  const [convenio, setConvenio] = useState(ag?.convenio ?? '')
  const [duracao, setDuracao] = useState(ag ? duracaoDe(ag, duracoes) : DURACAO_PADRAO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const achado = pacientes.find((p) => !p.arquivado && semAcento(p.nome) === semAcento(nome.trim()))
  const novo = !ag && !!nome.trim() && !achado

  function escolheNome(v: string) {
    setNome(v)
    const p = pacientes.find((x) => !x.arquivado && x.nome === v) // veio da lista de sugestões: preenche o resto
    if (!p) return
    const d = destinatarioDe(p)
    setTel(d.tel ? formataTelefone(d.tel) : '')
    setConvenio(p.convenio ?? '')
    escolheServico(p.atendimento ?? '')
  }

  /** Trocar o serviço puxa a duração dos Ajustes; ela continua editável. */
  function escolheServico(v: string) {
    setServico(v)
    setDuracao(duracoes[v] ?? DURACAO_PADRAO)
  }

  const fim = hora ? horaFim(hora, duracao) : ''
  const choque = hora ? ags.find((x) => x.id !== ag?.id && x.data === data && x.hora < fim && horaFim(x.hora, duracaoDe(x, duracoes)) > hora) : undefined

  async function salvar() {
    const whatsapp = tel.trim() ? normalizaTelefone(tel) : ''
    if (!nome.trim()) return setErro('Informe o nome do paciente.')
    if (whatsapp === null) return setErro('WhatsApp inválido. Use DDD + número, ex.: (31) 99711-5766.')
    if (!data) return setErro('Informe a data.')
    if (!hora) return setErro('Informe o horário.')
    setSalvando(true)
    try {
      let pacienteId = ag?.pacienteId ?? achado?.id
      let destNome = achado ? destinatarioDe(achado).nome : ag?.destNome || nome.trim()
      if (ag && ag.nome !== nome.trim()) destNome = nome.trim() // nome editado à mão: a confirmação vai para ele
      if (!pacienteId)
        pacienteId = await salvaPaciente(null, { nome: nome.trim(), whatsapp, nascimento: '', arquivado: false, destinatario: 'paciente', convenio: convenio || undefined })
      // mudou data/hora → a confirmação anterior não vale mais
      const mudou = !ag || ag.data !== data || ag.hora !== hora
      await salvaAgendamento(ag?.id ?? null, {
        pacienteId, nome: nome.trim(), destNome, whatsapp, data, hora, duracao, servico, convenio, confirmacaoEnviada: mudou ? false : ag!.confirmacaoEnviada,
      })
      onClose()
    } catch {
      setErro(msgErro())
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={ag ? 'Editar consulta' : 'Nova consulta'} onClose={onClose}>
      <Erro>{erro}</Erro>
      <Campo rotulo="Paciente" list="pacientes-agenda" value={nome} onChange={(e) => escolheNome(e.target.value)} autoComplete="off"
        dica={novo ? 'Paciente novo: o cadastro será criado junto (a data de nascimento e o resto ficam para depois).' : achado ? 'Paciente já cadastrado.' : 'Digite para buscar, ou escreva o nome de um paciente novo.'} />
      <datalist id="pacientes-agenda">{pacientes.filter((p) => !p.arquivado).map((p) => <option key={p.id} value={p.nome} />)}</datalist>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Campo rotulo="Horário" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </div>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Consulta / serviço</span>
        <select value={servico} onChange={(e) => escolheServico(e.target.value)} className={caixa}>
          <option value="">—</option>
          {[...new Set([...servicos, ...(servico ? [servico] : [])])].map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Duração</span>
        <select value={duracao} onChange={(e) => setDuracao(+e.target.value)} className={caixa}>
          {[...new Set([15, 30, 45, 60, 90, 120, duracao])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m >= 60 && m % 60 === 0 ? `${m / 60} h` : `${m} min`}</option>)}
        </select>
        {fim && <span className="mt-1 block text-xs text-tinta/50">Termina às {fim}.</span>}
      </label>
      {choque && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Atenção: {choque.nome} já está marcado(a) às {choque.hora}, em horário que se sobrepõe. Você pode salvar mesmo assim.</p>}
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Plano</span>
        <select value={convenio} onChange={(e) => setConvenio(e.target.value)} className={caixa}>
          <option value="">—</option>
          {[...new Set([...planos, ...(convenio ? [convenio] : [])])].map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <Campo rotulo="WhatsApp para a confirmação" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(31) 99711-5766" />
      <button disabled={salvando} onClick={salvar} className={cls(btn.base, btn.ouro, 'w-full')}>{salvando ? 'Salvando…' : 'Salvar'}</button>
    </Modal>
  )
}

/** Confirmação de consulta: mensagem pronta (editável) → abre o WhatsApp → recepção confirma que enviou. */
export function LembreteModal({ ag, config, onClose }: { ag: Agendamento; config: Config; onClose: () => void }) {
  const hoje = hojeSP()
  const [msg, setMsg] = useState(() =>
    montaMensagem(config.modeloConfirmacao, ag.destNome, config.nomeClinica, ag.nome, {
      data: dataCurta(ag.data), hora: ag.hora, servico: ag.servico || 'atendimento',
    }),
  )
  const [aberto, setAberto] = useState(false)
  const [feito, setFeito] = useState(ag.confirmacaoEnviada)
  const [erro, setErro] = useState('')

  return (
    <Modal titulo={`Confirmar · ${ag.nome.split(' ')[0]}`} onClose={onClose}>
      <p className="mb-3 text-sm text-tinta/70">
        Para: <b>{ag.destNome}</b>{ag.whatsapp && ` · ${formataTelefone(ag.whatsapp)}`}<br />
        Consulta: {dataPorExtenso(ag.data, hoje)} às {ag.hora}
      </p>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Mensagem (você pode editar)</span>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} className="w-full rounded-xl border border-tinta/20 p-3 focus:border-ouro focus:outline-none" />
      </label>
      {ag.whatsapp ? (
        <>
          <a href={linkWhatsApp(ag.whatsapp, msg)} onClick={() => setAberto(true)} target="_blank" rel="noopener noreferrer" className={cls(btn.base, btn.preto, 'w-full')}>
            Abrir no WhatsApp
          </a>
          <p className="mt-2 text-center text-xs text-tinta/50">O WhatsApp abre com a mensagem pronta; você revisa e envia.</p>
        </>
      ) : (
        <p className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">Esta consulta está sem WhatsApp. Feche e use “Editar” para adicionar.</p>
      )}
      <Erro>{erro}</Erro>
      {feito ? (
        <p className="mt-4 rounded-xl bg-ouro-claro p-4 text-center text-sm font-medium">Confirmação enviada ✓</p>
      ) : (
        aberto && (
          <div className="mt-4 rounded-xl bg-ouro-claro p-4 text-center text-sm">
            <p className="mb-3">Depois de enviar no WhatsApp, confirme aqui:</p>
            <button className={cls(btn.base, btn.ouro)} onClick={() => confirmaLembrete(ag.id).then(() => setFeito(true), () => setErro(msgErro()))}>
              Confirmei o envio
            </button>
          </div>
        )
      )}
    </Modal>
  )
}

/** A aba Agenda: um dia por vez, com navegação por dia e atalho para a data. */
export function Agenda({ ags, duracoes, dia, onDia, onAgendar, onEditar, onLembrar, onAjustes }: {
  ags: Agendamento[]; duracoes: Record<string, number>; dia: string; onDia: (d: string) => void
  onAgendar: () => void; onEditar: (a: Agendamento) => void; onLembrar: (a: Agendamento) => void; onAjustes: () => void
}) {
  const [modo, setModo] = useState<'dia' | 'mes'>('dia')
  const [mes, setMes] = useState(dia.slice(0, 7))
  const hoje = hojeSP()
  const hojeIso = isoDe(hoje)
  const doDia = ags.filter((a) => a.data === dia).sort(porHorario)
  const proximos = [...new Set(ags.filter((a) => a.data > dia).map((a) => a.data))].sort().slice(0, 7)
  const [apagar, setApagar] = useState<string | null>(null)
  const passo = 'flex size-11 items-center justify-center rounded-full border border-tinta/20 text-xl hover:border-ouro'

  return (
    <section aria-labelledby="t-agenda" className={cls('flex flex-col gap-5', modo === 'mes' ? 'max-w-5xl' : 'max-w-3xl')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="t-agenda" className="font-serif text-3xl font-semibold sm:text-[40px] sm:leading-[48px]">Agenda</h1>
          <p className="mt-1 capitalize text-tinta/70">{modo === 'dia' ? `${dataPorExtenso(dia, hoje)} · ${doDia.length} consulta${doDia.length === 1 ? '' : 's'}` : 'Visão do mês'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Ajustes da agenda" title="Ajustes da agenda" className="flex size-11 items-center justify-center rounded-full hover:bg-ouro-claro" onClick={onAjustes}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
          <button className={cls(btn.base, btn.preto)} onClick={onAgendar}>+ Nova consulta</button>
        </div>
      </div>

      <div role="group" aria-label="Visão" className="flex self-start rounded-full border border-tinta/15 p-0.5 text-sm font-medium">
        {([['dia', 'Dia'], ['mes', 'Mês']] as const).map(([v, rotulo]) => (
          <button key={v} aria-pressed={modo === v} onClick={() => { setModo(v); if (v === 'mes') setMes(dia.slice(0, 7)) }} className={cls('min-h-10 rounded-full px-5', modo === v ? 'bg-tinta text-white' : 'text-tinta/70')}>{rotulo}</button>
        ))}
      </div>

      {modo === 'mes' ? (
        <MesGrade ags={ags} mes={mes} onMes={setMes} hojeIso={hojeIso} onDia={(d) => { onDia(d); setModo('dia') }} />
      ) : (<>
      <div className="flex items-center gap-2">
        <button aria-label="Dia anterior" className={passo} onClick={() => onDia(somaDias(dia, -1))}>‹</button>
        <input type="date" aria-label="Escolher data" value={dia} onChange={(e) => e.target.value && onDia(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-full border border-tinta/20 px-4 focus:border-ouro focus:outline-none sm:flex-none" />
        <button aria-label="Dia seguinte" className={passo} onClick={() => onDia(somaDias(dia, 1))}>›</button>
        <button className={cls(btn.base, btn.linha)} onClick={() => onDia(hojeIso)}>Hoje</button>
      </div>

      {doDia.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-tinta/20 px-4 py-8 text-center">
          <p>Nenhuma consulta neste dia.</p>
          <button className={cls(btn.base, btn.linha, 'mt-3')} onClick={onAgendar}>Marcar uma consulta</button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {doDia.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-2xl border border-tinta/15 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-ouro-claro"><span className="font-serif text-xl font-semibold leading-5">{a.hora}</span><span className="text-xs">até {horaFim(a.hora, duracaoDe(a, duracoes))}</span></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.nome}</p>
                  <p className="truncate text-sm text-tinta/60">{[a.servico, a.convenio].filter(Boolean).join(' · ') || 'Sem detalhes'}</p>
                  {!a.whatsapp && <p className="text-xs text-red-700">sem WhatsApp</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.confirmacaoEnviada ? (
                  <span className="rounded-full bg-ouro-claro px-2.5 py-1 text-[13px] font-medium">✓ Confirmação enviada</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-tinta/20 px-2.5 py-1 text-[13px] text-tinta/70">
                    <span aria-hidden className="size-1.5 rounded-full bg-ouro" />A confirmar
                  </span>
                )}
                <button className={cls(btn.base, a.confirmacaoEnviada ? btn.linha : btn.ouro, 'min-h-10 px-4')} onClick={() => onLembrar(a)}>
                  {a.confirmacaoEnviada ? 'Reenviar' : 'Confirmar'}
                </button>
                <button className={cls(btn.base, btn.linha, 'min-h-10 px-4')} onClick={() => onEditar(a)}>Editar</button>
                {apagar === a.id ? (
                  <button className={cls(btn.base, 'min-h-10 bg-red-700 px-4 text-white')} onClick={() => apagaAgendamento(a.id).catch(() => {}).finally(() => setApagar(null))}>Cancelar consulta?</button>
                ) : (
                  <button aria-label="Cancelar consulta" className="min-h-10 rounded-full px-3 text-sm text-red-700 hover:bg-red-50" onClick={() => setApagar(a.id)}>Cancelar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {proximos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-tinta/70">Próximos dias com consulta</p>
          <div className="flex flex-wrap gap-2">
            {proximos.map((d) => (
              <button key={d} className={cls(btn.base, btn.linha, 'min-h-10 px-4')} onClick={() => onDia(d)}>
                {d.slice(8)}/{d.slice(5, 7)} · {ags.filter((a) => a.data === d).length}
              </button>
            ))}
          </div>
        </div>
      )}
      </>)}
    </section>
  )
}

/** Ajustes da agenda: quanto dura cada serviço e o texto da mensagem de confirmação. */
export function AjustesAgendaModal({ config, onClose }: { config: Config; onClose: () => void }) {
  const [duracoes, setDuracoes] = useState<Record<string, number>>(config.duracoes)
  const [modelo, setModelo] = useState(config.modeloConfirmacao)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!modelo.trim()) return setErro('Preencha a mensagem de confirmação.')
    const inv = variaveisInvalidas(modelo, true)
    if (inv.length) return setErro(`Variável desconhecida {${inv[0]}}. Use {data}, {hora}, {servico}, {nome}, {paciente} e {clinica}.`)
    setSalvando(true)
    try {
      await salvaConfig({ ...config, duracoes, modeloConfirmacao: modelo })
      onClose()
    } catch {
      setErro(msgErro())
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Ajustes da agenda" onClose={onClose}>
      <Erro>{erro}</Erro>
      <h3 className="mb-1 font-serif text-xl font-semibold">Duração dos serviços</h3>
      <p className="mb-3 text-xs text-tinta/50">Ao marcar uma consulta, a duração vem daqui (padrão {DURACAO_PADRAO} min) e pode ser mudada em cada uma.</p>
      <ul className="mb-6 divide-y divide-tinta/10">
        {config.servicos.map((s) => (
          <li key={s} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate">{s}</span>
            <span className="flex shrink-0 items-center gap-2 text-sm">
              <input type="number" inputMode="numeric" min={5} max={480} step={5} aria-label={`Minutos de ${s}`} value={duracoes[s] ?? DURACAO_PADRAO}
                onChange={(e) => setDuracoes({ ...duracoes, [s]: Math.min(480, Math.max(5, Math.round(+e.target.value) || DURACAO_PADRAO)) })}
                className="min-h-11 w-20 rounded-xl border border-tinta/20 px-3 text-right focus:border-ouro focus:outline-none" />
              min
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mb-1 font-serif text-xl font-semibold">Mensagem de confirmação</h3>
      <p className="mb-2 text-xs text-tinta/50">Use {'{data}'}, {'{hora}'}, {'{servico}'}, {'{nome}'} (quem recebe), {'{paciente}'} e {'{clinica}'}.</p>
      <textarea value={modelo} onChange={(e) => setModelo(e.target.value)} rows={14} className="mb-2 w-full rounded-xl border border-tinta/20 p-3 focus:border-ouro focus:outline-none" />
      <p className="mb-5 whitespace-pre-line rounded-lg bg-ouro-claro p-3 text-xs"><b>Prévia:</b>{'\n'}{montaMensagem(modelo, 'Ana Souza', config.nomeClinica, 'Pedro Souza', { data: dataCurta('2026-11-13'), hora: '14:30', servico: 'Audiometria' })}</p>
      <button disabled={salvando} onClick={salvar} className={cls(btn.base, btn.ouro, 'w-full')}>{salvando ? 'Salvando…' : 'Salvar'}</button>
    </Modal>
  )
}

const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Calendário do mês (domingo a sábado, como o Google Agenda). Tocar num dia abre a lista daquele dia. */
function MesGrade({ ags, mes, onMes, hojeIso, onDia }: {
  ags: Agendamento[]; mes: string; onMes: (m: string) => void; hojeIso: string; onDia: (d: string) => void
}) {
  const [a, m] = [+mes.slice(0, 4), +mes.slice(5)]
  const vazios = new Date(Date.UTC(a, m - 1, 1)).getUTCDay()
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const vai = (n: number) => onMes(new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7))
  const doMes = ags.filter((x) => x.data.startsWith(mes)).sort(porHorario)
  const passo = 'flex size-11 items-center justify-center rounded-full border border-tinta/20 text-xl hover:border-ouro'

  return (
    <>
      <div className="flex items-center gap-2">
        <button aria-label="Mês anterior" className={passo} onClick={() => vai(-1)}>‹</button>
        <p aria-live="polite" className="min-w-0 flex-1 text-center font-serif text-xl font-semibold capitalize sm:flex-none sm:px-4">{MESES_LONGO[m - 1]} de {a}</p>
        <button aria-label="Próximo mês" className={passo} onClick={() => vai(1)}>›</button>
        <button className={cls(btn.base, btn.linha)} onClick={() => onMes(hojeIso.slice(0, 7))}>Hoje</button>
      </div>
      <p className="-mt-2 text-sm text-tinta/60">{doMes.length} consulta{doMes.length === 1 ? '' : 's'} no mês</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-tinta/15 bg-tinta/15">
        {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => (
          <div key={d} className="bg-white py-2 text-center text-xs font-semibold uppercase tracking-[0.04em] text-tinta/60">{d}</div>
        ))}
        {Array.from({ length: Math.ceil((vazios + total) / 7) * 7 }, (_, i) => {
          const n = i - vazios + 1
          if (n < 1 || n > total) return <div key={i} className="min-h-16 bg-[#fbf8f1] sm:min-h-28" />
          const iso = `${mes}-${String(n).padStart(2, '0')}`
          const dia = doMes.filter((x) => x.data === iso)
          const hoje = iso === hojeIso
          return (
            <button
              key={i}
              onClick={() => onDia(iso)}
              aria-label={`${n} de ${MESES_LONGO[m - 1]}, ${dia.length} consulta${dia.length === 1 ? '' : 's'}`}
              className={cls('flex min-h-16 flex-col items-center gap-1 bg-white p-1 text-left hover:bg-ouro-claro sm:min-h-28 sm:items-stretch sm:p-1.5', hoje ? 'ring-2 ring-inset ring-ouro' : '')}
            >
              <span className={cls('flex size-7 items-center justify-center rounded-full text-sm sm:self-start', hoje ? 'bg-ouro font-semibold' : '')}>{n}</span>
              {dia.length > 0 && <span className="rounded-full bg-ouro px-2 text-xs font-semibold sm:hidden">{dia.length}</span>}
              <span className="hidden w-full flex-col gap-0.5 sm:flex">
                {dia.slice(0, 3).map((x) => (
                  <span key={x.id} className={cls('truncate rounded px-1.5 py-0.5 text-xs', x.confirmacaoEnviada ? 'bg-ouro-claro' : 'border border-ouro/60')}>
                    <b className="font-semibold">{x.hora}</b> {x.nome}
                  </span>
                ))}
                {dia.length > 3 && <span className="px-1.5 text-xs text-tinta/60">+{dia.length - 3} mais</span>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-tinta/60">Preenchido = confirmação enviada · contorno dourado = a confirmar.</p>
    </>
  )
}
