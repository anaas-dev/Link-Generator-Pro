# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, Recharts, React Query, React Hook Form
- **QR codes**: qrcode package

## Project: LinkFlow

Marketing link management SaaS for small teams (3–5 users).

### Features
- **Campaigns**: Group links by campaign with color coding, link counts, and click aggregates
- **Links**: Create short links with custom slugs, UTM parameters (source/medium/campaign/term/content), expiration dates, and campaign assignment
- **QR codes**: Generate QR codes for any short link (navy blue on white, PNG data URL)
- **Analytics**: Dashboard with click totals, clicks over time (30-day line chart), top links by clicks, campaign comparison
- **Link redirect**: `/api/r/:slug` records a click and 302-redirects to the destination URL with UTM params appended
- **Sample data**: 3 campaigns, 5 links, ~100 click records seeded

### Design
- Primary: deep navy blue (#0f2044)
- Accent: bright sun yellow (#FFD600)
- Sidebar: dark navy with yellow active indicator

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   └── src/routes/
│   │       ├── campaigns.ts   # CRUD campaigns + click aggregation
│   │       ├── links.ts       # CRUD links + redirect + QR code
│   │       └── analytics.ts   # Summary, clicks over time, top links
│   └── linkflow/           # React + Vite frontend (served at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── campaigns.ts   # campaigns table
│           ├── links.ts       # links table (FK: campaigns)
│           └── clicks.ts      # clicks table (FK: links)
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)

### `artifacts/linkflow` (`@workspace/linkflow`)

React + Vite frontend served at `/`. Uses React Query for API calls, Recharts for analytics charts, React Hook Form with Zod for forms, Framer Motion for animations.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Tables: `campaigns`, `links`, `clicks`.

- `pnpm --filter @workspace/db run push` — sync schema to DB
- `pnpm --filter @workspace/db run push-force` — force push (if conflicts)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package.
