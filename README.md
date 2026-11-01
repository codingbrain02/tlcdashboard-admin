# TLC Administrator App

## Password controls

The password release also requires parent migration `202611010004_auth_password_transaction_order.sql`, which follows Supabase Auth's separate metadata/password writes and preserves mandatory setup during automatic password rehashes.

All administrators can use Change my password to change only their own password, with current-password verification. They stay signed in on the current device; other sessions are revoked. First-sign-in password setup also continues to the dashboard without logging out. Only the Super Administrator sees Change password in the administrator directory and employee profiles. Setting another account's password applies immediately and signs that account out of every device, with no confirmation dialog, current-password prompt, or forced temporary-password step. Administrative changes are recorded in Activity Log without passwords. Active attendance shifts are not stopped and terminated employees are not reactivated. New-account onboarding still uses temporary passwords. Apply parent migrations through `202611010006_preserve_own_password_session.sql` and deploy `admin-api` before releasing the updated frontend.

This admin app uses the same Supabase project as the employee app; it does not need a second database. Follow the [project setup guide](../README.md) before signing in. The first Super Administrator signs in with `codingbrain02@gmail.com`; other admins use a unique username and password. Account creation and temporary passwords are handled by the server-side `admin-api` Edge Function.

Both administrator roles can view employee records and attendance and can create employee accounts. Only the Super Administrator can view and create administrator accounts. Regular administrators cannot read other administrator profiles or administrator attendance, including the Super Administrator's personal details. Apply the parent project's migrations and deploy its `admin-api` function before deploying this frontend.

Overview shows attendance activity. Employees lists employee accounts with live, server-side name and position search, account-status filtering, and name or position sorting across all pages. Selecting an employee opens their work profile and paginated attendance history. Regular administrators have read-only access. The Super Administrator can edit full name, position, and phone number; employees manage their own sign-in email.

The administration logo returns to Overview and refreshes its data without reloading the document or interrupting the sign-in session. Appearance controls live in the sidebar account area beside Change my password. Admin and Super Admin accounts are text-only: there are no personal avatars or avatar picker. Employee emojis remain visible in employee records. Employee details have their own page heading and account-status badge; Back and the Employees breadcrumb return to the directory with its search/filter state intact. Profile/history network failures offer retry controls and do not leave an endless loading state.

Run `npm install`, `npm run dev`, `npm run lint`, and `npm run build` from this folder. The public Supabase URL and publishable key come from the parent project's `.env.local`. Never place a service key in a `VITE_` variable.

Vercel deployments use `vercel.json` to send security and no-index headers. Its Content Security Policy permits connections to Supabase's `*.supabase.co` domains; add any future custom Supabase domain to `connect-src` before deploying with that domain. Vite's local dev and preview servers do not apply Vercel response headers.

Employee profiles include confirmed Terminate, Reverse termination, and Rehire controls for both admin roles. Termination stops a running shift and disables account access; restoration requires the employee to sign in again. Only the Super Administrator can edit work details, sign-in email, registration/employment dates and existing attendance, or open Activity Log. Changes show a before/after review and are recorded by the server. Apply the parent lifecycle migration and deploy the updated `admin-api` before releasing this frontend.

---

## Original Vite template notes (not app setup instructions)

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
