import { useState } from 'react'
import { cls } from './ui'

type Tema = { id: string; titulo: string; resumo: string; passos: [string, string][]; dica?: string }

const TEMAS: Tema[] = [
  {
    id: 'comeco',
    titulo: 'Entrar e conhecer o painel',
    resumo: 'Como abrir o sistema e o que cada parte da tela faz.',
    passos: [
      ['Abra o endereço do CRM', 'Funciona no computador e no celular.'],
      ['Entre com a conta Google', 'Use o e-mail que a Bárbara liberou. Se o painel não abrir, o e-mail ainda não foi liberado: avise a Bárbara.'],
      ['Navegue pelo topo', 'Painel e Agenda são as duas telas principais. Modelos de mensagem, Planos de saúde e Serviços ficam ao lado (no celular, no menu ☰).'],
      ['Veja os avisos', 'O balão de conversa mostra confirmações de consulta a enviar; o sininho mostra cadastros novos.'],
      ['Ao terminar, clique em Sair', 'Nunca deixe o sistema aberto sem ninguém no computador.'],
    ],
  },
  {
    id: 'novo',
    titulo: 'Cadastrar paciente (digitando)',
    resumo: 'Para quando o paciente está na sua frente ou ligou para a clínica.',
    passos: [
      ['Clique em “+ Novo paciente”', 'Botão preto no alto do Painel.'],
      ['Preencha nome, WhatsApp e nascimento', 'WhatsApp com DDD: (31) 99999-9999.'],
      ['Complete os demais dados', 'Endereço, responsável (menores), plano de saúde, serviço, 1º e último atendimento e lembrete de retorno.'],
      ['Salve', 'O paciente já aparece na lista e nos avisos.'],
    ],
    dica: 'Em “Observações” escreva só dados administrativos. Nunca diagnóstico ou informação clínica.',
  },
  {
    id: 'link',
    titulo: 'Enviar cadastro para o paciente preencher',
    resumo: 'O paciente preenche pelo celular, em menos de 1 minuto.',
    passos: [
      ['Clique em “Enviar cadastro”', 'O sistema cria um link novo na hora.'],
      ['Escolha como entregar', 'QR Code na tela (paciente presente) ou “Copiar link”.'],
      ['Ou envie pelo WhatsApp', 'Digite o número e clique em “Abrir WhatsApp com a mensagem”.'],
      ['O paciente preenche e envia', 'Nome, nascimento, WhatsApp, endereço e plano.'],
    ],
    dica: 'O link vale para um único cadastro. Para outro paciente, gere um novo.',
  },
  {
    id: 'sino',
    titulo: 'Cadastros novos (o sininho)',
    resumo: 'O que fazer quando um paciente preenche o link.',
    passos: [
      ['Veja o número no sininho', 'Um círculo dourado mostra quantos cadastros chegaram.'],
      ['Clique no nome do paciente', 'Abre o resumo dos dados.'],
      ['Clique em “Copiar texto”', 'Cada informação fica em uma linha.'],
      ['Cole na ficha do paciente (Word)', 'O aviso some depois de visto. Na aba “Novos” da lista de pacientes ficam todos os cadastros feitos pelo link.'],
    ],
  },
  {
    id: 'importar',
    titulo: 'Importar fichas do Word',
    resumo: 'Para trazer as fichas antigas (.docx) de uma vez.',
    passos: [
      ['Clique em “Importar Word”', 'Botão no alto do Painel.'],
      ['Escolha as fichas .docx', 'Pode selecionar várias ou arrastar para a caixa.'],
      ['Confira a lista', 'O sistema mostra nome, nascimento e datas encontradas. Erros aparecem em vermelho.'],
      ['Clique em “Importar”', 'O arquivo fica guardado no perfil do paciente.'],
    ],
    dica: 'Depois de importar, falta o WhatsApp: abra o perfil, clique em “Editar cadastro” e preencha. Se a ficha citar Calibração, o retorno é marcado para 12 meses depois.',
  },
  {
    id: 'pacientes',
    titulo: 'Lista e perfil do paciente',
    resumo: 'Buscar, filtrar e ver o histórico de cada paciente.',
    passos: [
      ['Busque por nome ou telefone', 'Acentos não atrapalham: “joao” acha “João”.'],
      ['Use as abas e o filtro de convênio', 'Ativos, Novos e Arquivados; e “Convênio: todos” para filtrar por plano.'],
      ['Clique no paciente', 'Abre o perfil com dados, histórico de mensagens e consultas.'],
      ['Use os botões do perfil', 'Parabéns / Retorno (mensagem pronta), Nova consulta (atualiza o último atendimento) e Editar cadastro (corrigir dados, adicionar WhatsApp, arquivar).'],
    ],
  },
  {
    id: 'mensagens',
    titulo: 'Aniversários e retornos',
    resumo: 'Enviar parabéns e chamar pacientes para voltar.',
    passos: [
      ['Veja “Aniversariantes”', 'Alterne entre Hoje, Semana e Mês.'],
      ['Veja “Retornos do mês”', 'Lista quem está com o prazo de retorno vencendo. Só aparece se o cadastro tiver último atendimento e lembrete de retorno.'],
      ['Clique em “Parabéns” ou “Retorno”', 'Confira o destinatário (se for menor, vai para o responsável) e edite o texto se quiser.'],
      ['Clique em “Abrir no WhatsApp”', 'A conversa abre com a mensagem pronta; você só envia.'],
      ['Volte e clique em “Confirmei o envio”', 'O card muda para ✓ Enviado e o histórico é atualizado.'],
    ],
    dica: 'Confirme só depois de enviar de verdade. Aviso “sem WhatsApp” em vermelho? Use “Editar cadastro” e adicione o número.',
  },
  {
    id: 'agenda',
    titulo: 'Agenda de consultas',
    resumo: 'Marcar, editar e cancelar consultas.',
    passos: [
      ['Abra a aba “Agenda”', 'Navegue pelos dias com as setas ou escolha uma data. A visão “Mês” mostra o mês inteiro.'],
      ['Clique em “+ Nova consulta”', 'Escolha o paciente, data, horário, serviço e duração.'],
      ['Edite ou cancele', 'Em cada consulta há “Editar” e “Cancelar” (o sistema pergunta antes de cancelar).'],
      ['Confira “Próximos dias com consulta”', 'Atalho para pular para o próximo dia ocupado.'],
    ],
    dica: 'Na visão do mês: preenchido = confirmação enviada; contorno dourado = ainda a confirmar.',
  },
  {
    id: 'confirmar',
    titulo: 'Confirmar consulta por WhatsApp',
    resumo: 'Avisar o paciente de hoje ou de amanhã.',
    passos: [
      ['Veja o balão de conversa no topo', 'O número dourado mostra confirmações pendentes para hoje e amanhã.'],
      ['Clique na consulta', 'Abre a mensagem de confirmação pronta (você pode editar).'],
      ['Abra o WhatsApp e envie', 'Consulta sem WhatsApp aparece avisada: edite a consulta para adicionar o número.'],
      ['Clique em “Confirmação enviada”', 'A consulta ganha ✓ na agenda e sai da lista de pendentes.'],
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes: modelos, planos, serviços e agenda',
    resumo: 'Personalizar os textos e as listas da clínica.',
    passos: [
      ['Modelos de mensagem', 'Textos de aniversário e retorno, para o paciente e para o responsável. Use {nome}, {paciente} e {clinica}: o sistema troca pelo nome certo.'],
      ['Planos de saúde', 'Lista de convênios; aparece como sugestão no cadastro.'],
      ['Serviços', 'Tipos de atendimento. Remover da lista não altera pacientes já cadastrados.'],
      ['Ajustes da agenda (engrenagem, dentro da Agenda)', 'Duração padrão de cada serviço e o texto da mensagem de confirmação, com prévia.'],
    ],
  },
  {
    id: 'cuidados',
    titulo: 'Cuidados importantes',
    resumo: 'O que evita erros e protege os dados.',
    passos: [
      ['Só dados administrativos', 'Em “Observações”, nunca diagnóstico ou informação clínica.'],
      ['Confira o WhatsApp', 'Com DDD. Número errado manda a mensagem para outra pessoa.'],
      ['Menores de idade', 'Preencha o responsável: a mensagem vai para ele.'],
      ['Confirme só depois de enviar', 'O botão “Confirmei o envio” alimenta o histórico.'],
      ['Clique em Sair ao terminar', 'Principalmente em computador compartilhado.'],
    ],
    dica: 'Rotina sugerida: ao chegar, olhe o balão, o sininho e os aniversariantes de hoje; durante o dia, cadastre e registre consultas; ao fim, confira retornos. Qualquer dúvida, chame a Bárbara.',
  },
]

export function Tutorial({ onFechar }: { onFechar: () => void }) {
  const [id, setId] = useState(TEMAS[0].id)
  const t = TEMAS.find((x) => x.id === id)!
  return (
    <section aria-labelledby="t-tut" className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="t-tut" className="font-serif text-3xl font-semibold">Como usar o sistema</h1>
          <p className="text-sm text-tinta/60">Passo a passo de cada função, por tema.</p>
        </div>
        <button className="min-h-11 rounded-full border border-tinta/20 px-5 text-sm font-medium hover:border-ouro" onClick={onFechar}>← Voltar ao painel</button>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Temas" className="flex gap-2 overflow-x-auto md:w-64 md:shrink-0 md:flex-col md:overflow-visible">
          {TEMAS.map((x, i) => (
            <button
              key={x.id}
              aria-current={x.id === id ? 'true' : undefined}
              onClick={() => setId(x.id)}
              className={cls('min-h-11 shrink-0 rounded-2xl px-4 py-2 text-left text-sm md:shrink', x.id === id ? 'bg-tinta text-white' : 'border border-tinta/15 hover:border-ouro')}
            >
              <span className="opacity-60">{i + 1}.</span> {x.titulo}
            </button>
          ))}
        </nav>
        <article className="flex-1 rounded-3xl border border-ouro/40 p-5 sm:p-6">
          <h2 className="font-serif text-2xl font-semibold">{t.titulo}</h2>
          <p className="mt-1 text-tinta/70">{t.resumo}</p>
          <ol className="mt-5 flex flex-col gap-4">
            {t.passos.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-3">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ouro-claro font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">{titulo}</p>
                  <p className="text-sm text-tinta/70">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
          {t.dica && <p className="mt-5 rounded-2xl bg-ouro-claro p-4 text-sm"><b>Atenção:</b> {t.dica}</p>}
        </article>
      </div>
    </section>
  )
}
