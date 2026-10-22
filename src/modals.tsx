import { useEffect, useState } from 'react'
import { geraArte, salvaArte } from './art'
import { lerCsv, type Resultado } from './csv'
import { importaPacientes, salvaConfig, salvaPaciente, type Config } from './data'
import {
  formataTelefone, linkWhatsApp, montaMensagem, normalizaNascimento, normalizaTelefone, variaveisInvalidas, type Paciente,
} from './domain'
import { btn, Campo, cls, Erro, Modal } from './ui'

const msgErro = () => 'Não foi possível salvar. Verifique a conexão e tente novamente.'

export function PacienteModal({ paciente, onClose }: { paciente: Paciente | null; onClose: () => void }) {
  const [nome, setNome] = useState(paciente?.nome ?? '')
  const [tel, setTel] = useState(paciente ? formataTelefone(paciente.whatsapp) : '')
  const [nasc, setNasc] = useState(paciente?.nascimento ?? '')
  const [obs, setObs] = useState(paciente?.observacoes ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(arquivado = paciente?.arquivado ?? false) {
    const whatsapp = normalizaTelefone(tel)
    const nascimento = normalizaNascimento(nasc)
    if (!nome.trim()) return setErro('Informe o nome do paciente.')
    if (!whatsapp) return setErro('WhatsApp inválido. Use DDD + número, ex.: (31) 99999-9999.')
    if (!nascimento) return setErro('Data de nascimento inválida.')
    setSalvando(true)
    try {
      await salvaPaciente(paciente?.id ?? null, { nome: nome.trim(), whatsapp, nascimento, observacoes: obs, arquivado })
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
      <Campo rotulo="WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" placeholder="(31) 99999-9999" />
      <Campo
        rotulo="Data de nascimento"
        type="date"
        value={normalizaNascimento(nasc) ?? nasc}
        onChange={(e) => setNasc(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
      />
      <Campo rotulo="Observações (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} dica="Só informações administrativas, ex.: “mãe: Ana”." />
      <button disabled={salvando} onClick={() => salvar()} className={cls(btn.base, btn.ouro, 'w-full')}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
      {paciente && (
        <button
          disabled={salvando}
          onClick={() => salvar(!paciente.arquivado)}
          className={cls(btn.base, btn.linha, 'mt-3 w-full')}
        >
          {paciente.arquivado ? 'Reativar paciente' : 'Arquivar paciente'}
        </button>
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
        <b>Nome</b>, <b>WhatsApp</b> (ou Telefone) e <b>Nascimento</b> (dd/mm/aaaa).
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

export function AniversarioModal({ paciente, config, onClose }: { paciente: Paciente; config: Config; onClose: () => void }) {
  const [msg, setMsg] = useState(montaMensagem(config.modeloAniversario, paciente.nome, config.nomeClinica))
  const [arte, setArte] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')

  useEffect(() => {
    let vivo = true
    geraArte(paciente.nome, config.nomeClinica).then((b) => {
      if (!vivo) return
      setArte(b)
      setUrl(URL.createObjectURL(b))
    })
    return () => { vivo = false }
  }, [paciente.nome, config.nomeClinica])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  return (
    <Modal titulo={`🎂 ${paciente.nome.split(' ')[0]}`} onClose={onClose}>
      {url ? <img src={url} alt="Arte de aniversário" className="mx-auto mb-4 max-h-72 rounded-xl border border-tinta/10" /> : <p className="mb-4 text-sm">Gerando arte…</p>}
      <button disabled={!arte} onClick={() => salvaArte(arte!, paciente.nome)} className={cls(btn.base, btn.linha, 'mb-5 w-full')}>
        Baixar arte
      </button>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Mensagem (você pode editar)</span>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} className="w-full rounded-xl border border-tinta/20 p-3 focus:border-ouro focus:outline-none" />
      </label>
      <a
        href={linkWhatsApp(paciente.whatsapp, msg)}
        target="_blank"
        rel="noopener noreferrer"
        className={cls(btn.base, btn.preto, 'w-full')}
      >
        Abrir no WhatsApp
      </a>
      <p className="mt-2 text-center text-xs text-tinta/50">O WhatsApp abre com a mensagem pronta; você revisa e envia.</p>
    </Modal>
  )
}

export function ConfigModal({ config, onClose }: { config: Config; onClose: () => void }) {
  const [nome, setNome] = useState(config.nomeClinica)
  const [modelo, setModelo] = useState(config.modeloAniversario)
  const [erro, setErro] = useState('')
  const invalidas = variaveisInvalidas(modelo)

  async function salvar() {
    if (!nome.trim() || !modelo.trim()) return setErro('Preencha o nome da clínica e a mensagem.')
    if (invalidas.length) return setErro(`Variável desconhecida: {${invalidas[0]}}. Use apenas {nome} e {clinica}.`)
    try {
      await salvaConfig({ nomeClinica: nome.trim(), modeloAniversario: modelo })
      onClose()
    } catch {
      setErro(msgErro())
    }
  }

  return (
    <Modal titulo="Configurações" onClose={onClose}>
      <Erro>{erro}</Erro>
      <Campo rotulo="Nome da clínica" value={nome} onChange={(e) => setNome(e.target.value)} />
      <label className="mb-2 block">
        <span className="mb-1 block text-sm font-medium">Mensagem de aniversário</span>
        <textarea value={modelo} onChange={(e) => setModelo(e.target.value)} rows={6} className="w-full rounded-xl border border-tinta/20 p-3 focus:border-ouro focus:outline-none" />
        <span className="text-xs text-tinta/50">Use {'{nome}'} para o nome do paciente e {'{clinica}'} para o nome da clínica.</span>
      </label>
      <p className="mb-4 rounded-xl bg-ouro-claro p-3 text-sm"><b>Prévia:</b> {montaMensagem(modelo, 'Maria da Silva', nome)}</p>
      <button onClick={salvar} className={cls(btn.base, btn.ouro, 'w-full')}>Salvar</button>
    </Modal>
  )
}
