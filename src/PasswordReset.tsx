import { useId, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import { serviceMessage } from './employeeTypes'

export default function PasswordReset({ targetId, name }: { targetId: string; name: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: { action: 'set-password', targetId, newPassword: password } })
      if (result.error) { setError(await serviceMessage(result, 'Could not change password.')); return }
      setPassword(''); setShow(false); setOpen(false)
      setNotice(`Password changed for ${name}. They can sign in with the new password.`)
    } catch { setError('Password service is temporarily unavailable.') }
    finally { setBusy(false) }
  }
  return <div className="mt-3">
    <button type="button" disabled={busy} aria-expanded={open} onClick={() => { setPassword(''); setShow(false); setError(''); setNotice(''); setOpen(value => !value) }} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold text-brand hover:bg-soft disabled:opacity-50">{open ? 'Cancel password change' : 'Change password'}</button>
    {open && <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-line bg-soft p-4">
      <label htmlFor={id} className="block text-sm font-semibold">New password for {name}</label>
      <div className="relative"><input id={id} type={show ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="min-h-12 w-full rounded-xl border border-line bg-surface py-3 pr-16 pl-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" /><button type="button" onClick={() => setShow(value => !value)} aria-controls={id} aria-label={show ? 'Hide new password' : 'Show new password'} className="absolute inset-y-0 right-2 px-2 text-xs font-bold text-brand">{show ? 'Hide' : 'Show'}</button></div>
      <p className="text-xs leading-5 text-muted">At least 12 characters. Save applies immediately and signs them out. Attendance keeps running; terminated accounts remain disabled.</p>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-50">{busy ? 'Saving…' : 'Save password'}</button>
    </form>}
    {notice && <p role="status" className="mt-3 text-sm text-muted">{notice}</p>}
  </div>
}
