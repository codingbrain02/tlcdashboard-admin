import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Activity = {
  id: string; actor_name: string; employee_name: string; employee_id: string; action: string; reason: string | null
  occurred_at: string; before_data: Record<string, unknown>; after_data: Record<string, unknown>
}
const actions: Record<string, string> = {
  'set-password': 'Changed account password',
  'reset-password': 'Reset account password',
  'create-employee': 'Created employee', terminate: 'Terminated employee', 'reverse-termination': 'Reversed termination',
  rehire: 'Rehired employee', 'update-profile': 'Edited employee details', 'update-attendance': 'Corrected attendance',
  'email-change-requested': 'Requested email change', 'email-changed': 'Changed employee email', 'email-change-failed': 'Email change failed',
}
const labels: Record<string, string> = {
  full_name: 'Full name', email: 'Email', position: 'Position', phone_number: 'Phone', is_active: 'Account enabled',
  created_at: 'Registered', employment_start_date: 'Employment start date', terminated_at: 'Terminated at',
  termination_reason: 'Termination reason', termination_details: 'Details', clock_in: 'Clock in', clock_out: 'Clock out', end_reason: 'End status',
}
function valueText(value: unknown) { return value === null || value === undefined || value === '' ? 'Not provided' : String(value) }
export default function ActivityLog() {
  const [events, setEvents] = useState<Activity[]>([])
  const [page, setPage] = useState(0)
  const [version, setVersion] = useState(0)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let current = true
    void supabase.functions.invoke('admin-api', { body: { action: 'list-activity', page } }).then(result => {
      if (!current) return
      if (result.error || !Array.isArray(result.data?.events)) setError('Could not load activity logs.')
      else { setEvents(result.data.events); setMore(Boolean(result.data.hasMore)); setError('') }
      setBusy(false)
    }).catch(() => { if (current) { setError('Could not load activity logs.'); setBusy(false) } })
    return () => { current = false }
  }, [page, version])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let timer = 0
    const refresh = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setVersion(value => value + 1), 250) }
    const channel = client.channel('super-admin-activity').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_activity_log' }, refresh).subscribe()
    const onFocus = () => { if (!document.hidden) refresh() }
    const interval = window.setInterval(onFocus, 60_000)
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(interval); window.clearTimeout(timer); window.removeEventListener('focus', onFocus); void client.removeChannel(channel) }
  }, [])
  function go(next: number) { setPage(next); setBusy(true) }
  return <section className="space-y-6">
    <div><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Super Administrator</span><h1 className="mt-2 text-3xl font-bold tracking-tight">Activity log</h1><p className="mt-2 text-sm text-muted">Who changed employee accounts, when, and why. Records cannot be edited or deleted here.</p></div>
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error} <button type="button" onClick={() => setVersion(value => value + 1)} className="underline">Retry</button></p>}
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {events.map(event => <article key={event.id} className="space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="text-sm font-bold">{actions[event.action] || event.action}</h2><time dateTime={event.occurred_at} className="text-xs text-muted">{new Date(event.occurred_at).toLocaleString()}</time></div>
        <p className="text-sm"><strong>{event.actor_name}</strong><span className="text-muted"> · </span>{event.employee_name || 'Employee'}</p>
        {event.reason && <p className="whitespace-pre-wrap break-words text-sm text-muted">{event.reason}</p>}
        <details className="text-xs"><summary className="cursor-pointer font-semibold text-brand">View changes</summary><dl className="mt-3 space-y-2 rounded-xl bg-soft p-3">
          {Object.entries(labels).filter(([key]) => key in event.after_data && event.before_data[key] !== event.after_data[key]).map(([key, label]) => <div key={key}><dt className="font-semibold">{label}</dt><dd className="mt-0.5 break-words text-muted">{valueText(event.before_data[key])} → {valueText(event.after_data[key])}</dd></div>)}
          <div><dt className="font-semibold">Employee ID</dt><dd className="break-all text-muted">{event.employee_id}</dd></div>
        </dl></details>
      </article>)}
      {!events.length && <p role={busy ? 'status' : undefined} className="p-8 text-center text-sm text-muted">{busy ? 'Loading activity…' : 'No actions recorded since activity logging was enabled.'}</p>}
    </div>
    <nav aria-label="Activity pages" className="flex items-center justify-end gap-3 text-sm"><button type="button" disabled={busy || page === 0} onClick={() => go(page - 1)} className="min-h-10 rounded-xl border border-line px-3 disabled:opacity-40">Previous</button><span>Page {page + 1}</span><button type="button" disabled={busy || !more} onClick={() => go(page + 1)} className="min-h-10 rounded-xl border border-line px-3 disabled:opacity-40">Next</button></nav>
  </section>
}
