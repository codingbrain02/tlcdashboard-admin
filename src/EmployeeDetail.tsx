import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
import { positionGroups } from './positions'
import { supabase } from './supabase'
import EmployeeActions, { EmployeeEmailEditor } from './EmployeeActions'
import AttendanceEditor from './AttendanceEditor'
import PasswordReset from './PasswordReset'
import EmojiAvatar from './EmojiAvatar'
import ConfirmDialog, { ChangeReview } from './ConfirmDialog'
import { employeeColumns, serviceMessage, type EmployeeProfile, type EmployeeShift as Shift } from './employeeTypes'

const CountryPhoneInput = lazy(() => import('./CountryPhoneInput'))

const pageSize = 25
const input = 'min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10'
const primaryButton = 'inline-flex min-h-10 items-center justify-center rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}

function registrationInput(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23)
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-line bg-soft/60 p-4">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className={'mt-1 break-words font-semibold text-ink ' + (mono ? 'font-mono text-xs' : 'text-sm')}>{value}</dd>
  </div>
}

export default function EmployeeDetail({ employeeId, canEdit, onBack }: {
  employeeId: string; canEdit: boolean; onBack: () => void
}) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [profileVersion, setProfileVersion] = useState(0)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [historyPage, setHistoryPage] = useState(0)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [historyBusy, setHistoryBusy] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editingSnapshot, setEditingSnapshot] = useState<EmployeeProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [fullName, setFullName] = useState('')
  const [positionChoice, setPositionChoice] = useState('')
  const [otherPosition, setOtherPosition] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [registeredAt, setRegisteredAt] = useState('')
  const [startDate, setStartDate] = useState('')
  const [review, setReview] = useState<{ body: Record<string, unknown>; entries: { label: string; before: string; after: string }[] } | null>(null)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)

  function refreshEmployee() {
    setProfileVersion(value => value + 1)
    setHistoryPage(0)
    setHistoryVersion(value => value + 1)
  }

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let current = true
    void client.from('employee_profiles')
      .select(employeeColumns)
      .eq('id', employeeId).maybeSingle()
      .then(({ data, error }) => {
        if (!current) return
        setProfile(error ? null : data as EmployeeProfile | null)
        setProfileError(error ? 'Could not load this employee profile.' : data ? '' : 'Employee not found.')
        setProfileLoading(false)
      })
    return () => { current = false }
  }, [employeeId, profileVersion])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let current = true
    void client.from('attendance')
      .select('id,clock_in,clock_out,end_reason', { count: 'exact' })
      .eq('user_id', employeeId)
      .order('clock_in', { ascending: false })
      .range(historyPage * pageSize, (historyPage + 1) * pageSize - 1)
      .then(({ data, count, error }) => {
        if (!current) return
        if (error) setHistoryError('Could not load this employee’s attendance.')
        else {
          const records = data as Shift[]
          setShifts(previous => historyPage === 0 ? records : [...new Map([...previous, ...records].map(record => [record.id, record])).values()])
          setTotal(count ?? 0)
          setHasMore((count ?? 0) > (historyPage + 1) * pageSize)
          setHistoryError('')
        }
        setHistoryBusy(false)
      })
    return () => { current = false }
  }, [employeeId, historyPage, historyVersion])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const refreshProfile = () => setProfileVersion(value => value + 1)
    const refreshHistory = () => {
      setHistoryBusy(true)
      setHistoryVersion(value => value + 1)
    }
    const refreshHistoryFromTop = () => {
      setHistoryBusy(true)
      setHistoryPage(0)
      setHistoryVersion(value => value + 1)
    }
    const refreshAll = () => { refreshProfile(); refreshHistory() }
    let connected = false
    let hasConnected = false
    let active = true
    const channel = client.channel(`admin-employee-detail-${employeeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employee_profiles', filter: `id=eq.${employeeId}` }, refreshProfile)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `user_id=eq.${employeeId}` }, refreshHistoryFromTop)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `user_id=eq.${employeeId}` }, refreshHistoryFromTop)
      .subscribe(status => {
        if (!active) return
        connected = status === 'SUBSCRIBED'
        if (connected) {
          if (hasConnected) refreshAll()
          hasConnected = true
        }
      })
    let ticks = 0
    const interval = window.setInterval(() => {
      ticks += 1
      if (document.visibilityState === 'visible' && (!connected || ticks % 5 === 0)) refreshAll()
    }, 60_000)
    window.addEventListener('focus', refreshAll)
    window.addEventListener('online', refreshAll)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshAll)
      window.removeEventListener('online', refreshAll)
      void client.removeChannel(channel)
    }
  }, [employeeId])

  function startEditing() {
    if (!canEdit || !profile) return
    setEditingSnapshot(profile)
    setFullName(profile.full_name)
    const knownPosition = positionGroups.some(group => group.positions.includes(profile.position ?? ''))
    setPositionChoice(knownPosition ? profile.position ?? '' : 'Other')
    setOtherPosition(knownPosition ? '' : profile.position ?? '')
    setPhoneNumber(profile.phone_number ?? '')
    setRegisteredAt(registrationInput(profile.created_at))
    setStartDate(profile.employment_start_date ?? '')
    setSaveError('')
    setSaveNotice('')
    setEditing(true)
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !supabase || saving || !profile) return
    const position = positionChoice === 'Other' ? otherPosition.trim() : positionChoice
    if (!fullName.trim() || !position || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      setSaveError('Enter a name, position and phone number with a country code.')
      return
    }
    setSaveError('')
    const original = editingSnapshot ?? profile
    const nextRegistered = registeredAt === registrationInput(original.created_at) ? original.created_at : new Date(registeredAt).toISOString()
    setReview({
      body: { action: 'update-employee', employeeId, fullName: fullName.trim(), position, phoneNumber, registeredAt: nextRegistered, startDate, revision: original.revision, confirmed: true },
      entries: [
        { label: 'Full name', before: original.full_name, after: fullName.trim() },
        { label: 'Position', before: original.position ?? '', after: position },
        { label: 'Phone', before: original.phone_number ?? '', after: phoneNumber },
        { label: 'Registered', before: dateTime(original.created_at), after: dateTime(nextRegistered) },
        { label: 'Employment start date', before: original.employment_start_date ?? '', after: startDate },
      ],
    })
  }

  async function confirmSave() {
    if (!supabase || !review || saving) return
    setSaving(true); setSaveError('')
    try {
      const result = await supabase.functions.invoke('admin-api', {
        body: review.body,
      })
      if (result.error || result.data?.employee?.id !== employeeId) {
        setSaveError(await serviceMessage(result, 'Could not save employee details. Please try again.'))
        return
      }
      setProfile(result.data.employee as EmployeeProfile)
      setEditing(false)
      setReview(null)
      setSaveNotice('Employee details saved.')
      setProfileVersion(value => value + 1)
    } catch { setSaveError('Could not reach the account service.') }
    finally { setSaving(false) }
  }

  return <div className="space-y-6 text-ink">
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"><span aria-hidden="true">←</span> All employees</button>
    <section className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-soft/60 px-5 py-6 sm:px-7">
        <div className="flex min-w-0 items-center gap-4">{profile && <EmojiAvatar value={profile.avatar_emoji} className="size-14 bg-brand/10 text-3xl" />}<div className="min-w-0"><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Employee profile</span><h1 className="mt-2 break-words text-2xl font-bold tracking-tight">{profile?.full_name || (profileLoading ? 'Loading employee…' : 'Employee')}</h1><p className="mt-1 text-sm text-muted">Contact details and account information</p></div></div>
        <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">{canEdit ? 'Super Administrator' : 'Administrator'}</span>
      </div>
      {profileError && <p role="alert" className="mx-5 mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200 sm:mx-7">{profileError}</p>}
      {saveNotice && <p role="status" className="mx-5 mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200 sm:mx-7">{saveNotice}</p>}
      {profile && <div className="p-5 sm:p-7">
        {editing ? <form onSubmit={save} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="edit-full-name" className="mb-2 block text-sm font-semibold">Full name</label><input id="edit-full-name" required maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} className={input} /></div>
            <div><label htmlFor="edit-position" className="mb-2 block text-sm font-semibold">Position</label><select id="edit-position" required value={positionChoice} onChange={event => setPositionChoice(event.target.value)} className={input}><option value="" disabled>Select a position</option>{positionGroups.map(group => <optgroup key={group.label} label={group.label}>{group.positions.map(position => <option key={position} value={position}>{position}</option>)}</optgroup>)}<option value="Other">Other / custom position</option></select>{positionChoice === 'Other' && <input aria-label="Custom position" required maxLength={120} value={otherPosition} onChange={event => setOtherPosition(event.target.value)} className={input + ' mt-2'} placeholder="Enter position" />}</div>
            <div className="sm:col-span-2"><label htmlFor="edit-phone" className="mb-2 block text-sm font-semibold">Phone number</label><Suspense fallback={<p role="status" className="text-sm text-muted">Loading phone field…</p>}><CountryPhoneInput id="edit-phone" required international defaultCountry="PH" countryCallingCodeEditable={false} limitMaxLength addInternationalOption={false} value={phoneNumber || undefined} onChange={value => setPhoneNumber(value ?? '')} countrySelectProps={{ 'aria-label': 'Phone country' }} className="phone-field min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink" /></Suspense></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Registered<input type="datetime-local" step="0.001" required value={registeredAt} onChange={event => setRegisteredAt(event.target.value)} className={input + ' mt-2'} /></label><label className="text-sm font-semibold">Employment start date<input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} className={input + ' mt-2'} /></label></div>
          <p className="text-xs leading-5 text-muted">Employee IDs stay fixed to preserve record ownership. Account status is managed through the confirmed account controls below.</p>
          {saveError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200">{saveError}</p>}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save details'}</button><button type="button" disabled={saving} onClick={() => { setEditing(false); setSaveError('') }} className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-soft disabled:opacity-50">Cancel</button></div>
        </form> : <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Full name" value={profile.full_name || '—'} />
            <Detail label="Position" value={profile.position || '—'} />
            <Detail label="Employee ID" value={profile.id} mono />
            <Detail label="Email" value={profile.email || '—'} />
            <Detail label="Phone" value={profile.phone_number ? formatPhoneNumberIntl(profile.phone_number) || profile.phone_number : '—'} />
            <Detail label="Registered" value={dateTime(profile.created_at)} />
            <Detail label="Employment start date" value={profile.employment_start_date || 'Not provided'} />
            <Detail label="Account status" value={profile.terminated_at ? 'Terminated' : profile.is_active ? 'Active' : 'Inactive'} />
          </dl>
          {canEdit && <button type="button" onClick={startEditing} className={primaryButton + ' mt-6'}>Edit work details</button>}
        </>}
        {canEdit && !editing && <EmployeeEmailEditor key={profile.email} profile={profile} onChanged={refreshEmployee} />}
        <EmployeeActions profile={profile} onChanged={refreshEmployee} />
        {canEdit && <PasswordReset key={profile.id} targetId={profile.id} name={profile.full_name} />}
      </div>}
    </section>

    <section aria-labelledby="employee-attendance-heading" className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7"><div><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Attendance history</span><h2 id="employee-attendance-heading" className="mt-1 text-xl font-bold tracking-tight">Every shift</h2><p className="mt-1 text-xs text-muted">Newest first · times shown in your device’s time zone</p></div><span className="rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-muted">{shifts.length} of {total} loaded</span></div>
      {historyError && <p role="alert" className="mx-5 mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200 sm:mx-7">{historyError}</p>}
      {canEdit && shifts.length > 0 && <div className="px-5 pb-4 sm:px-7"><label className="text-sm font-semibold">Correct a shift<select value="" onChange={event => { const shift = shifts.find(item => item.id === event.target.value); if (shift) setSelectedShift(shift) }} className={input + ' mt-2'}><option value="" disabled>Select a loaded shift to review and edit</option>{shifts.map(shift => <option key={shift.id} value={shift.id}>{dateTime(shift.clock_in)} — {shift.end_reason === 'terminated' ? 'Terminated' : shift.clock_out ? 'Completed' : 'On duty'}</option>)}</select></label></div>}
      <div className="max-h-[480px] overflow-y-auto border-y border-line">
        {shifts.length ? <>
          <ul className="divide-y divide-line lg:hidden">{shifts.map(shift => <li key={shift.id} className="px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-muted">Shift</span><span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (shift.end_reason === 'terminated' ? 'bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200' : shift.clock_out ? 'bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200')}>{shift.end_reason === 'terminated' ? 'Terminated' : shift.clock_out ? 'Completed' : 'On duty'}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted">Clock in</dt><dd className="mt-1 font-semibold">{dateTime(shift.clock_in)}</dd></div><div><dt className="text-muted">End time</dt><dd className="mt-1 font-semibold">{shift.clock_out ? dateTime(shift.clock_out) : 'In progress'}</dd></div></dl></li>)}</ul>
          <table className="hidden w-full text-left text-sm lg:table"><thead className="sticky top-0 z-10 bg-soft text-xs font-semibold text-muted"><tr><th scope="col" className="px-7 py-3">Clock in</th><th scope="col" className="px-5 py-3">End time</th><th scope="col" className="px-7 py-3">Status</th></tr></thead><tbody className="divide-y divide-line">{shifts.map(shift => <tr key={shift.id}><td className="px-7 py-3.5 font-medium">{dateTime(shift.clock_in)}</td><td className="px-5 py-3.5">{shift.clock_out ? dateTime(shift.clock_out) : 'In progress'}</td><td className="px-7 py-3.5 font-semibold">{shift.end_reason === 'terminated' ? 'Terminated' : shift.clock_out ? 'Completed' : 'On duty'}</td></tr>)}</tbody></table>
        </> : <p role={historyBusy ? 'status' : undefined} className="px-5 py-12 text-center text-sm text-muted">{historyBusy ? 'Loading attendance…' : historyError ? 'Attendance unavailable.' : 'No attendance records yet.'}</p>}
      </div>
      <div className="flex justify-center px-5 py-4">{historyError ? <button type="button" onClick={() => { setHistoryBusy(true); setHistoryVersion(value => value + 1) }} className={primaryButton}>Retry</button> : hasMore ? <button type="button" disabled={historyBusy} onClick={() => { setHistoryBusy(true); setHistoryPage(value => value + 1) }} className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-soft disabled:opacity-50">{historyBusy ? 'Loading…' : 'Load older shifts'}</button> : <span className="text-xs text-muted">{historyBusy ? 'Loading…' : 'All available shifts shown'}</span>}</div>
    </section>
    {review && <ConfirmDialog title="Confirm employee changes" confirmText="Confirm changes" busy={saving} error={saveError} onConfirm={() => void confirmSave()} onCancel={() => setReview(null)}><p>Are you sure you want to change these details for <strong>{profile?.full_name}</strong>?</p><ChangeReview entries={review.entries} /></ConfirmDialog>}
    {selectedShift && profile && canEdit && <AttendanceEditor key={selectedShift.id} shift={selectedShift} employeeId={employeeId} employeeName={profile.full_name} revision={profile.revision} onClose={() => setSelectedShift(null)} onSaved={refreshEmployee} />}
  </div>
}
