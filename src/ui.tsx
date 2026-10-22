import type { ReactNode } from 'react'

export const btn = {
  base: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:opacity-50',
  ouro: 'bg-ouro text-white hover:brightness-95',
  preto: 'bg-tinta text-white hover:bg-black/80',
  linha: 'border border-tinta/20 text-tinta hover:border-ouro hover:text-ouro',
}
export const cls = (...a: string[]) => a.join(' ')

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="-mr-2 size-11 text-2xl leading-none text-tinta/50">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Campo({ rotulo, dica, ...p }: { rotulo: string; dica?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium">{rotulo}</span>
      <input {...p} className="min-h-12 w-full rounded-xl border border-tinta/20 px-4 focus:border-ouro focus:outline-none" />
      {dica && <span className="mt-1 block text-xs text-tinta/50">{dica}</span>}
    </label>
  )
}

export const Erro = ({ children }: { children?: ReactNode }) =>
  children ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{children}</p> : null
