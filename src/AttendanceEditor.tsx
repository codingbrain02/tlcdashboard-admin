import { useState } from 'react'
import { supabase } from './supabase'
import { showSuccessToast } from './successNotifications'
import ConfirmDialog, { ChangeReview } from './ConfirmDialog'
import { serviceMessage, type EmployeeShift } from './employeeTypes'

const field = 'mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink'
function localInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23)
}
export default function AttendanceEditor({ shift, employeeId, employeeName, revision, onClose, onSaved }: {
  shift: EmployeeShift; employeeId: string; employeeName: string; revision: number; onClose: () => void; onSaved: () => void
}) {
  const [clockIn, setClockIn] = useState(() => localInput(shift.clock_in))
  const [expectedRevision] = useState(revision)
  const [clockOut, setClockOut] = useState(() => localInput(shift.clock_out))
  const [endReason, setEndReason] = useState(shift.end_reason)
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (!review) { setReview(true); return }
    if (!supabase || busy) return
    setBusy(true); setError('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: {
        action: 'update-attendance', employeeId, revision: expectedRevision, shiftId: shift.id,
        clockIn: clockIn === localInput(shift.clock_in) ? shift.clock_in : new Date(clockIn).toISOString(),
        clockOut: clockOut === localInput(shift.clock_out) ? shift.clock_out : clockOut ? new Date(clockOut).toISOString() : null,
        endReason, expectedClockIn: shift.clock_in, expectedClockOut: shift.clock_out,
        expectedEndReason: shift.end_reason, reason, confirmed: true,
      } })
      if (result.error) { setError(await serviceMessage(result, 'Could not correct attendance.')); return }
      onSaved(); onClose(); showSuccessToast('Attendance record updated.')
    } catch { setError('Could not save this correction. Check the dates and try again.') }
    finally { setBusy(false) }
  }
  return <ConfirmDialog title={review ? 'Confirm attendance correction' : 'Correct attendance'} confirmText={review ? 'Confirm correction' : 'Review correction'} busy={busy} error={error} onConfirm={() => void confirm()} onCancel={onClose}>
    <p>Attendance for <strong>{employeeName}</strong>. Times use your device’s time zone.</p>
    {review ? <><ChangeReview entries={[
      { label: 'Clock in', before: new Date(shift.clock_in).toLocaleString(), after: new Date(clockIn).toLocaleString() },
      { label: 'Clock out', before: shift.clock_out ? new Date(shift.clock_out).toLocaleString() : 'In progress', after: clockOut ? new Date(clockOut).toLocaleString() : 'In progress' },
      { label: 'End status', before: shift.end_reason === 'terminated' ? 'Terminated' : 'Normal clock-out', after: endReason === 'terminated' ? 'Terminated' : 'Normal clock-out' },
    ]} /><p><strong>Reason:</strong> {reason}</p><button type="button" className="text-sm font-semibold text-brand underline" onClick={() => { setReview(false); setError('') }}>Back to editing</button></> : <>
      <label className="block font-semibold">Clock in<input type="datetime-local" step="0.001" required value={clockIn} onChange={event => setClockIn(event.target.value)} className={field} /></label>
      <label className="block font-semibold">Clock out<input type="datetime-local" step="0.001" value={clockOut} onChange={event => setClockOut(event.target.value)} className={field} /></label>
      <p className="text-xs text-muted">An empty clock-out keeps the shift open. Terminated employees cannot have an open shift.</p>
      <label className="block font-semibold">End status<select value={endReason} onChange={event => setEndReason(event.target.value as EmployeeShift['end_reason'])} className={field}><option value="clock_out">Normal clock-out</option><option value="terminated">Terminated</option></select></label>
      <label className="block font-semibold">Reason for correction<textarea required maxLength={1500} rows={3} value={reason} onChange={event => setReason(event.target.value)} className={field + ' py-3'} /></label>
    </>}
  </ConfirmDialog>
}
