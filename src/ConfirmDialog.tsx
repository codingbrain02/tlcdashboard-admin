import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmDialog({ title, children, confirmText, busy, error, danger = false, onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmText: string; busy: boolean; error?: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby="confirmation-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60">
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onConfirm() }} className="space-y-5 p-5 sm:p-7">
      <h2 id="confirmation-title" className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-4 text-sm leading-6">{children}</div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <button autoFocus type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-soft disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className={'min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ' + (danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-[#4f46e5] hover:bg-[#4338ca]')}>{busy ? 'Saving…' : confirmText}</button>
      </div>
    </form>
  </dialog>, document.body)
}

export function ChangeReview({ entries }: { entries: { label: string; before: string; after: string }[] }) {
  return <dl className="space-y-3 rounded-xl border border-line bg-soft p-4">
    {entries.filter(entry => entry.before !== entry.after).map(entry => <div key={entry.label}>
      <dt className="text-xs font-semibold text-muted">{entry.label}</dt>
      <dd className="mt-1 break-words"><span className="text-muted">{entry.before || 'Not provided'}</span><span aria-hidden="true" className="mx-2">→</span><strong>{entry.after || 'Not provided'}</strong></dd>
    </div>)}
  </dl>
}
