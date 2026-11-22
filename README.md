# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Android share links

Set `VITE_PUBLIC_APP_URL` to the published website URL before building the Android APK. For GitHub Actions, add it as a repository Actions variable with the name `VITE_PUBLIC_APP_URL`. APK share actions use Android's native share sheet and point to that website, where recipients can preview and import the shared set or card. Without this public URL, the app will ask to configure it instead of sharing an unusable `capacitor://localhost` link.

For a local web build, copy `.env.example` to `.env.local` and set `VITE_PUBLIC_APP_URL` to the public website address when preparing a deployable build.

## Server accounts and cloud sync

The app uses Supabase Auth for email/password accounts and Supabase Postgres for the user's library. The public project URL and publishable key are set in `.env.production` and are included in the Vercel and APK builds. Create the Supabase project, run `supabase/migrations/20261122000000_user_data.sql` in its SQL Editor, and enable email sign-in. In **Authentication → URL Configuration**, set the Site URL and add `https://quizflow-lxwlne82u-rinys.vercel.app/**` to the allowed redirect URLs. Redeploy the website and rebuild the APK after configuration. Never put a Supabase secret/service-role key in client environment variables.

For local production builds, copy `.env.example` to `.env.local` and fill in all three `VITE_` values. The app merges existing local sets into the account library at first sign-in, then syncs library changes between devices.
