import { lazy, Suspense, useEffect, useState } from 'react'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
import { supabase } from './supabase'
import { positionGroups } from './positions'
import EmojiAvatar from './EmojiAvatar'

const EmployeeDetail = lazy(() => import('./EmployeeDetail'))

type Employee = {
  id: string
  full_name: string
  email: string
  position: string | null
  phone_number: string | null
  is_active: boolean
  terminated_at: string | null
  avatar_emoji: string
}
type Shift = {
  id: string
  user_id: string
  full_name: string
  clock_in: string
  clock_out: string | null
  end_reason: 'clock_out' | 'terminated'
}

function localDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function localTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value))
}

function DateStamp({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs font-semibold text-brand">In progress</span>
  return <time dateTime={value} className="block tabular-nums">
    <span className="block font-medium text-ink">{localDate(value)}</span>
    <span className="mt-0.5 block text-xs text-muted">{localTime(value)}</span>
  </time>
}

function StatusBadge({ active, activeText, inactiveText }: {
  active: boolean; activeText: string; inactiveText: string
}) {
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ' + (active
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300'
    : inactiveText === 'Terminated' ? 'bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300')}>
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {active ? activeText : inactiveText}
  </span>
}

function Pager({ page, hasMore, busy, go, label }: {
  page: number; hasMore: boolean; busy: boolean; go: (page: number) => void; label: string
}) {
  const control = 'button-secondary'
  return <nav aria-label={label + ' pages'} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-7">
    <span className="text-xs text-muted">{label} <span className="font-semibold text-ink">/ Page {page + 1}</span></span>
    <div className="flex items-center gap-2">
      <button type="button" disabled={busy || page === 0} onClick={() => go(page - 1)} className={control}>Previous</button>
      <button type="button" disabled={busy || !hasMore} onClick={() => go(page + 1)} className={control}>Next</button>
    </div>
  </nav>
}

export default function Overview({ onCreateEmployee, mode = 'overview', canEdit = false, selectedEmployeeId = null, onSelectEmployee, refreshVersion = 0, onRefreshed }: {
  onCreateEmployee: () => void; mode?: 'overview' | 'employees'; canEdit?: boolean
  selectedEmployeeId?: string | null; onSelectEmployee?: (id: string | null) => void
  refreshVersion?: number; onRefreshed?: () => void
}) {
  const showAttendance = mode === 'overview'
  const showEmployees = mode === 'employees'
  const [employeePage, setEmployeePage] = useState(0)
  const [nameSearch, setNameSearch] = useState('')
  const [positionSearch, setPositionSearch] = useState('')
  const [employeeStatus, setEmployeeStatus] = useState('all')
  const [employeeSort, setEmployeeSort] = useState('newest')
  const [attendancePage, setAttendancePage] = useState(0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employeesMore, setEmployeesMore] = useState(false)
  const [shiftsMore, setShiftsMore] = useState(false)
  const [employeesBusy, setEmployeesBusy] = useState(true)
  const [shiftsBusy, setShiftsBusy] = useState(true)
  const [employeesError, setEmployeesError] = useState('')
  const [shiftsError, setShiftsError] = useState('')
  const [employeeRefresh, setEmployeeRefresh] = useState(0)
  const [attendanceRefresh, setAttendanceRefresh] = useState(0)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let attendanceDebounce: number | undefined
    let employeeDebounce: number | undefined
    const refreshAttendance = () => setAttendanceRefresh(current => current + 1)
    const refreshEmployees = () => setEmployeeRefresh(current => current + 1)
    const refreshAll = () => {
      if (showEmployees) refreshEmployees()
      if (showAttendance) refreshAttendance()
    }
    const queueAttendance = () => {
      window.clearTimeout(attendanceDebounce)
      attendanceDebounce = window.setTimeout(refreshAttendance, 250)
    }
    const queueEmployees = () => {
      window.clearTimeout(employeeDebounce)
      employeeDebounce = window.setTimeout(refreshEmployees, 250)
    }
    let connected = false
    let hasConnected = false
    let active = true
    const channel = client.channel(showAttendance ? 'admin-overview' : 'admin-employees')
    if (showEmployees) channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_profiles' }, queueEmployees)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employee_profiles' }, queueEmployees)
    if (showAttendance) channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, queueAttendance)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance' }, queueAttendance)
    channel.subscribe(status => {
      if (!active) return
      connected = status === 'SUBSCRIBED'
      setLive(connected)
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
      window.clearTimeout(attendanceDebounce)
      window.clearTimeout(employeeDebounce)
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshAll)
      window.removeEventListener('online', refreshAll)
      void client.removeChannel(channel)
    }
  }, [showAttendance, showEmployees])

  useEffect(() => {
    if (!supabase || !showEmployees) return
    const client = supabase
    let live = true
    const timer = window.setTimeout(() => {
      void client.functions.invoke('admin-api', { body: {
        action: 'list-employees', page: employeePage, name: nameSearch.trim(),
        position: positionSearch.trim(), status: employeeStatus, sort: employeeSort,
      } })
        .then(result => {
          if (!live) return
          if (result.error || !Array.isArray(result.data?.employees)) {
            setEmployees([])
            setEmployeesMore(false)
            setEmployeesError('Could not load employees.')
          }
          else { setEmployees(result.data.employees); setEmployeesMore(Boolean(result.data.hasMore)); setEmployeesError('') }
        }).catch(() => {
          if (!live) return
          setEmployees([])
          setEmployeesMore(false)
          setEmployeesError('Could not load employees.')
        })
        .finally(() => { if (live) setEmployeesBusy(false) })
    }, nameSearch || positionSearch ? 180 : 0)
    return () => { live = false; window.clearTimeout(timer) }
  }, [employeePage, employeeRefresh, employeeSort, employeeStatus, nameSearch, positionSearch, showEmployees])

  useEffect(() => {
    if (!supabase || !showAttendance) return
    let live = true
    void supabase.functions.invoke('admin-api', { body: { action: 'list-attendance', page: attendancePage } })
      .then(result => {
        if (!live) return
        if (result.error || !Array.isArray(result.data?.shifts)) setShiftsError('Could not load attendance.')
        else { setShifts(result.data.shifts); setShiftsMore(Boolean(result.data.hasMore)); setShiftsError('') }
      }).catch(() => { if (live) setShiftsError('Could not load attendance.') })
      .finally(() => { if (live) { setShiftsBusy(false); onRefreshed?.() } })
    return () => { live = false }
  }, [attendancePage, attendanceRefresh, showAttendance, refreshVersion, onRefreshed])

  const activeShifts = shifts.filter(shift => !shift.clock_out).length
  const employeeFiltersActive = Boolean(nameSearch || positionSearch || employeeStatus !== 'all' || employeeSort !== 'newest')
  const employeeSearchActive = Boolean(nameSearch || positionSearch || employeeStatus !== 'all')

  function resetEmployeeFilters() {
    setNameSearch('')
    setPositionSearch('')
    setEmployeeStatus('all')
    setEmployeeSort('newest')
    setEmployeePage(0)
    setEmployeesBusy(true)
  }

  if (showEmployees && selectedEmployeeId) {
    return <Suspense fallback={<p role="status" className="text-sm text-muted">Loading employee details…</p>}><EmployeeDetail key={selectedEmployeeId} employeeId={selectedEmployeeId} canEdit={canEdit} onBack={() => onSelectEmployee?.(null)} /></Suspense>
  }

  return <section id={showAttendance ? 'overview' : 'employees'} aria-labelledby={showAttendance ? 'overview-heading' : 'employees-heading'} className="space-y-6 text-ink">
    {showEmployees && <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 id="employees-heading" className="page-title">Employees</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Employee profiles, contact information, and attendance records.</p></div><button type="button" onClick={onCreateEmployee} className="button-primary"><span aria-hidden="true">＋</span>Create employee</button></div>}
    {showAttendance && <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 id="overview-heading" className="page-title">Attendance overview</h1><p className="mt-2 text-sm leading-6 text-muted">Monitor shifts and review your team’s attendance.</p></div>
        <button type="button" onClick={onCreateEmployee} className="button-primary"><span aria-hidden="true">＋</span>Create employee</button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Attendance on this page">
        <div className="workspace-panel p-4 sm:p-5"><span className="text-xs font-medium text-muted">Recorded shifts</span><strong className="mt-3 block text-[28px] leading-none font-semibold tracking-tight tabular-nums">{shiftsBusy && !shifts.length ? '—' : shifts.length}</strong><span className="mt-2 block text-[11px] text-muted">On this page</span></div>
        <div className="workspace-panel p-4 sm:p-5"><span className="flex items-center gap-2 text-xs font-medium text-muted"><span className="size-1.5 rounded-full bg-emerald-500" />On duty</span><strong className="mt-3 block text-[28px] leading-none font-semibold tracking-tight tabular-nums">{shiftsBusy && !shifts.length ? '—' : activeShifts}</strong><span className="mt-2 block text-[11px] text-muted">In the listed shifts</span></div>
        <div className="workspace-panel col-span-2 p-4 sm:col-span-1 sm:p-5"><span className="text-xs font-medium text-muted">Ended shifts</span><strong className="mt-3 block text-[28px] leading-none font-semibold tracking-tight tabular-nums">{shiftsBusy && !shifts.length ? '—' : shifts.length - activeShifts}</strong><span className="mt-2 block text-[11px] text-muted">Completed or terminated on this page</span></div>
      </div>
    </>}

    {showEmployees && <section aria-labelledby="employee-directory-heading" className="workspace-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <h2 id="employee-directory-heading" className="section-title">Employee directory</h2>
            <p className="mt-0.5 text-xs text-muted">Search and filter your team</p>
          </div>
        </div>
        <span role="status" className="text-xs text-muted">{employeesBusy ? 'Updating…' : employees.length + ' on this page'}</span>
      </div>
      <div role="search" aria-label="Filter employees" className="grid gap-3 border-t border-line bg-soft/40 px-5 py-4 sm:grid-cols-2 sm:px-7 xl:grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_minmax(130px,.8fr)_minmax(160px,1fr)_auto] xl:items-end">
        <label className="block min-w-0 text-xs font-semibold text-muted">Name or employee ID
          <input type="search" value={nameSearch} maxLength={80} onChange={event => { setNameSearch(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} placeholder="Name or full employee ID" autoComplete="off" className="form-field mt-1.5 font-normal" />
        </label>
        <label className="block min-w-0 text-xs font-semibold text-muted">Position
          <input type="search" list="employee-position-options" value={positionSearch} maxLength={120} onChange={event => { setPositionSearch(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} placeholder="Any position" autoComplete="off" className="form-field mt-1.5 font-normal" />
          <datalist id="employee-position-options">{positionGroups.flatMap(group => group.positions).map(position => <option key={position} value={position} />)}</datalist>
        </label>
        <label className="block min-w-0 text-xs font-semibold text-muted">Status
          <select value={employeeStatus} onChange={event => { setEmployeeStatus(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} className="form-field mt-1.5 font-normal"><option value="all">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option></select>
        </label>
        <label className="block min-w-0 text-xs font-semibold text-muted">Sort by
          <select value={employeeSort} onChange={event => { setEmployeeSort(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} className="form-field mt-1.5 font-normal"><option value="newest">Newest added</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="position-asc">Position A–Z</option><option value="position-desc">Position Z–A</option></select>
        </label>
        <button type="button" disabled={!employeeFiltersActive} onClick={resetEmployeeFilters} className="button-secondary min-h-11 sm:col-span-2 xl:col-span-1">Clear filters</button>
      </div>
      {employeesError && <p role="alert" className="mx-5 mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 sm:mx-7">{employeesError} <button type="button" aria-label="Retry employees" onClick={() => { setEmployeesBusy(true); setEmployeeRefresh(value => value + 1) }} className="font-semibold underline underline-offset-2">Retry</button></p>}
      <div id="employee-results" aria-busy={employeesBusy}>
      {employees.length ? <>
        <ul className="divide-y divide-line border-t border-line lg:hidden">
          {employees.map(employee => <li key={employee.id} className="px-5 py-4 sm:px-7">
            <div className="flex items-start gap-3">
              <EmojiAvatar value={employee.avatar_emoji} className="size-10 bg-brand/10 text-2xl" />
              <div className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold leading-5">{employee.full_name || 'Unnamed'}</strong>
                <span className="mt-1 block break-all text-xs text-muted">{employee.email}</span>
              </div>
              <StatusBadge active={employee.is_active} activeText="Active" inactiveText={employee.terminated_at ? 'Terminated' : 'Inactive'} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 pl-[52px] text-xs">
              <div className="min-w-0"><dt className="text-muted">Position</dt><dd className="mt-1 break-words font-medium">{employee.position || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-muted">Phone</dt><dd className="mt-1 break-words font-medium">{employee.phone_number ? formatPhoneNumberIntl(employee.phone_number) || employee.phone_number : '—'}</dd></div>
            </dl>
            <button type="button" onClick={() => onSelectEmployee?.(employee.id)} className="mt-4 min-h-10 rounded-xl border border-line bg-surface px-4 text-xs font-semibold text-brand transition hover:border-brand hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">View profile and attendance</button>
          </li>)}
        </ul>
        <div className="hidden overflow-x-auto border-t border-line lg:block">
          <table className="workspace-table min-w-[760px]">
            <thead className="bg-soft text-[11px] font-semibold text-muted">
              <tr><th scope="col" className="px-7 py-3">Employee</th><th scope="col" className="px-4 py-3">Position</th><th scope="col" className="px-4 py-3">Phone</th><th scope="col" className="px-4 py-3">Account status</th><th scope="col" className="px-7 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.map(employee => <tr key={employee.id} className="transition-colors hover:bg-soft">
                <td className="px-7 py-4"><div className="flex items-center gap-3"><EmojiAvatar value={employee.avatar_emoji} className="size-10 bg-brand/10 text-2xl" /><div className="min-w-0"><strong className="block font-semibold">{employee.full_name || 'Unnamed'}</strong><span className="block break-all text-xs text-muted">{employee.email}</span></div></div></td>
                <td className="px-4 py-4">{employee.position || '—'}</td>
                <td className="px-4 py-4 whitespace-nowrap">{employee.phone_number ? formatPhoneNumberIntl(employee.phone_number) || employee.phone_number : '—'}</td>
                <td className="px-4 py-4"><StatusBadge active={employee.is_active} activeText="Active" inactiveText={employee.terminated_at ? 'Terminated' : 'Inactive'} /></td>
                <td className="px-7 py-4"><button type="button" onClick={() => onSelectEmployee?.(employee.id)} className="button-secondary min-h-9 text-brand">View profile</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </> : <p role={employeesBusy ? 'status' : undefined} className="border-t border-line px-7 py-12 text-center text-sm text-muted">{employeesBusy ? 'Finding employees…' : employeesError ? 'Employee list unavailable.' : employeeSearchActive ? 'No employees match these filters.' : 'No employee accounts yet.'}</p>}
      </div>
      <Pager label="Employees" page={employeePage} hasMore={employeesMore} busy={employeesBusy} go={page => { setEmployeesBusy(true); setEmployeePage(page) }} />
    </section>}

    {showAttendance && <section aria-labelledby="attendance-heading" className="workspace-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <h2 id="attendance-heading" className="section-title">Attendance records</h2>
            <p className="mt-1 text-xs text-muted">Newest first · times shown in your device’s time zone</p>
          </div>
        </div>
        <span role="status" className="inline-flex items-center gap-2 text-xs text-muted" title={live ? 'Live updates connected' : 'Reconnecting · checks every 60 seconds'}><span aria-hidden="true" className={'size-1.5 rounded-full ' + (live ? 'bg-emerald-500' : 'bg-amber-500')} />{live ? 'Live updates' : 'Reconnecting…'}</span>
      </div>
      {shiftsError && <p role="alert" className="mx-5 mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 sm:mx-7">{shiftsError} <button type="button" aria-label="Retry attendance" onClick={() => { setShiftsBusy(true); setAttendanceRefresh(value => value + 1) }} className="font-semibold underline underline-offset-2">Retry</button></p>}
      {shifts.length ? <>
        <ul className="divide-y divide-line border-t border-line lg:hidden">
          {shifts.map(shift => <li key={shift.id} className="px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-semibold">{shift.full_name || 'Unnamed'}</strong>
              <StatusBadge active={!shift.clock_out} activeText="On duty" inactiveText={shift.end_reason === 'terminated' ? 'Terminated' : 'Completed'} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="mb-1 text-muted">Clock in</dt><dd><DateStamp value={shift.clock_in} /></dd></div>
              <div><dt className="mb-1 text-muted">End time</dt><dd><DateStamp value={shift.clock_out} /></dd></div>
            </dl>
          </li>)}
        </ul>
        <div className="hidden overflow-x-auto border-t border-line lg:block">
          <table className="workspace-table min-w-[680px]">
            <thead className="bg-soft text-[11px] font-semibold text-muted">
              <tr><th scope="col" className="px-7 py-3">Employee</th><th scope="col" className="px-4 py-3">Clock in</th><th scope="col" className="px-4 py-3">End time</th><th scope="col" className="px-7 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shifts.map(shift => <tr key={shift.id} className="transition-colors hover:bg-soft">
                <td className="px-7 py-4 font-semibold">{shift.full_name || 'Unnamed'}</td>
                <td className="px-4 py-4"><DateStamp value={shift.clock_in} /></td>
                <td className="px-4 py-4"><DateStamp value={shift.clock_out} /></td>
                <td className="px-7 py-4"><StatusBadge active={!shift.clock_out} activeText="On duty" inactiveText={shift.end_reason === 'terminated' ? 'Terminated' : 'Completed'} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </> : <p role={shiftsBusy ? 'status' : undefined} className="border-t border-line px-7 py-12 text-center text-sm text-muted">{shiftsBusy ? 'Loading attendance records…' : shiftsError ? 'Attendance unavailable.' : 'No attendance records yet.'}</p>}
      <Pager label="Attendance" page={attendancePage} hasMore={shiftsMore} busy={shiftsBusy} go={page => { setShiftsBusy(true); setAttendancePage(page) }} />
    </section>}
  </section>
}
