import { lazy, Suspense, useEffect, useState } from 'react'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
import { supabase } from './supabase'
import { positionGroups } from './positions'

const EmployeeDetail = lazy(() => import('./EmployeeDetail'))

type Employee = {
  id: string
  full_name: string
  email: string
  position: string | null
  phone_number: string | null
  is_active: boolean
}
type Shift = {
  id: string
  user_id: string
  full_name: string
  clock_in: string
  clock_out: string | null
}

function localDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function localTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value))
}

function initials(value: string | null | undefined) {
  const names = (value || '').trim().split(/\s+/).filter(Boolean)
  return (names.length > 1 ? names[0][0] + names[names.length - 1][0] : names[0]?.slice(0, 2) || '?').toLocaleUpperCase()
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
    : 'bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300')}>
    <span aria-hidden="true" className={'size-1.5 rounded-full ' + (active ? 'bg-emerald-500' : 'bg-slate-400')} />
    {active ? activeText : inactiveText}
  </span>
}

function Pager({ page, hasMore, busy, go, label }: {
  page: number; hasMore: boolean; busy: boolean; go: (page: number) => void; label: string
}) {
  const control = 'min-h-10 rounded-xl border border-line bg-surface px-3.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink'
  return <nav aria-label={label + ' pages'} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-7">
    <span className="text-xs text-muted">{label} <span className="font-semibold text-ink">/ Page {page + 1}</span></span>
    <div className="flex items-center gap-2">
      <button type="button" disabled={busy || page === 0} onClick={() => go(page - 1)} className={control}>Previous</button>
      <button type="button" disabled={busy || !hasMore} onClick={() => go(page + 1)} className={control}>Next</button>
    </div>
  </nav>
}

export default function Overview({ onCreateEmployee, mode = 'overview', canEdit = false }: { onCreateEmployee: () => void; mode?: 'overview' | 'employees'; canEdit?: boolean }) {
  const showAttendance = mode === 'overview'
  const showEmployees = mode === 'employees'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
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
      .finally(() => { if (live) setShiftsBusy(false) })
    return () => { live = false }
  }, [attendancePage, attendanceRefresh, showAttendance])

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
    return <Suspense fallback={<p role="status" className="text-sm text-muted">Loading employee details…</p>}><EmployeeDetail key={selectedEmployeeId} employeeId={selectedEmployeeId} canEdit={canEdit} onBack={() => setSelectedEmployeeId(null)} /></Suspense>
  }

  return <section id={showAttendance ? 'overview' : 'employees'} aria-labelledby={showAttendance ? 'overview-heading' : 'employees-heading'} className="space-y-6 text-ink">
    {showAttendance && <div className="relative isolate overflow-hidden rounded-[28px] bg-[#3434ae] px-6 py-7 text-white shadow-[0_24px_55px_-36px_rgba(55,55,170,.8)] sm:px-8 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full bg-[#7778ff]/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 size-52 rounded-full bg-[#7778ff]/20 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,370px)] lg:items-end">
        <div>
          <span className="text-[11px] font-bold tracking-[.18em] text-white/75">TEAM OVERVIEW</span>
          <h2 id="overview-heading" className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Your team at a glance.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Review attendance activity and current shifts in one place.</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span role="status" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <span aria-hidden="true" className={'size-2 rounded-full ' + (live ? 'bg-emerald-300' : 'bg-amber-300')} />
              {live ? 'Live updates connected' : 'Reconnecting · checks every 30 seconds'}
            </span>
            <span className="text-xs text-white/75">Times shown in your device’s time zone</span>
          </div>
          <button type="button" onClick={onCreateEmployee} className="mt-7 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#303398] shadow-sm transition hover:bg-[#eef0ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Create employee <span aria-hidden="true">→</span></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
            <span className="block text-[11px] font-semibold tracking-wide text-white/75">RECENT SHIFTS</span>
            <strong className="mt-3 block text-3xl font-semibold tabular-nums">{shiftsBusy && !shifts.length ? '—' : shifts.length}</strong>
            <span className="mt-1 block text-xs text-white/75">On the current page</span>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
            <span className="block text-[11px] font-semibold tracking-wide text-white/75">ON DUTY</span>
            <strong className="mt-3 block text-3xl font-semibold tabular-nums">{shiftsBusy && !shifts.length ? '—' : activeShifts}</strong>
            <span className="mt-1 block text-xs text-white/75">In listed shifts</span>
          </div>
        </div>
      </div>
    </div>}

    {showEmployees && <section aria-labelledby="employees-heading" className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-xs font-extrabold text-brand">01</span>
          <div>
            <h3 id="employees-heading" className="text-lg font-bold tracking-tight">Employee directory</h3>
            <p className="mt-0.5 text-xs text-muted">Your team and their contact details</p>
          </div>
        </div>
        <span role="status" className="rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-muted">{employeesBusy ? 'Updating…' : employees.length + ' on this page'}</span>
      </div>
      <div role="search" aria-label="Filter employees" className="grid gap-3 border-t border-line bg-soft/40 px-5 py-4 sm:grid-cols-2 sm:px-7 xl:grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_minmax(130px,.8fr)_minmax(160px,1fr)_auto] xl:items-end">
        <label className="block min-w-0 text-xs font-semibold text-muted">Search by name
          <input type="search" value={nameSearch} maxLength={80} onChange={event => { setNameSearch(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} placeholder="Name or part of a name" autoComplete="off" className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
        </label>
        <label className="block min-w-0 text-xs font-semibold text-muted">Position
          <input type="search" list="employee-position-options" value={positionSearch} maxLength={120} onChange={event => { setPositionSearch(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} placeholder="Any position" autoComplete="off" className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
          <datalist id="employee-position-options">{positionGroups.flatMap(group => group.positions).map(position => <option key={position} value={position} />)}</datalist>
        </label>
        <label className="block min-w-0 text-xs font-semibold text-muted">Status
          <select value={employeeStatus} onChange={event => { setEmployeeStatus(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"><option value="all">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </label>
        <label className="block min-w-0 text-xs font-semibold text-muted">Sort by
          <select value={employeeSort} onChange={event => { setEmployeeSort(event.target.value); setEmployeePage(0); setEmployeesBusy(true) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"><option value="newest">Newest added</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="position-asc">Position A–Z</option><option value="position-desc">Position Z–A</option></select>
        </label>
        <button type="button" disabled={!employeeFiltersActive} onClick={resetEmployeeFilters} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-brand transition hover:border-brand hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2 xl:col-span-1">Clear filters</button>
      </div>
      {employeesError && <p role="alert" className="mx-5 mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 sm:mx-7">{employeesError}</p>}
      <div id="employee-results" aria-busy={employeesBusy}>
      {employees.length ? <>
        <ul className="divide-y divide-line border-t border-line lg:hidden">
          {employees.map(employee => <li key={employee.id} className="px-5 py-4 sm:px-7">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-xs font-bold text-brand">{initials(employee.full_name)}</span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold leading-5">{employee.full_name || 'Unnamed'}</strong>
                <span className="mt-1 block break-all text-xs text-muted">{employee.email}</span>
              </div>
              <StatusBadge active={employee.is_active} activeText="Active" inactiveText="Inactive" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 pl-[52px] text-xs">
              <div className="min-w-0"><dt className="text-muted">Position</dt><dd className="mt-1 break-words font-medium">{employee.position || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-muted">Phone</dt><dd className="mt-1 break-words font-medium">{employee.phone_number ? formatPhoneNumberIntl(employee.phone_number) || employee.phone_number : '—'}</dd></div>
            </dl>
            <button type="button" onClick={() => setSelectedEmployeeId(employee.id)} className="mt-4 min-h-10 rounded-xl border border-line bg-surface px-4 text-xs font-semibold text-brand transition hover:border-brand hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">View profile and attendance</button>
          </li>)}
        </ul>
        <div className="hidden overflow-x-auto border-t border-line lg:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-soft text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr><th scope="col" className="px-7 py-3">Employee</th><th scope="col" className="px-4 py-3">Position</th><th scope="col" className="px-4 py-3">Phone</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-7 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.map(employee => <tr key={employee.id} className="transition-colors hover:bg-soft">
                <td className="px-7 py-4"><div className="flex items-center gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-xs font-bold text-brand">{initials(employee.full_name)}</span><div className="min-w-0"><strong className="block font-semibold">{employee.full_name || 'Unnamed'}</strong><span className="block break-all text-xs text-muted">{employee.email}</span></div></div></td>
                <td className="px-4 py-4">{employee.position || '—'}</td>
                <td className="px-4 py-4 whitespace-nowrap">{employee.phone_number ? formatPhoneNumberIntl(employee.phone_number) || employee.phone_number : '—'}</td>
                <td className="px-4 py-4"><StatusBadge active={employee.is_active} activeText="Active" inactiveText="Inactive" /></td>
                <td className="px-7 py-4"><button type="button" onClick={() => setSelectedEmployeeId(employee.id)} className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold text-brand transition hover:border-brand hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">View profile</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </> : <p role={employeesBusy ? 'status' : undefined} className="border-t border-line px-7 py-12 text-center text-sm text-muted">{employeesBusy ? 'Finding employees…' : employeesError ? 'Employee list unavailable.' : employeeSearchActive ? 'No employees match these filters.' : 'No employee accounts yet.'}</p>}
      </div>
      <Pager label="Employees" page={employeePage} hasMore={employeesMore} busy={employeesBusy} go={page => { setEmployeesBusy(true); setEmployeePage(page) }} />
    </section>}

    {showAttendance && <section aria-labelledby="attendance-heading" className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-xs font-extrabold text-brand">02</span>
          <div>
            <h3 id="attendance-heading" className="text-lg font-bold tracking-tight">Attendance activity</h3>
            <p className="mt-0.5 text-xs text-muted">Latest shifts first · local time</p>
          </div>
        </div>
        <span className="rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-muted">{shiftsBusy ? 'Loading…' : shifts.length + ' shown'}</span>
      </div>
      {shiftsError && <p role="alert" className="mx-5 mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 sm:mx-7">{shiftsError}</p>}
      {shifts.length ? <>
        <ul className="divide-y divide-line border-t border-line lg:hidden">
          {shifts.map(shift => <li key={shift.id} className="px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-semibold">{shift.full_name || 'Unnamed'}</strong>
              <StatusBadge active={!shift.clock_out} activeText="On duty" inactiveText="Completed" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="mb-1 text-muted">Clock in</dt><dd><DateStamp value={shift.clock_in} /></dd></div>
              <div><dt className="mb-1 text-muted">Clock out</dt><dd><DateStamp value={shift.clock_out} /></dd></div>
            </dl>
          </li>)}
        </ul>
        <div className="hidden overflow-x-auto border-t border-line lg:block">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-soft text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr><th scope="col" className="px-7 py-3">Employee</th><th scope="col" className="px-4 py-3">Clock in</th><th scope="col" className="px-4 py-3">Clock out</th><th scope="col" className="px-7 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shifts.map(shift => <tr key={shift.id} className="transition-colors hover:bg-soft">
                <td className="px-7 py-4 font-semibold">{shift.full_name || 'Unnamed'}</td>
                <td className="px-4 py-4"><DateStamp value={shift.clock_in} /></td>
                <td className="px-4 py-4"><DateStamp value={shift.clock_out} /></td>
                <td className="px-7 py-4"><StatusBadge active={!shift.clock_out} activeText="On duty" inactiveText="Completed" /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </> : <p role={shiftsBusy ? 'status' : undefined} className="border-t border-line px-7 py-12 text-center text-sm text-muted">{shiftsBusy ? 'Loading attendance records…' : shiftsError ? 'Attendance unavailable.' : 'No attendance records yet.'}</p>}
      <Pager label="Attendance" page={attendancePage} hasMore={shiftsMore} busy={shiftsBusy} go={page => { setShiftsBusy(true); setAttendancePage(page) }} />
    </section>}
  </section>
}
