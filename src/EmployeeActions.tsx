import { useState } from 'react'
import { supabase } from './supabase'
import { showSuccessToast } from './successNotifications'
import ConfirmDialog, { ChangeReview } from './ConfirmDialog'
import { serviceMessage, type EmployeeProfile } from './employeeTypes'

const field = 'form-field mt-1.5'
const button = 'button-secondary'
const reasons = ['Performance', 'Attendance', 'Misconduct', 'Policy violation', 'End of contract', 'Redundancy', 'Other']
type Action = 'terminate' | 'reverse-termination' | 'rehire' | 'sync-employee-access'
const titles: Record<Action, string> = { terminate: 'Terminate employee', 'reverse-termination': 'Reverse termination', rehire: 'Rehire employee', 'sync-employee-access': 'Synchronize account access' }

export default function EmployeeActions({ profile, onChanged }: { profile: EmployeeProfile; onChanged: () => void }) {
  const [action, setAction] = useState<Action | null>(null)
  const [snapshot, setSnapshot] = useState(profile)
  const [category, setCategory] = useState('')
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [syncWarning, setSyncWarning] = useState('')
  function open(next: Action) { setSnapshot(profile); setCategory(''); setReason(''); setError(''); setAction(next) }
  async function confirm() {
    if (!supabase || !action || busy) return
    setBusy(true); setError(''); setSyncWarning('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: {
        action, employeeId: profile.id, revision: snapshot.revision, category, reason, startDate, confirmed: true,
      } })
      if (result.error || !result.data?.employee) { setError(await serviceMessage(result, 'Could not update this account.')); return }
      if (result.data.syncPending) setSyncWarning(result.data.message || 'Account access synchronization is pending. Please retry.')
      else showSuccessToast(action === 'terminate' ? 'Employee terminated. Account access blocked.' : action === 'rehire' ? 'Employee rehired.' : action === 'reverse-termination' ? 'Termination reversed.' : 'Account access synchronized.')
      setAction(null); onChanged()
    } catch { setError('Could not reach the account service. Please retry.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Employee account controls" className="mt-6 space-y-4 border-t border-line pt-5">
    <div><h2 className="section-title">Employment status</h2><p className="mt-1 text-xs leading-5 text-muted">Termination and rehire actions require confirmation and are recorded in the activity log.</p></div>
    {profile.terminated_at && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200">Terminated {new Date(profile.terminated_at).toLocaleString()}. {profile.termination_reason}{profile.termination_details ? `: ${profile.termination_details}` : ''}</p>}
    <div className="flex flex-wrap gap-2">
      {profile.is_active && <button type="button" onClick={() => open('terminate')} className={button + ' border-rose-300 text-rose-700 dark:text-rose-300'}>Terminate employee</button>}
      {profile.terminated_at && <><button type="button" onClick={() => open('reverse-termination')} className={button}>Reverse termination</button><button type="button" onClick={() => open('rehire')} className={button}>Rehire employee</button></>}
      {profile.auth_sync_pending && <button type="button" onClick={() => open('sync-employee-access')} className={button}>Retry access synchronization</button>}
    </div>
    {syncWarning && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{syncWarning}</p>}
    {action && <ConfirmDialog title={titles[action]} confirmText={titles[action]} danger={action === 'terminate'} busy={busy} error={error} onConfirm={() => void confirm()} onCancel={() => setAction(null)}>
      <p>Are you sure you want to {action === 'reverse-termination' ? 'reverse the termination of' : action === 'sync-employee-access' ? 'synchronize access for' : action} <strong>{snapshot.full_name}</strong>?</p>
      <p className="text-muted">{action === 'terminate' ? 'Their running shift will end as Terminated. They will be signed out and blocked from account actions. Previous records are kept.' : action === 'sync-employee-access' ? 'This retries the sign-in protection for the current account status.' : 'The same account will be restored. Old shifts stay stopped, and the employee must sign in again.'}</p>
      {action === 'terminate' && <label className="block text-sm font-semibold">Reason<select required value={category} onChange={event => setCategory(event.target.value)} className={field}><option value="" disabled>Select a reason</option>{reasons.map(item => <option key={item}>{item}</option>)}</select></label>}
      {action !== 'sync-employee-access' && <label className="block text-sm font-semibold">{action === 'reverse-termination' ? 'Why is this termination being reversed?' : 'Details'}{action === 'rehire' || (action === 'terminate' && category !== 'Other') ? ' (optional)' : ''}<textarea required={action === 'reverse-termination' || (action === 'terminate' && category === 'Other')} maxLength={1500} rows={3} value={reason} onChange={event => setReason(event.target.value)} className={field + ' py-3'} /></label>}
      {action === 'rehire' && <label className="block text-sm font-semibold">New employment start date<input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} className={field} /></label>}
    </ConfirmDialog>}
  </section>
}

export function EmployeeEmailEditor({ profile, onChanged }: { profile: EmployeeProfile; onChanged: () => void }) {
  const [email, setEmail] = useState(profile.email ?? '')
  const [review, setReview] = useState<{ email: string; revision: number; previous: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!supabase || !review || busy) return
    setBusy(true); setError('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: {
        action: 'update-employee-email', employeeId: profile.id, email: review.email, revision: review.revision, confirmed: true,
      } })
      if (result.error) { setError(await serviceMessage(result, 'Could not change email.')); return }
      setReview(null); showSuccessToast('Employee sign-in email updated.'); onChanged()
    } catch { setError('Could not reach the account service.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={event => { event.preventDefault(); setError(''); setReview({ email: email.trim().toLowerCase(), revision: profile.revision, previous: profile.email ?? '' }) }} className="mt-4 max-w-xl space-y-3">
    <label className="block text-sm font-semibold">Sign-in email<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className={field} /></label>
    <p className="text-xs text-muted">The employee will use this address next time they sign in. It changes immediately.</p>
    <button type="submit" disabled={busy || email.trim().toLowerCase() === profile.email?.toLowerCase()} className={button}>Review email change</button>
    {review && <ConfirmDialog title="Change sign-in email?" confirmText="Confirm email change" busy={busy} error={error} onConfirm={() => void save()} onCancel={() => setReview(null)}><p>Change the sign-in email for <strong>{profile.full_name}</strong>?</p><ChangeReview entries={[{ label: 'Email', before: review.previous, after: review.email }]} /></ConfirmDialog>}
  </form>
}
