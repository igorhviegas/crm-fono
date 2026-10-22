import { useEffect, useState } from 'react'
import { geraArte, salvaArte } from './art'
import { lerCsv, type Resultado } from './csv'
import { confirmaEnvio, importaPacientes, registraMensagem, salvaConfig, salvaPaciente, type Config, type Msg } from './data'
import {
  chaveModelo, destinatarioDe, formataTelefone, linkWhatsApp, montaMensagem,
  normalizaNascimento, normalizaTelefone, variaveisInvalidas, type Destinatario, type Paciente, type Tipo,
} from './domain'
import { btn, Campo, cls, Erro, Modal } from './ui'

const msgErro = () => 'Não foi possível salvar. Verifique a conexão e tente novamente.'
const caixa = 'min-h-12 w-full rounded-xl border border-tinta/20 bg-white px-4 focus:border-ouro focus:outline-none'

export function PacienteModal({
  paciente, planos, servicos, onClose,
}: { paciente: Paciente | null; planos: string[]; servicos: string[]; onClose: () => void }) {
  const [nome, setNome] = useState(paciente?.nome ?? '')
  const [tel, setTel] = useState(paciente?.whatsapp ? formataTelefone(paciente.whatsapp) : '')
  const [nasc, setNasc] = useState(paciente?.nascimento ?? '')
  const [respNome, setRespNome] = useState(paciente?.responsavelNome ?? '')
  const [respTel, setRespTel] = useState(paciente?.responsavelWhatsapp ? formataTelefone(paciente.responsavelWhatsapp) : '')
  const [dest, setDest] = useState<Destinatario>(paciente?.destinatario ?? 'paciente')
  const [convenio, setConvenio] = useState(paciente?.convenio ?? '')
  const [atend, setAtend] = useState(paciente?.atendimento ?? '')
  const [obs, setObs] = useState(paciente?.observacoes ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(arquivado = paciente?.arquivado ?? false) {
    const nascimento = normalizaNascimento(nasc)
    const whatsapp = tel.trim() ? normalizaTelefone(tel) : ''
    const responsavelWhatsapp = respTel.trim() ? normalizaTelefone(respTel) : ''
    if (!nome.trim()) return setErro('Informe o nome do paciente.')
    if (whatsapp === null) return setErro('WhatsApp do paciente inválido. Use DDD + número, ex.: (31) 99999-9999.')
    if (responsavelWhatsapp === null) return setErro('WhatsApp do responsável inválido. Use DDD + número.')
    if (dest === 'paciente' && !whatsapp) return setErro('Informe o WhatsApp do paciente (ou escolha enviar ao responsável).')
    if (dest === 'responsavel' && !responsavelWhatsapp) return setErro('Informe o WhatsApp do responsável.')
    if (!nascimento) return setErro('Data de nascimento inválida.')
    setSalvando(true)
    try {
      await salvaPaciente(paciente?.id ?? null, {
        nome: nome.trim(), whatsapp: whatsapp!, nascimento, arquivado, destinatario: dest,
        responsavelNome: respNome, responsavelWhatsapp: responsavelWhatsapp!, convenio, atendimento: atend, observacoes: obs,
      })
      onClose()
    } catch {
      setErro(msgErro())
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={paciente ? 'Editar paciente' : 'Novo paciente'} onClose={onClose}>
      <Erro>{erro}</Erro>
      <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" autoFocus />
      <Campo rotulo="WhatsApp do paciente" value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" placeholder="(31) 99999-9999" />
      <Campo rotulo="Data de nascimento" type="date" value={normalizaNascimento(nasc) ?? nasc} onChange={(e) => setNasc(e.target.value)} max={new Date().toISOString().slice(0, 10)} />

      <fieldset className="mb-4 rounded-xl border border-tinta/15 p-4">
        <legend className="px-2 text-sm font-medium">Responsável (se houver)</legend>
        <Campo rotulo="Nome do responsável" value={respNome} onChange={(e) => setRespNome(e.target.value)} autoComplete="off" />
        <Campo rotulo="WhatsApp do responsável" value={respTel} onChange={(e) => setRespTel(e.target.value)} type="tel" inputMode="tel" placeholder="(31) 99999-9999" />
        <div className="flex gap-2 text-sm" role="radiogroup" aria-label="Enviar mensagens para">
          {(['paciente', 'responsavel'] as Destinatario[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dest === d}
              onClick={() => setDest(d)}
              className={cls('min-h-11 flex-1 rounded-full border px-3', dest === d ? 'border-tinta bg-tinta text-white' : 'border-tinta/20')}
            >
              Enviar mensagens ao {d === 'paciente' ? 'paciente' : 'responsável'}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Plano de saúde (opcional)</span>
        <input list="planos" value={convenio} onChange={(e) => setConvenio(e.target.value)} className={caixa} placeholder="Particular, Amagis…" />
        <datalist id="planos">{planos.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Serviço (opcional)</span>
        <select value={atend} onChange={(e) => setAtend(e.target.value)} className={caixa}>
          <option value="">—</option>
          {/* mantém o valor já salvo mesmo que o serviço tenha sido removido da lista */}
          {[...new Set([...servicos, ...(atend ? [atend] : [])])].map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <Campo rotulo="Observações (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} dica="Só informações administrativas. Não escreva diagnóstico ou dados clínicos." />

      <button disabled={salvando} onClick={() => salvar()} className={cls(btn.base, btn.ouro, 'w-full')}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
      {paciente && (
        <button disabled={salvando} onClick={() => salvar(!paciente.arquivado)} className={cls(btn.base, btn.linha, 'mt-3 w-full')}>
          {paciente.arquivado ? 'Reativar paciente' : 'Arquivar paciente'}
        </button>
      )}
    </Modal>
  )
}

const quando = (d: Date) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const rotuloTipo = { aniversario: '🎂 Aniversário', retorno: '💬 Retorno' }

export function PerfilModal({
  paciente, mensagens, onMensagem, onEditar, onClose,
}: { paciente: Paciente; mensagens: Msg[]; onMensagem: (t: Tipo) => void; onEditar: () => void; onClose: () => void }) {
  const dest = destinatarioDe(paciente)
  const [a, m, d] = [paciente.nascimento.slice(0, 4), paciente.nascimento.slice(5, 7), paciente.nascimento.slice(8)]
  const linha = (r: string, v?: string) => v && <p className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-tinta/60">{r}</span><span className="text-right">{v}</span></p>

  return (
    <Modal titulo={paciente.nome} onClose={onClose}>
      <div className="mb-5 divide-y divide-tinta/10">
        {linha('Nascimento', `${d}/${m}/${a}`)}
        {linha('WhatsApp', formataTelefone(paciente.whatsapp))}
        {linha('Responsável', paciente.responsavelNome && `${paciente.responsavelNome} · ${formataTelefone(paciente.responsavelWhatsapp ?? '')}`)}
        {linha('Mensagens vão para', dest.responsavel ? `Responsável (${dest.nome.split(' ')[0]})` : 'O paciente')}
        {linha('Convênio', paciente.convenio)}
        {linha('Atendimento', paciente.atendimento)}
        {linha('Observações', paciente.observacoes)}
        {paciente.arquivado && <p className="py-2 text-sm font-medium text-tinta/60">Cadastro arquivado</p>}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button className={cls(btn.base, btn.ouro)} onClick={() => onMensagem('aniversario')}>🎂 Aniversário</button>
        <button className={cls(btn.base, btn.preto)} onClick={() => onMensagem('retorno')}>💬 Retorno</button>
      </div>
      <button className={cls(btn.base, btn.linha, 'mb-6 w-full')} onClick={onEditar}>Editar cadastro</button>

      <h3 className="mb-2 font-serif text-xl font-semibold">Histórico de mensagens</h3>
      {mensagens.length === 0 ? (
        <p className="text-sm text-tinta/50">Nenhuma mensagem preparada ainda.</p>
      ) : (
        <ul className="divide-y divide-tinta/10 text-sm">
          {mensagens.slice(0, 10).map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 py-2">
              <span>{rotuloTipo[x.tipo]} <span className="text-tinta/50">· {x.destinatario === 'responsavel' ? 'responsável' : 'paciente'}</span></span>
              <span className="text-right">
                <span className={x.status === 'envio_confirmado' ? 'font-medium text-ouro' : 'text-tinta/60'}>
                  {x.status === 'envio_confirmado' ? '✓ envio confirmado' : 'link aberto'}
                </span>
                <span className="block text-xs text-tinta/50">{quando(x.criadoEm)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export function MensagemModal({ paciente, tipo, config, onClose }: { paciente: Paciente; tipo: Tipo; config: Config; onClose: () => void }) {
  const dest = destinatarioDe(paciente)
  const [msg, setMsg] = useState(montaMensagem(config[chaveModelo(tipo, dest.responsavel)], dest.nome, config.nomeClinica, paciente.nome))
  const [arte, setArte] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [msgId, setMsgId] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (tipo !== 'aniversario') return
    let vivo = true
    geraArte(paciente.nome, config.nomeClinica).then((b) => {
      if (!vivo) return
      setArte(b)
      setUrl(URL.createObjectURL(b))
    })
    return () => { vivo = false }
  }, [tipo, paciente.nome, config.nomeClinica])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const aoAbrir = () => {
    if (msgId) return
    registraMensagem(paciente.id, tipo, dest.responsavel ? 'responsavel' : 'paciente')
      .then(setMsgId)
      .catch(() => setAviso('Não consegui registrar no histórico, mas o WhatsApp foi aberto.'))
  }

  return (
    <Modal titulo={`${rotuloTipo[tipo]} · ${paciente.nome.split(' ')[0]}`} onClose={onClose}>
      {tipo === 'aniversario' && (
        <>
          {url ? <img src={url} alt="Arte de aniversário" className="mx-auto mb-4 max-h-72 rounded-xl border border-tinta/10" /> : <p className="mb-4 text-sm">Gerando arte…</p>}
          <button disabled={!arte} onClick={() => salvaArte(arte!, paciente.nome)} className={cls(btn.base, btn.linha, 'mb-5 w-full')}>Baixar arte</button>
        </>
      )}
      <p className="mb-3 text-sm text-tinta/70">
        Para: <b>{dest.nome}</b>{dest.responsavel && ' (responsável)'} · {formataTelefone(dest.tel)}
      </p>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Mensagem (você pode editar)</span>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} className="w-full rounded-xl border border-tinta/20 p-3 focus:border-ouro focus:outline-none" />
      </label>
      <a href={linkWhatsApp(dest.tel, msg)} onClick={aoAbrir} target="_blank" rel="noopener noreferrer" className={cls(btn.base, btn.preto, 'w-full')}>
        Abrir no WhatsApp
      </a>
      <p className="mt-2 text-center text-xs text-tinta/50">O WhatsApp abre com a mensagem pronta; você revisa e envia.</p>
      {aviso && <p className="mt-3 text-center text-xs text-red-700">{aviso}</p>}
      {msgId && (
        <div className="mt-4 rounded-xl bg-ouro-claro p-4 text-center text-sm">
          {confirmado ? (
            <p className="font-medium">✓ Envio confirmado no histórico.</p>
          ) : (
            <>
              <p className="mb-3">Depois de enviar no WhatsApp, confirme aqui:</p>
              <button
                className={cls(btn.base, btn.ouro)}
                onClick={() => confirmaEnvio(paciente.id, msgId).then(() => setConfirmado(true), () => setAviso(msgErro()))}
              >
                Confirmei o envio
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export function ImportarModal({ existentes, onClose }: { existentes: Paciente[]; onClose: () => void }) {
  const [res, setRes] = useState<Resultado | null>(null)
  const [fim, setFim] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function importar() {
    setOcupado(true)
    try {
      const { novos, repetidos } = await importaPacientes(res!.validas, existentes)
      setFim(`${novos} paciente(s) importado(s)${repetidos ? `, ${repetidos} já existiam` : ''}.`)
    } catch {
      setFim(msgErro())
    }
    setOcupado(false)
  }

  return (
    <Modal titulo="Importar planilha (CSV)" onClose={onClose}>
      <p className="mb-4 text-sm text-tinta/70">
        No Excel ou Google Planilhas: <b>Arquivo → Salvar como → CSV</b>. A primeira linha deve ter as colunas{' '}
        <b>Nome</b>, <b>WhatsApp</b> (ou Telefone) e <b>Nascimento</b> (dd/mm/aaaa). Opcional: <b>Convênio</b>.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="mb-4 block w-full text-sm"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          setFim('')
          setRes(f ? lerCsv(await f.text()) : null)
        }}
      />
      {res && (
        <div className="mb-4 rounded-xl bg-ouro-claro p-3 text-sm">
          <p><b>{res.validas.length}</b> linha(s) prontas para importar.</p>
          {res.erros.length > 0 && (
            <details className="mt-2 text-red-700">
              <summary>{res.erros.length} com problema (serão ignoradas)</summary>
              <ul className="mt-1 max-h-32 overflow-auto">{res.erros.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      {fim && <p className="mb-4 rounded-xl bg-ouro-claro p-3 text-sm font-medium">{fim}</p>}
      <button disabled={!res?.validas.length || ocupado || !!fim} onClick={importar} className={cls(btn.base, btn.ouro, 'w-full')}>
        {ocupado ? 'Importando…' : 'Importar'}
      </button>
    </Modal>
  )
}

const CAMPOS_MODELO = [
  ['modeloAniversario', '🎂 Aniversário — para o paciente'],
  ['modeloAniversarioResp', '🎂 Aniversário — para o responsável'],
  ['modeloRetorno', '💬 Retorno — para o paciente'],
  ['modeloRetornoResp', '💬 Retorno — para o responsável'],
] as const

export function ConfigModal({ config, onClose }: { config: Config; onClose: () => void }) {
  const [c, setC] = useState(config)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!c.nomeClinica.trim()) return setErro('Informe o nome da clínica.')
    for (const [k, rotulo] of CAMPOS_MODELO) {
      if (!c[k].trim()) return setErro(`Preencha a mensagem: ${rotulo}.`)
      const inv = variaveisInvalidas(c[k])
      if (inv.length) return setErro(`Variável desconhecida {${inv[0]}} em “${rotulo}”. Use {nome}, {paciente} e {clinica}.`)
    }
    try {
      await salvaConfig({ ...c, nomeClinica: c.nomeClinica.trim() })
      onClose()
    } catch {
      setErro(msgErro())
    }
  }

  return (
    <Modal titulo="Gerenciar mensagens" onClose={onClose}>
      <Erro>{erro}</Erro>
      <Campo rotulo="Nome da clínica" value={c.nomeClinica} onChange={(e) => setC({ ...c, nomeClinica: e.target.value })} />
      <p className="mb-4 text-xs text-tinta/50">
        Nas mensagens use {'{nome}'} (quem recebe), {'{paciente}'} (nome do paciente) e {'{clinica}'}.
      </p>
      {CAMPOS_MODELO.map(([k, rotulo]) => (
        <label key={k} className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">{rotulo}</span>
          <textarea value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} rows={4} className="w-full rounded-xl border border-tinta/20 p-3 focus:border-ouro focus:outline-none" />
          <span className="mt-1 block rounded-lg bg-ouro-claro p-2 text-xs"><b>Prévia:</b> {montaMensagem(c[k], 'Ana Souza', c.nomeClinica, 'Pedro Souza')}</span>
        </label>
      ))}
      <button onClick={salvar} className={cls(btn.base, btn.ouro, 'w-full')}>Salvar</button>
    </Modal>
  )
}

/** Edita uma lista simples (planos de saúde ou serviços). Remover da lista não altera pacientes já cadastrados. */
export function ListaModal({
  titulo, descricao, itens, onSalvar, onClose,
}: { titulo: string; descricao: string; itens: string[]; onSalvar: (itens: string[]) => Promise<void>; onClose: () => void }) {
  const [lista, setLista] = useState(itens)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const adiciona = () => {
    const v = novo.trim().slice(0, 60)
    if (!v) return
    if (lista.some((x) => x.toLowerCase() === v.toLowerCase())) return setErro('Esse item já está na lista.')
    setLista([...lista, v])
    setNovo('')
    setErro('')
  }

  async function salvar() {
    setSalvando(true)
    try {
      await onSalvar(lista)
      onClose()
    } catch {
      setErro(msgErro())
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <p className="mb-4 text-sm text-tinta/70">{descricao}</p>
      <Erro>{erro}</Erro>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); adiciona() }}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Adicionar novo…" aria-label="Novo item" className={caixa} />
        <button type="submit" className={cls(btn.base, btn.preto, 'shrink-0')}>Adicionar</button>
      </form>
      {lista.length === 0 ? (
        <p className="mb-4 text-sm text-tinta/50">A lista está vazia.</p>
      ) : (
        <ul className="mb-5 divide-y divide-tinta/10">
          {lista.map((x) => (
            <li key={x} className="flex items-center justify-between gap-3">
              <span className="py-3">{x}</span>
              <button aria-label={`Remover ${x}`} className="size-11 text-xl text-tinta/40 hover:text-red-700" onClick={() => setLista(lista.filter((y) => y !== x))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <button disabled={salvando} onClick={salvar} className={cls(btn.base, btn.ouro, 'w-full')}>{salvando ? 'Salvando…' : 'Salvar'}</button>
    </Modal>
  )
}
