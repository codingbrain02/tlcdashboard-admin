import { useState } from 'react'
import { supabase } from './supabase'
import ConfirmDialog from './ConfirmDialog'
import { serviceMessage } from './employeeTypes'

export default function PasswordReset({ targetId, name }: { targetId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState('')
  async function reset() {
    if (!supabase || busy) return
    setBusy(true); setError('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: { action: 'reset-password', targetId, currentPassword: current, confirmed: true } })
      if (result.error || !result.data?.temporaryPassword) { setError(await serviceMessage(result, 'Could not reset password.')); return }
      setIssued(result.data.temporaryPassword); setCurrent(''); setOpen(false)
    } catch { setError('Password service is temporarily unavailable.') }
    finally { setBusy(false) }
  }
  return <div className="mt-3">
    <button type="button" onClick={() => { setCurrent(''); setError(''); setIssued(''); setOpen(true) }} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold text-brand hover:bg-soft">Reset password</button>
    {open && <ConfirmDialog title="Reset account password?" confirmText="Reset password" busy={busy} error={error} onConfirm={() => void reset()} onCancel={() => { setOpen(false); setCurrent('') }}>
      <p>Reset the password for <strong>{name}</strong>? Existing sessions will lose access. Share the temporary password privately; they must change it at next sign-in. This does not end an attendance shift or reactivate a terminated account.</p>
      <label className="block font-semibold">Your Super Admin password<input type="password" required maxLength={128} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-soft px-4 text-sm text-ink" /></label>
    </ConfirmDialog>}
    {issued && <div role="status" className="mt-3 space-y-3 rounded-xl border border-line bg-soft p-4 text-sm"><p>Temporary password for <strong>{name}</strong>. Copy it now; it is not saved in this interface.</p><code className="block break-all select-all">{issued}</code><button type="button" onClick={() => setIssued('')} className="min-h-10 font-semibold text-brand underline">Dismiss password</button></div>}
  </div>
}
