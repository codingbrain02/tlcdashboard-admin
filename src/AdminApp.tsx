import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { positionGroups } from './positions'

const Overview = lazy(() => import('./Overview'))
const CountryPhoneInput = lazy(() => import('./CountryPhoneInput'))
const ActivityLog = lazy(() => import('./ActivityLog'))

type Theme = 'light' | 'dark'
type AdminRecord = {
  id: string
  username: string
  role: 'super_admin' | 'admin'
  must_change_password: boolean
}
type EmployeeDraft = { fullName: string; email: string; position: string; phoneNumber: string }
type IssuedPassword = { label: string; password: string }
const blankEmployee: EmployeeDraft = { fullName: '', email: '', position: '', phoneNumber: '' }
const field = 'min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-muted/70 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(79,70,229,.9)] transition hover:bg-[#4338ca] hover:shadow-[0_12px_24px_-10px_rgba(79,70,229,.75)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-300'

function loadTheme(): Theme {
  try { return localStorage.getItem('tlc-admin-theme') === 'dark' ? 'dark' : 'light' }
  catch { return 'light' }
}

function accountEmail(identifier: string) {
  const value = identifier.trim().toLowerCase()
  if (value === 'codingbrain02@gmail.com') return value
  return /^[a-z][a-z0-9_]{2,31}$/.test(value) ? `tlc-admin-${value}@example.com` : ''
}

function ThemeToggle({ theme, toggle }: { theme: Theme; toggle: () => void }) {
  return <button type="button" onClick={toggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink transition hover:border-brand/40 hover:bg-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
    {theme === 'light'
      ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M20.5 15.3A8.5 8.5 0 0 1 8.7 3.5 8.5 8.5 0 1 0 20.5 15.3Z" /></svg>
      : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-[18px]"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
  </button>
}

function Notice({ children, bad = false }: { children: ReactNode; bad?: boolean }) {
  return <p role={bad ? 'alert' : 'status'} className={'mt-4 rounded-xl border p-3 text-sm leading-6 ' + (bad ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100' : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100')}>{children}</p>
}

function PasswordResult({ issued, dismiss }: { issued: IssuedPassword; dismiss: () => void }) {
  const [copied, setCopied] = useState(false)
  return <div role="status" className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100 sm:p-5">
    <div className="flex items-start gap-3"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">✓</span><div><strong className="block text-base">Account created</strong><p className="mt-1 break-all text-xs">{issued.label}</p></div></div>
    <p className="mt-4 text-xs leading-5">Share this temporary password privately. It appears only once and must be changed at first sign-in.</p>
    <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-[#182b2b]"><span className="block text-[10px] font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">Temporary password</span><code className="mt-2 block break-all font-mono text-sm font-semibold text-slate-900 dark:text-white">{issued.password}</code></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(issued.password); setCopied(true) } catch { setCopied(false) } }} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800">{copied ? 'Copied' : 'Copy password'}</button><button type="button" onClick={dismiss} className="min-h-9 px-2 text-xs font-semibold text-emerald-900 underline underline-offset-2 dark:text-emerald-200">Hide password</button></div>
  </div>
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const email = accountEmail(identifier)
    if (!email) { setError('Enter your administrator username or super administrator email.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) { setError('Could not sign in. Check your credentials.'); return }
      const verified = await supabase.auth.getUser()
      if (verified.error || !verified.data.user) { setError('Could not verify your session.'); return }
      setPassword('')
      onLogin(verified.data.user)
    } catch { setError('Sign-in is temporarily unavailable.') }
    finally { setBusy(false) }
  }

  return <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-6xl items-center gap-10 px-5 pb-12 sm:px-8 lg:grid-cols-[1fr_420px] lg:gap-16">
    <div><span className="rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-extrabold tracking-widest text-brand">ADMIN WORKSPACE</span><h1 className="mt-6 max-w-xl text-[clamp(2.4rem,5vw,4rem)] leading-tight font-bold tracking-tight">Manage your team with confidence.</h1><p className="mt-4 max-w-lg text-base leading-7 text-muted">Create employee accounts and review team attendance. Administrator access keeps employee records protected.</p></div>
    <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8"><div className="mb-5 grid size-12 place-items-center rounded-xl bg-soft text-xl font-extrabold text-brand">TLC</div><h2 className="text-2xl font-bold">Administrator sign in</h2><p className="mt-2 text-sm text-muted">Authorized staff only. No public signup.</p>
      {!supabase && <Notice bad>Supabase is not configured in the parent project environment.</Notice>}
      {error && <Notice bad>{error}</Notice>}
      <form onSubmit={submit} className="mt-7 space-y-5"><div><label htmlFor="identifier" className="mb-2 block text-sm font-semibold">Username or super administrator email</label><input id="identifier" required autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} className={field} placeholder="Your username" /></div><div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Password</label><input id="password" required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className={field} placeholder="Enter your password" /></div><button type="submit" disabled={!supabase || busy} className={button + ' w-full'}>{busy ? 'Signing in…' : 'Sign in'}</button></form>
    </section>
  </main>
}

function ChangePassword({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    if (next !== confirm) { setError('New passwords do not match.'); return }
    if (next.length < 12) { setError('Use at least 12 characters.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await supabase.functions.invoke('admin-api', { body: { action: 'change-password', currentPassword: current, newPassword: next } })
      if (result.error) { setError('Could not change password. Check your current password and try again.'); return }
      setCurrent(''); setNext(''); setConfirm('')
      onDone()
    } catch { setError('Password service is temporarily unavailable.') }
    finally { setBusy(false) }
  }
  return <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-md place-items-center px-5 pb-12"><section className="w-full rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8"><h1 className="text-2xl font-bold">Change your temporary password</h1><p className="mt-2 text-sm leading-6 text-muted">Set a private password before accessing administration.</p>{error && <Notice bad>{error}</Notice>}<form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="current" className="mb-2 block text-sm font-semibold">Temporary password</label><input id="current" type="password" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={field} /></div><div><label htmlFor="next" className="mb-2 block text-sm font-semibold">New password</label><input id="next" type="password" required minLength={12} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={field} /></div><div><label htmlFor="confirm" className="mb-2 block text-sm font-semibold">Confirm new password</label><input id="confirm" type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={field} /></div><button type="submit" disabled={busy} className={button + ' w-full'}>{busy ? 'Updating…' : 'Change password'}</button></form><button type="button" onClick={onSignOut} className="mt-5 text-sm font-semibold text-muted underline">Sign out</button></section></main>
}

function EmployeeForm() {
  const [draft, setDraft] = useState<EmployeeDraft>(blankEmployee)
  const [otherPosition, setOtherPosition] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState<IssuedPassword | null>(null)
  const change = (name: keyof EmployeeDraft, value: string) => setDraft(old => ({ ...old, [name]: value }))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    if (!/^\+[1-9]\d{6,14}$/.test(draft.phoneNumber)) {
      setError('Enter a phone number with the selected country code.')
      return
    }
    setBusy(true); setError(''); setIssued(null)
    try {
      const position = draft.position === 'Other' ? otherPosition.trim() : draft.position
      const result = await supabase.functions.invoke('admin-api', { body: { action: 'create-employee', ...draft, position } })
      if (result.error || typeof result.data?.temporaryPassword !== 'string') { setError('Could not create employee. Check the email is unused and try again.'); return }
      setIssued({ label: result.data.email, password: result.data.temporaryPassword })
      setDraft(blankEmployee)
      setOtherPosition('')
    } catch { setError('Could not reach the account service.') }
    finally { setBusy(false) }
  }
  return <section className="min-w-0 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_14px_38px_-28px_rgba(34,38,66,.45)]">
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-6 sm:px-8 sm:pt-8">
      <div><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">New employee</span><h2 className="mt-2 text-2xl font-bold tracking-tight">Set up an account</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Add their work details. We’ll generate a temporary password when the account is ready.</p></div>
      <span className="rounded-full border border-line bg-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Employee access</span>
    </div>
    <div className="px-5 sm:px-8">{error && <Notice bad>{error}</Notice>}{issued && <PasswordResult issued={issued} dismiss={() => setIssued(null)} />}</div>
    <form onSubmit={submit} className="mt-7 min-w-0">
      <div className="grid min-w-0 gap-x-5 gap-y-5 px-5 sm:grid-cols-2 sm:px-8">
        <div className="min-w-0"><label htmlFor="full-name" className="mb-2 block text-sm font-semibold">Full name</label><input id="full-name" required maxLength={120} autoComplete="name" value={draft.fullName} onChange={e => change('fullName', e.target.value)} className={field} placeholder="e.g. Alex Morgan" /></div>
        <div className="min-w-0"><label htmlFor="employee-email" className="mb-2 block text-sm font-semibold">Email address</label><input id="employee-email" required type="email" maxLength={254} autoComplete="email" value={draft.email} onChange={e => change('email', e.target.value)} className={field} placeholder="alex@company.com" /></div>
        <div className="min-w-0">
          <label htmlFor="position" className="mb-2 block text-sm font-semibold">Position</label>
          <select id="position" required value={draft.position} onChange={e => change('position', e.target.value)} className={field}>
            <option value="" disabled>Select a position</option>
            {positionGroups.map(group => <optgroup key={group.label} label={group.label}>
              {group.positions.map(position => <option key={position} value={position}>{position}</option>)}
            </optgroup>)}
            <option value="Other">Other / custom position</option>
          </select>
          {draft.position === 'Other' && <input aria-label="Custom position" required maxLength={120} value={otherPosition} onChange={e => setOtherPosition(e.target.value)} placeholder="Enter position" className={field + ' mt-2'} />}
        </div>
        <div className="min-w-0">
          <label htmlFor="phone" className="mb-2 block text-sm font-semibold">Phone number</label>
          <Suspense fallback={<p role="status" className="text-sm text-muted">Loading phone field…</p>}><CountryPhoneInput id="phone" required aria-describedby="phone-help" defaultCountry="PH" international countryCallingCodeEditable={false} limitMaxLength addInternationalOption={false} value={draft.phoneNumber || undefined} onChange={value => change('phoneNumber', value ?? '')} autoComplete="tel" placeholder="Enter phone number" countrySelectProps={{ 'aria-label': 'Phone country' }} className="phone-field min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink" /></Suspense>
          <p id="phone-help" className="mt-1.5 text-xs text-muted">Select a country, then enter the local number.</p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-soft/70 px-5 py-5 sm:px-8"><p className="max-w-sm text-xs leading-5 text-muted">A one-time password will appear after creation. Share it only through a private channel.</p><button type="submit" disabled={busy} className={button}>{busy ? 'Creating…' : 'Create employee'}<span aria-hidden="true">→</span></button></div>
    </form>
  </section>
}

function AdminForm() {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState<IssuedPassword | null>(null)
  const [directory, setDirectory] = useState<AdminRecord[]>([])
  const [directoryError, setDirectoryError] = useState('')
  const refresh = useCallback(async () => {
    if (!supabase) return
    const result = await supabase.from('admin_users').select('id,username,role,must_change_password').order('created_at', { ascending: true })
    if (result.error) setDirectoryError('Could not load administrators.')
    else { setDirectory(result.data as AdminRecord[]); setDirectoryError('') }
  }, [])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let connected = false
    let hasConnected = false
    let active = true
    queueMicrotask(() => { if (active) void refresh() })
    const channel = client.channel('super-admin-directory')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_users' }, () => { void refresh() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_users' }, () => { void refresh() })
      .subscribe(status => {
        if (!active) return
        connected = status === 'SUBSCRIBED'
        if (connected) {
          if (hasConnected) void refresh()
          hasConnected = true
        }
      })
    let ticks = 0
    const interval = window.setInterval(() => {
      ticks += 1
      if (document.visibilityState === 'visible' && (!connected || ticks % 5 === 0)) void refresh()
    }, 60_000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      void client.removeChannel(channel)
    }
  }, [refresh])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true); setError(''); setIssued(null)
    try {
      const result = await supabase.functions.invoke('admin-api', { body: { action: 'create-admin', username: username.trim().toLowerCase() } })
      if (result.error || typeof result.data?.temporaryPassword !== 'string') { setError('Could not create administrator. Check the username is unused.'); return }
      setIssued({ label: result.data.username, password: result.data.temporaryPassword })
      setUsername('')
      void refresh()
    } catch { setError('Could not reach the account service.') }
    finally { setBusy(false) }
  }
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
    <section className="min-w-0 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_14px_38px_-28px_rgba(34,38,66,.45)]">
      <div className="px-5 pt-6 sm:px-8 sm:pt-8"><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Privileged access</span><h2 className="mt-2 text-2xl font-bold tracking-tight">Invite an administrator</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Create a unique username for trusted staff. Their temporary password is shown only once.</p>{error && <Notice bad>{error}</Notice>}{issued && <PasswordResult issued={issued} dismiss={() => setIssued(null)} />}</div>
      <form onSubmit={submit} className="mt-7">
        <div className="px-5 sm:px-8"><label htmlFor="admin-username" className="mb-2 block text-sm font-semibold">Unique username</label><input id="admin-username" required minLength={3} maxLength={32} pattern="[a-z][a-z0-9_]{2,31}" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} className={field} placeholder="e.g. team_manager" /><p className="mt-2 text-xs leading-5 text-muted">3–32 lowercase letters, numbers, or underscores. Start with a letter.</p></div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-soft/70 px-5 py-5 sm:px-8"><p className="max-w-sm text-xs leading-5 text-muted">Only the Super Administrator can grant this access.</p><button type="submit" disabled={busy} className={button}>{busy ? 'Creating…' : 'Create administrator'}<span aria-hidden="true">→</span></button></div>
      </form>
    </section>
    <aside className="min-w-0 rounded-[26px] border border-line bg-surface p-5 shadow-[0_14px_38px_-28px_rgba(34,38,66,.45)] sm:p-7">
      <div className="flex items-center justify-between gap-3"><div><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Directory</span><h2 className="mt-2 text-xl font-bold tracking-tight">Administrators</h2></div><span className="rounded-full bg-soft px-3 py-1.5 text-xs font-bold text-muted">{directory.length} total</span></div>
      {directoryError && <Notice bad>{directoryError}</Notice>}
      <ul className="mt-5 space-y-2.5">{directory.map(entry => <li key={entry.id} className="flex items-center gap-3 rounded-2xl border border-line bg-soft px-3.5 py-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-xs font-extrabold text-brand">{entry.role === 'super_admin' ? 'SA' : entry.username.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{entry.role === 'super_admin' ? 'Super Administrator' : entry.username}</strong><span className="mt-0.5 block text-xs text-muted">{entry.role === 'super_admin' ? 'Account owner' : 'Administrator'}</span></span><span className={'size-2 shrink-0 rounded-full ' + (entry.must_change_password ? 'bg-amber-500' : 'bg-emerald-500')} title={entry.must_change_password ? 'Password change pending' : 'Active'}><span className="sr-only">{entry.must_change_password ? 'Password change pending' : 'Active'}</span></span></li>)}</ul>
      {!directory.length && !directoryError && <p className="mt-5 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">No administrators to show yet.</p>}
    </aside>
  </div>
}

type DashboardTab = 'overview' | 'employees' | 'create_employee' | 'administrators' | 'activity'

function NavIcon({ name }: { name: DashboardTab }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0">
    {name === 'overview' ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>
      : name === 'employees' ? <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5ZM16 5.3a3 3 0 0 1 0 5.5M17 14a5.5 5.5 0 0 1 3.5 5.1V20" /></>
        : name === 'create_employee' ? <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="9" /></>
          : <><path d="M12 2.8 20 6v5.6c0 4.9-3.2 8-8 9.6-4.8-1.6-8-4.7-8-9.6V6l8-3.2Z" /><path d="M9 12.2 11.1 14l4-4.3" /></>}
  </svg>
}

function Dashboard({ account, signOut, theme, toggleTheme }: { account: AdminRecord; signOut: () => void; theme: Theme; toggleTheme: () => void }) {
  const [tab, setTab] = useState<DashboardTab>('overview')
  const isSuper = account.role === 'super_admin'
  const tabs: { id: DashboardTab; label: string }[] = isSuper
    ? [{ id: 'overview', label: 'Overview' }, { id: 'employees', label: 'Employees' }, { id: 'create_employee', label: 'Create Employee' }, { id: 'administrators', label: 'Administrators' }, { id: 'activity', label: 'Activity Log' }]
    : [{ id: 'overview', label: 'Overview' }, { id: 'employees', label: 'Employees' }, { id: 'create_employee', label: 'Create Employee' }]
  const pageTitle = tab === 'activity' ? 'Activity Log' : tab === 'overview' ? 'Overview' : tab === 'employees' ? 'Employees' : tab === 'create_employee' ? 'Create Employee' : 'Administrators'
  const displayRole = isSuper ? 'Super Administrator' : account.username
  const selectTab = (next: DashboardTab) => { setTab(next); window.scrollTo(0, 0) }

  return <div className="min-h-screen bg-page text-ink lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
    <aside className="relative flex min-w-0 flex-col overflow-hidden bg-[#1d2456] px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:px-4 lg:py-7 dark:bg-[#111936]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(111,116,255,.36),transparent_72%)]" />
      <div className="relative flex items-center gap-3 px-2"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-sm font-black tracking-tight ring-1 ring-white/20">TLC</span><span className="min-w-0"><strong className="block truncate text-sm font-bold">Tech Live Connect</strong><small className="mt-0.5 block text-[11px] text-white/65">Administration workspace</small></span></div>
      <div className="relative mt-7 border-t border-white/10 pt-5 lg:mt-12"><p className="hidden px-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/40 lg:block">Workspace</p><nav aria-label="Admin pages" className="flex gap-1 overflow-x-auto pb-1 lg:mt-4 lg:flex-col lg:overflow-visible lg:pb-0">{tabs.map(item => <button key={item.id} type="button" onClick={() => selectTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={'group flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:w-full ' + (tab === item.id ? 'bg-white text-[#252c64] shadow-[0_8px_20px_-10px_rgba(0,0,0,.55)]' : 'text-white/70 hover:bg-white/10 hover:text-white')}><NavIcon name={item.id} /><span>{item.label}</span>{tab === item.id && <span aria-hidden="true" className="ml-auto hidden size-1.5 rounded-full bg-[#4f46e5] lg:block" />}</button>)}</nav></div>
      <div className="relative mt-auto hidden pt-8 lg:block"><div className="rounded-2xl border border-white/10 bg-white/[.07] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/45">Signed in</p><div className="mt-3 flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-xs font-bold">{isSuper ? 'SA' : account.username.slice(0, 2).toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-xs font-semibold">{displayRole}</strong><small className="mt-0.5 block text-[11px] text-white/55">TLC Administration</small></span></div></div></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-7 xl:px-10"><div className="min-w-0"><p className="text-[11px] font-semibold text-muted"><span className="hidden sm:inline">TLC Administration</span><span className="hidden px-2 text-line sm:inline">/</span><span className="text-ink">{pageTitle}</span></p></div><div className="flex shrink-0 items-center gap-2"><ThemeToggle theme={theme} toggle={toggleTheme} /><button type="button" onClick={signOut} className="min-h-10 rounded-xl border border-line bg-surface px-3.5 text-xs font-semibold text-ink transition hover:bg-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">Sign out</button></div></header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
        {tab === 'activity' && isSuper ? <Suspense fallback={<p role="status" className="text-sm text-muted">Loading activity log…</p>}><ActivityLog /></Suspense> : tab === 'overview' ? <Suspense fallback={<p role="status" className="text-sm text-muted">Loading overview…</p>}><Overview onCreateEmployee={() => selectTab('create_employee')} /></Suspense> : tab === 'employees' ? <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Team management</span><h1 className="mt-2 text-[clamp(1.8rem,3vw,2.4rem)] font-bold tracking-tight">Employees</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Browse your team and their current contact details.</p></div><button type="button" onClick={() => selectTab('create_employee')} className={button}>Create employee</button></div>
          <Suspense fallback={<p role="status" className="text-sm text-muted">Loading employees…</p>}><Overview mode="employees" canEdit={isSuper} onCreateEmployee={() => selectTab('create_employee')} /></Suspense>
        </> : <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><span className="text-[11px] font-bold uppercase tracking-[.18em] text-brand">Team management</span><h1 className="mt-2 text-[clamp(1.8rem,3vw,2.4rem)] font-bold tracking-tight">{tab === 'create_employee' ? 'Create employee' : 'Administrator accounts'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{tab === 'create_employee' ? 'Give a new teammate a secure start.' : 'Manage who can access the administration workspace.'}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-muted"><span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />{displayRole}</span></div>
          {tab === 'create_employee' ? <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.7fr)]"><EmployeeForm /><aside className="relative overflow-hidden rounded-[26px] bg-[#20285c] p-6 text-white shadow-[0_16px_35px_-25px_rgba(26,32,77,.8)] sm:p-7 dark:bg-[#222c62]"><div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[#6268ed]/25 blur-2xl" /><div className="relative"><span className="text-[11px] font-bold uppercase tracking-[.18em] text-[#b9c1ff]">Onboarding</span><h2 className="mt-3 text-xl font-bold tracking-tight">From invite to first shift</h2><p className="mt-2 text-sm leading-6 text-white/70">A quick, secure path for every new teammate.</p><ol className="mt-7 space-y-5">{[['01', 'Add their details', 'Name, position, contact number and email.'], ['02', 'Share their access', 'A one-time password appears after creation.'], ['03', 'Let them get started', 'They set a new password before clocking in.']].map(([number, title, detail]) => <li key={number} className="flex gap-3.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/10 text-[11px] font-bold text-white/90">{number}</span><span><strong className="block text-sm font-semibold">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/60">{detail}</span></span></li>)}</ol><div className="mt-8 rounded-2xl border border-white/15 bg-white/[.06] p-4 text-xs leading-5 text-white/75">Keep temporary passwords private. Employees must change theirs at first sign-in.</div></div></aside></div> : isSuper ? <AdminForm /> : null}
        </>}
      </main>
    </div>
  </div>
}

export default function AdminApp() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [user, setUser] = useState<User | null | undefined>(supabase ? undefined : null)
  const [account, setAccount] = useState<AdminRecord | null | undefined>(undefined)
  const [accessError, setAccessError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('tlc-admin-theme', theme) } catch { /* optional */ } }, [theme])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let mounted = true
    const verify = async () => {
      try {
        const result = await client.auth.getUser()
        if (!mounted) return
        if (result.error) {
          if (result.error.name === 'AuthSessionMissingError' || [400, 401, 403].includes(result.error.status ?? 0)) {
            setUser(null)
            setAccount(undefined)
          } else {
            setUser(previous => previous === undefined ? null : previous)
          }
        } else {
          setUser(result.data.user)
        }
      } catch {
        if (mounted) setUser(previous => previous === undefined ? null : previous)
      }
    }
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setUser(null); setAccount(undefined) }
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') window.setTimeout(() => { if (mounted) void verify() }, 0)
    })
    void verify()
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])
  const userId = user?.id
  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    let mounted = true
    void client.from('admin_users').select('id,username,role,must_change_password').eq('id', userId).maybeSingle().then(({ data, error }) => {
      if (mounted) { setAccount(error ? null : data as AdminRecord | null); setAccessError(error ? 'Could not check administrator access.' : '') }
    })
    return () => { mounted = false }
  }, [userId])
  async function signOut() {
    if (!supabase) return
    setLogoutError('')
    try {
      const result = await supabase.auth.signOut({ scope: 'local' })
      if (result.error) { setLogoutError('Could not sign out. Please retry.'); return }
      setUser(null)
      setAccount(undefined)
    } catch { setLogoutError('Could not sign out. Please retry.') }
  }
  const toggleTheme = () => setTheme(value => value === 'light' ? 'dark' : 'light')
  if (user && account && account.id === user.id && !account.must_change_password) return <>
    {logoutError && <p role="alert" className="fixed right-4 bottom-4 z-30 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 shadow-lg dark:bg-rose-950 dark:text-rose-100">{logoutError}</p>}
    <Dashboard account={account} signOut={() => void signOut()} theme={theme} toggleTheme={toggleTheme} />
  </>
  return <div className="min-h-screen bg-page font-sans text-ink"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#4f4ff1] text-xs font-extrabold text-white">TLC</span><strong className="text-sm">Tech Live Connect <span className="block text-xs font-normal text-muted">Administration</span></strong></div><ThemeToggle theme={theme} toggle={toggleTheme} /></header>{user === undefined ? <p role="status" className="p-10 text-center text-sm text-muted">Checking session…</p> : !user ? <Login onLogin={verified => { setAccount(undefined); setUser(verified) }} /> : account === undefined || (account !== null && account.id !== user.id) ? <p role="status" className="p-10 text-center text-sm text-muted">Checking administrator access…</p> : !account ? <main className="mx-auto max-w-md px-5 py-16 text-center"><h1 className="text-2xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-muted">{accessError || 'This account has no administrator role yet.'}</p><button type="button" onClick={() => void signOut()} className={button + ' mt-6'}>Sign out</button></main> : <ChangePassword onDone={() => void signOut()} onSignOut={() => void signOut()} />}</div>
}
