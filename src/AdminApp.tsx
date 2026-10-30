import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import PhoneInput from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'
import { supabase } from './supabase'
import Overview from './Overview'

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
const positionGroups = [
  { label: 'Virtual Assistance & Administration', positions: ['General Virtual Assistant', 'Executive Assistant', 'Administrative Assistant', 'Data Entry Specialist'] },
  { label: 'Customer Support', positions: ['Customer Support Specialist'] },
  { label: 'Sales', positions: ['Lead Generation Specialist', 'Appointment Setter', 'Real Estate Virtual Assistant'] },
  { label: 'Marketing & Creative', positions: ['Social Media Manager', 'Marketing Assistant', 'Graphic Design Assistant'] },
  { label: 'Finance', positions: ['Bookkeeping Assistant'] },
  { label: 'Operations & E-commerce', positions: ['E-commerce Assistant', 'Project Coordinator'] },
  { label: 'Technology', positions: ['Developer'] },
]
const field = 'min-h-12 w-full rounded-xl border border-line bg-soft px-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
const button = 'min-h-11 rounded-xl bg-[#4f4ff1] px-5 text-sm font-bold text-white transition hover:bg-[#4242d8] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-300'

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
  return <button type="button" onClick={toggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-lg text-ink hover:bg-soft">{theme === 'light' ? '☾' : '☀'}</button>
}

function Notice({ children, bad = false }: { children: ReactNode; bad?: boolean }) {
  return <p role={bad ? 'alert' : 'status'} className={'mt-4 rounded-xl border p-3 text-sm leading-6 ' + (bad ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100' : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100')}>{children}</p>
}

function PasswordResult({ issued, dismiss }: { issued: IssuedPassword; dismiss: () => void }) {
  const [copied, setCopied] = useState(false)
  return <div role="status" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100">
    <strong className="block">Account created: {issued.label}</strong>
    <p className="mt-1 leading-5">Share this temporary password privately. It will not appear again and must be changed on first sign-in.</p>
    <code className="mt-3 block break-all rounded-lg bg-white p-3 font-mono text-slate-900 dark:bg-slate-900 dark:text-white">{issued.password}</code>
    <div className="mt-3 flex gap-4"><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(issued.password); setCopied(true) } catch { setCopied(false) } }} className="font-bold underline">{copied ? 'Copied' : 'Copy password'}</button><button type="button" onClick={dismiss} className="font-bold underline">Hide password</button></div>
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
    <div><span className="rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-extrabold tracking-widest text-brand">ADMIN WORKSPACE</span><h1 className="mt-6 max-w-xl text-[clamp(2.4rem,5vw,4rem)] leading-tight font-bold tracking-tight">Manage your team with confidence.</h1><p className="mt-4 max-w-lg text-base leading-7 text-muted">Create employee and administrator accounts with one-time passwords. Attendance stays private to each employee.</p></div>
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
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
    <h2 className="text-xl font-bold">Create employee</h2>
    <p className="mt-2 text-sm text-muted">A temporary password is shown once after the account is created.</p>
    {error && <Notice bad>{error}</Notice>}
    {issued && <PasswordResult issued={issued} dismiss={() => setIssued(null)} />}
    <form onSubmit={submit} className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">
      <div className="min-w-0"><label htmlFor="full-name" className="mb-2 block text-sm font-semibold">Full name</label><input id="full-name" required maxLength={120} autoComplete="name" value={draft.fullName} onChange={e => change('fullName', e.target.value)} className={field} /></div>
      <div className="min-w-0"><label htmlFor="employee-email" className="mb-2 block text-sm font-semibold">Email</label><input id="employee-email" required type="email" maxLength={254} value={draft.email} onChange={e => change('email', e.target.value)} className={field} /></div>
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
        <PhoneInput id="phone" required aria-describedby="phone-help" defaultCountry="PH" international countryCallingCodeEditable={false} limitMaxLength addInternationalOption={false} flags={flags} value={draft.phoneNumber || undefined} onChange={value => change('phoneNumber', value ?? '')} autoComplete="tel" placeholder="Enter phone number" countrySelectProps={{ 'aria-label': 'Phone country' }} className="phone-field min-h-12 w-full rounded-xl border border-line bg-soft px-4 text-sm text-ink" />
        <p id="phone-help" className="mt-1.5 text-xs text-muted">Required. Choose a country, then enter the number.</p>
      </div>
      <div className="sm:col-span-2"><button type="submit" disabled={busy} className={button}>{busy ? 'Creating…' : 'Create employee'}</button></div>
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
    queueMicrotask(() => { void refresh() })
    const channel = client.channel('super-admin-directory')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_users' }, () => { void refresh() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_users' }, () => { void refresh() })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh() })
    const interval = window.setInterval(() => { void refresh() }, 30_000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
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
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)]"><section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold">Create administrator</h2><p className="mt-2 text-sm leading-6 text-muted">Only the Super Administrator can create other administrators. They sign in with a unique username and temporary password.</p>{error && <Notice bad>{error}</Notice>}{issued && <PasswordResult issued={issued} dismiss={() => setIssued(null)} />}<form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-3"><div className="w-full max-w-sm"><label htmlFor="admin-username" className="mb-2 block text-sm font-semibold">Unique username</label><input id="admin-username" required minLength={3} maxLength={32} pattern="[a-z][a-z0-9_]{2,31}" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} className={field} placeholder="e.g. team_manager" /></div><button type="submit" disabled={busy} className={button}>{busy ? 'Creating…' : 'Create administrator'}</button></form></section><aside className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7"><h2 className="text-lg font-bold">Administrators</h2>{directoryError && <Notice bad>{directoryError}</Notice>}<ul className="mt-4 space-y-3">{directory.map(account => <li key={account.id} className="rounded-xl border border-line bg-soft px-4 py-3"><strong className="block text-sm">{account.role === 'super_admin' ? 'Super Administrator' : account.username}</strong><span className="text-xs text-muted">{account.must_change_password ? 'Password change pending' : 'Active'}</span></li>)}</ul></aside></div>
}

function Dashboard({ account, signOut, theme, toggleTheme }: { account: AdminRecord; signOut: () => void; theme: Theme; toggleTheme: () => void }) {
  const [tab, setTab] = useState<'employees' | 'administrators'>('employees')
  return <div className="min-h-screen bg-page text-ink md:grid md:grid-cols-[230px_minmax(0,1fr)]">
    <aside className="bg-[#4f4ff1] px-5 py-5 text-white dark:bg-[#27276f] md:min-h-screen md:py-7">
      <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 text-sm font-extrabold">TLC</span><span className="min-w-0"><strong className="block text-sm">Tech Live Connect</strong><small className="text-white/75">Admin workspace</small></span></div>
      <nav aria-label="Admin pages" className="mt-7 flex flex-wrap gap-2 md:mt-12 md:flex-col">
        <button type="button" onClick={() => setTab('employees')} aria-current={tab === 'employees' ? 'page' : undefined} className={'rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-white/15 ' + (tab === 'employees' ? 'bg-white/20' : '')}>Employees</button>
        {account.role === 'super_admin' && <button type="button" onClick={() => setTab('administrators')} aria-current={tab === 'administrators' ? 'page' : undefined} className={'rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-white/15 ' + (tab === 'administrators' ? 'bg-white/20' : '')}>Administrators</button>}
      </nav>
    </aside>
    <div className="min-w-0">
      <header className="flex min-h-18 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 sm:px-8">
        <span className="min-w-0 text-xs font-semibold text-muted">Administration / {tab === 'employees' ? 'Employees' : 'Administrators'}</span>
        <div className="flex shrink-0 items-center gap-2"><ThemeToggle theme={theme} toggle={toggleTheme} /><button type="button" onClick={signOut} className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold text-ink hover:bg-soft">Sign out</button></div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <span className="text-[11px] font-extrabold tracking-widest text-brand">TEAM MANAGEMENT</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{tab === 'employees' ? 'Employee accounts' : 'Administrator accounts'}</h1>
        <p className="mt-2 text-sm text-muted">Signed in as {account.role === 'super_admin' ? 'Super Administrator' : account.username}</p>
        <div className="mt-8">{tab === 'employees'
          ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,.6fr)]"><EmployeeForm /><aside className="rounded-2xl border border-line bg-surface p-6 shadow-sm"><h2 className="text-base font-bold">Secure account access</h2><p className="mt-2 text-sm leading-6 text-muted">Passwords are generated on the server. Ask employees to change theirs on first sign-in and share temporary passwords privately.</p>{account.role === 'admin' && <div className="mt-6 border-t border-line pt-5"><strong className="block text-sm">Super Administrator</strong><span className="text-xs text-muted">Account owner</span></div>}</aside></div>
          : <AdminForm />}</div>
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
    {account.role === 'super_admin' && <Overview />}
  </>
  return <div className="min-h-screen bg-page font-sans text-ink"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#4f4ff1] text-xs font-extrabold text-white">TLC</span><strong className="text-sm">Tech Live Connect <span className="block text-xs font-normal text-muted">Administration</span></strong></div><ThemeToggle theme={theme} toggle={toggleTheme} /></header>{user === undefined ? <p role="status" className="p-10 text-center text-sm text-muted">Checking session…</p> : !user ? <Login onLogin={verified => { setAccount(undefined); setUser(verified) }} /> : account === undefined || (account !== null && account.id !== user.id) ? <p role="status" className="p-10 text-center text-sm text-muted">Checking administrator access…</p> : !account ? <main className="mx-auto max-w-md px-5 py-16 text-center"><h1 className="text-2xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-muted">{accessError || 'This account has no administrator role yet.'}</p><button type="button" onClick={() => void signOut()} className={button + ' mt-6'}>Sign out</button></main> : <ChangePassword onDone={() => void signOut()} onSignOut={() => void signOut()} />}</div>
}
