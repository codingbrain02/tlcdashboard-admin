import { useEffect, useState } from 'react'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
import { supabase } from './supabase'

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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}

function Pager({ page, hasMore, busy, go }: {
  page: number; hasMore: boolean; busy: boolean; go: (page: number) => void
}) {
  return <div className="mt-5 flex items-center justify-end gap-3 text-sm">
    <button type="button" disabled={busy || page === 0} onClick={() => go(page - 1)} className="min-h-10 rounded-lg border border-line px-3 font-semibold disabled:opacity-40">Previous</button>
    <span className="text-muted">Page {page + 1}</span>
    <button type="button" disabled={busy || !hasMore} onClick={() => go(page + 1)} className="min-h-10 rounded-lg border border-line px-3 font-semibold disabled:opacity-40">Next</button>
  </div>
}

export default function Overview() {
  const [employeePage, setEmployeePage] = useState(0)
  const [attendancePage, setAttendancePage] = useState(0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employeesMore, setEmployeesMore] = useState(false)
  const [shiftsMore, setShiftsMore] = useState(false)
  const [employeesBusy, setEmployeesBusy] = useState(true)
  const [shiftsBusy, setShiftsBusy] = useState(true)
  const [employeesError, setEmployeesError] = useState('')
  const [shiftsError, setShiftsError] = useState('')

  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase.functions.invoke('admin-api', { body: { action: 'list-employees', page: employeePage } })
      .then(result => {
        if (!live) return
        if (result.error || !Array.isArray(result.data?.employees)) setEmployeesError('Could not load employees.')
        else { setEmployees(result.data.employees); setEmployeesMore(Boolean(result.data.hasMore)); setEmployeesError('') }
      }).catch(() => { if (live) setEmployeesError('Could not load employees.') })
      .finally(() => { if (live) setEmployeesBusy(false) })
    return () => { live = false }
  }, [employeePage])

  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase.functions.invoke('admin-api', { body: { action: 'list-attendance', page: attendancePage } })
      .then(result => {
        if (!live) return
        if (result.error || !Array.isArray(result.data?.shifts)) setShiftsError('Could not load attendance.')
        else { setShifts(result.data.shifts); setShiftsMore(Boolean(result.data.hasMore)); setShiftsError('') }
      }).catch(() => { if (live) setShiftsError('Could not load attendance.') })
      .finally(() => { if (live) setShiftsBusy(false) })
    return () => { live = false }
  }, [attendancePage])

  return <section id="overview" className="min-h-screen border-t border-line bg-page px-5 py-10 text-ink sm:px-8">
    <div className="mx-auto max-w-6xl"><span className="text-[11px] font-extrabold tracking-widest text-brand">SUPER ADMINISTRATOR</span><h2 className="mt-2 text-3xl font-bold tracking-tight">Organization overview</h2><p className="mt-2 text-sm text-muted">Employee accounts and every attendance record are available here. Times below display in your device’s time zone.</p>
      <div className="mt-8 space-y-7"><section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7"><h3 className="text-xl font-bold">Employees</h3>{employeesError && <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{employeesError}</p>}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-soft text-xs text-muted"><tr><th className="px-3 py-3">Name</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Position</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{employees.map(employee => <tr key={employee.id} className="border-t border-line"><td className="px-3 py-3 font-semibold">{employee.full_name || 'Unnamed'}</td><td className="px-3 py-3">{employee.email}</td><td className="px-3 py-3">{employee.position || '—'}</td><td className="px-3 py-3">{employee.phone_number ? formatPhoneNumberIntl(employee.phone_number) || employee.phone_number : '—'}</td><td className="px-3 py-3">{employee.is_active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table>{!employeesBusy && !employees.length && !employeesError && <p className="p-4 text-center text-sm text-muted">No employee accounts yet.</p>}</div><Pager page={employeePage} hasMore={employeesMore} busy={employeesBusy} go={page => { setEmployeesBusy(true); setEmployeePage(page) }} /></section>
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7"><h3 className="text-xl font-bold">Attendance records</h3>{shiftsError && <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{shiftsError}</p>}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-soft text-xs text-muted"><tr><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Clock in</th><th className="px-3 py-3">Clock out</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{shifts.map(shift => <tr key={shift.id} className="border-t border-line"><td className="px-3 py-3 font-semibold">{shift.full_name}</td><td className="px-3 py-3">{localDate(shift.clock_in)}</td><td className="px-3 py-3">{shift.clock_out ? localDate(shift.clock_out) : '—'}</td><td className="px-3 py-3">{shift.clock_out ? 'Completed' : 'On duty'}</td></tr>)}</tbody></table>{!shiftsBusy && !shifts.length && !shiftsError && <p className="p-4 text-center text-sm text-muted">No attendance records yet.</p>}</div><Pager page={attendancePage} hasMore={shiftsMore} busy={shiftsBusy} go={page => { setShiftsBusy(true); setAttendancePage(page) }} /></section></div>
    </div>
  </section>
}
