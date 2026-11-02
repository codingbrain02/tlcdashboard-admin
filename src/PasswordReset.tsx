import { useId, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import { showSuccessToast } from './successNotifications'
import { serviceMessage } from './employeeTypes'

export default function PasswordReset({ targetId, name }: { targetId: string; name: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true); setError('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: { action: 'set-password', targetId, newPassword: password } })
      if (result.error) { setError(await serviceMessage(result, 'Could not change password.')); return }
      setPassword(''); setShow(false); setOpen(false)
      showSuccessToast(`Password changed for ${name}.`)
    } catch { setError('Password service is temporarily unavailable.') }
    finally { setBusy(false) }
  }
  return <div className="mt-3">
    <button type="button" disabled={busy} aria-expanded={open} onClick={() => { setPassword(''); setShow(false); setError(''); setOpen(value => !value) }} className="button-secondary text-brand">{open ? 'Cancel password change' : 'Change password'}</button>
    {open && <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-line bg-soft p-4">
      <label htmlFor={id} className="block text-sm font-semibold">New password for {name}</label>
      <div className="relative"><input id={id} type={show ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="form-field py-3 pr-16" /><button type="button" onClick={() => setShow(value => !value)} aria-controls={id} aria-label={show ? 'Hide new password' : 'Show new password'} className="absolute inset-y-0 right-2 px-2 text-xs font-bold text-brand">{show ? 'Hide' : 'Show'}</button></div>
      <p className="text-xs leading-5 text-muted">At least 12 characters. Save applies immediately and signs them out. Attendance keeps running; terminated accounts remain disabled.</p>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <button type="submit" disabled={busy} className="button-primary">{busy ? 'Saving…' : 'Save password'}</button>
    </form>}
  </div>
}
