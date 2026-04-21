# CLAUDE.md — Kvalt

Komplexní mobilní platforma pro řízení malých a středních stavebních firem v ČR.
iOS + Android + Web · Cloudflare Workers + Pages · Neon PostgreSQL · Zitadel Cloud · Claude AI.

## Základ z rozpočtové appky

Projekt vychází z existující PWA `rozpocet-app`. Zkopíruj ji jako základ:

```bash
cp -r rozpocet-app kvalt && cd kvalt
```

Z původní appky se přebírá: UI design (barvy, fonty, mockupy z `docs/ui-mockups.html`), Claude API logika (`src/lib/claude.ts`), TypeScript typy (`src/types/index.ts`), ceník 476 položek (`src/data/default-cenik.json`), Tailwind config.

Co se změní: PWA → monorepo (mobile + web + api), IndexedDB → Neon PostgreSQL, žádná auth → Zitadel Cloud, hosting → Cloudflare Pages + Workers, soubory → R2, Claude volání → přes Workers proxy.

## Kde to běží — Cloudflare stack (0 Kč start)

```
KLIENTI: iOS (Expo) + Android (Expo) + Web (React)
            │
    Cloudflare Edge
    ├── Pages (web frontend)
    ├── Workers (Hono API)
    ├── R2 (fotky, PDF)
    ├── KV (cache)
    └── Queues (notifikace)
            │
    ├── Neon (serverless PostgreSQL, free 0.5GB)
    ├── Zitadel Cloud (auth, free 25K MAU)
    └── Claude API (AI)
```

Free tier limity: Workers 100K req/den, Pages neomezeno, R2 10GB, Neon 0.5GB, Zitadel 25K MAU. Při růstu: Workers Paid $5/měs + Neon Pro $19/měs = ~560 Kč/měs.

## Vývojová metodika: TDD

Vždy nejdřív test → test SELŽE → napiš minimální kód → test PROJDE → refaktoruj.

- **Vitest** pro API a shared logiku, **Miniflare** pro Workers emulaci
- **Testing Library** pro web, **React Native Testing Library** pro mobile
- Testy vedle kódu (`budgets.service.ts` + `budgets.service.test.ts`)
- `pnpm test --reporter=verbose` ukazuje progress — co je zelené je hotové

Coverage cíle: shared 95%, API services 85%, API routes 75%, web 60%, mobile 50%.

## Tech stack

| Vrstva | Technologie | Proč |
|--------|------------|------|
| Mobile | Expo (React Native) | iOS + Android, OTA updaty |
| Web | React + Vite | Dashboard, plánovací board |
| API | **Hono** (Cloudflare Workers) | Edge-native, 14KB, TypeScript |
| ORM | **Drizzle** | Lehčí než Prisma, nativní Workers + Neon |
| DB | **Neon** (serverless PostgreSQL) | Free tier, connection pooling |
| Auth | **Zitadel Cloud** | Free, multi-tenancy, role v JWT |
| Storage | Cloudflare R2 | S3-kompatibilní, 10GB free |
| Cache | Cloudflare KV | Sessions, cache |
| Queues | Cloudflare Queues | Večerní notifikace |
| AI | Claude API | Parsování diktátu, deník |
| Styling | Tailwind CSS | Mobile i web |
| UI web | shadcn/ui, TanStack Table, Recharts | Dashboard |
| Testy | Vitest, Miniflare, Testing Library | TDD |
| Monorepo | Turborepo + pnpm | Build orchestrace |

Proč Hono místo NestJS: NestJS je Node.js — nemůže běžet na Workers (V8 isolate). Hono je nativně edge, TypeScript-first, middleware pattern.

Proč Drizzle místo Prisma: Prisma má velký bundle a cold start na Workers. Drizzle je lehčí, SQL-like, nativní Neon driver.

## Struktura projektu

```
kvalt/
├── apps/
│   ├── mobile/                     # Expo (React Native)
│   │   ├── app/(auth)/login.tsx
│   │   ├── app/(tabs)/index.tsx    # Hlavní (role-dependent)
│   │   ├── app/(tabs)/projects/
│   │   ├── app/(tabs)/attendance/
│   │   ├── app/(tabs)/planning/tomorrow.tsx
│   │   ├── app/(tabs)/budget/
│   │   ├── components/
│   │   │   ├── DictateButton.tsx, EarningsCard.tsx
│   │   │   ├── CheckInButton.tsx, TomorrowCard.tsx
│   │   │   └── TeamSchedule.tsx
│   │   └── package.json
│   ├── web/                        # React + Vite dashboard
│   │   ├── src/pages/
│   │   │   ├── Dashboard, Projects, Budgets, Attendance
│   │   │   ├── Planning/
│   │   │   │   ├── WeekView.tsx    # Týdenní plánovací board
│   │   │   │   ├── TeamGrid.tsx    # Řádky=týmy, sloupce=dny
│   │   │   │   └── DragAssignment.tsx
│   │   │   ├── Diary, Invoices, Reports, Settings, Auth
│   │   │   └── ...
│   │   └── package.json
│   └── api/                        # Hono (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts            # Hono app + cron handler
│       │   ├── middleware/auth.ts, company.ts, roles.ts
│       │   ├── routes/
│       │   │   ├── budgets.ts, projects.ts, attendance.ts
│       │   │   ├── planning.ts, diary.ts, invoices.ts
│       │   │   ├── reports.ts, users.ts, companies.ts
│       │   │   ├── files.ts, notifications.ts, teams.ts
│       │   │   └── ...
│       │   ├── services/           # Business logika + testy
│       │   │   ├── budgets.service.ts + .test.ts
│       │   │   ├── attendance.service.ts + .test.ts
│       │   │   ├── planning.service.ts + .test.ts
│       │   │   ├── notifications.service.ts + .test.ts
│       │   │   └── ...
│       │   ├── db/schema.ts, client.ts, seed.ts, migrations/
│       │   └── lib/claude.ts, weather.ts
│       ├── wrangler.toml
│       └── vitest.config.ts
├── packages/shared/                # Sdílené typy, API client, utils, validace
│   ├── src/types/, api/, validation/, utils/
│   └── package.json
├── docs/ui-mockups.html
├── data/default-cenik.json
├── turbo.json, pnpm-workspace.yaml, vitest.workspace.ts
├── .env.example, .gitignore
└── CLAUDE.md
```

## Databázové schéma (Drizzle) — klíčové tabulky

**companies** — id, name, ico, dic, address, logoUrl, settings (json), zitadelOrgId (unique)

**users** — id, companyId → companies, zitadelUserId (unique), fullName, email, phone, role (ADMIN/FOREMAN/WORKER), hourlyRate, overtimeRatePercent (default 25), weekendRatePercent (default 10), holidayRatePercent (default 100), pushToken, isActive

**teams** — id, companyId, name ("Parťák Novotný"), leaderId → users, color (pro board)

**teamMembers** — teamId → teams, userId → users (unique pair)

**projects** — id, companyId, name, clientName/Email/Phone/Ico, address, status (OFFER/APPROVED/IN_PROGRESS/HANDOVER/INVOICED/PAID/CANCELLED), plannedStart/End, actualStart/End, notes

**assignments** (plánování) — id, companyId, projectId → projects, date, teamId → teams (nullable), userId → users (nullable), status (PLANNED/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED), startTime ("07:00"), endTime ("16:00"), description, notes, notificationSent (bool), createdById → users. Indexy: date, projectId+date, userId+date, teamId+date.

**budgets** — id, companyId, projectId → projects (nullable), name, status (DRAFT/DONE), vatRate, totalWithoutVat

**budgetItems** — budgetId → budgets (cascade), name, rawText, unit, quantity, unitPrice, totalPrice, matchType (MATCHED/ESTIMATED/MANUAL), matchedPriceItem, category, sortOrder

**transcripts** — budgetId → budgets (cascade), text, wordCount

**priceLists** — id, companyId, name, source. **priceListItems** — priceListId (cascade), name, unit, avgPrice, minPrice, maxPrice, occurrences, category, projects (json string[])

**attendance** — id, userId → users, projectId → projects, assignmentId → assignments (nullable), date, checkIn, checkOut, type (REGULAR/OVERTIME/WEEKEND/HOLIDAY/TRAVEL), breakMinutes, hoursWorked, earnings, approved, approvedById → users, notes, offlineCreated. Indexy: userId+date, projectId+date.

**diaryEntries** — projectId, authorId, date, weather, temperature, description, workersPresent. **diaryPhotos** — diaryEntryId (cascade), storagePath, caption. **extraWorks** — projectId, description, scope, estimatedPrice, approvedByClient. **projectPhotos** — projectId, storagePath, caption.

**invoices** — companyId, projectId, invoiceNumber, type (ADVANCE/FINAL), dateIssued/Due/Paid, totals, status (DRAFT/ISSUED/PAID/OVERDUE), client info, pdfStoragePath. **invoiceItems** — invoiceId (cascade), name, quantity, unit, unitPrice, vatRate, totalPrice.

**subcontractors** — companyId, name, ico, contactPerson, phone, email, trade.

**equipment** — companyId, name, type, licensePlate, stkDate, insuranceDate, notes.

**notifications** — userId, type ('tomorrow_assignment'/'attendance_reminder'/'approval_needed'), title, body, data (json), read, sentAt.

## Plánování týmů a práce

### Koncept

Majitel/parťák plánuje na **týdenním boardu** (web) kdo kde bude. Dělník dostane **večer push notifikaci**: "Zítra v 7:00 budeš na zakázce Novákovi — bourání příček".

### Plánovací board (web) — týdenní pohled

Řádky = týmy/lidi, sloupce = dny. Drag & drop přiřazení:

```
                PO 21.4      ÚT 22.4      ST 23.4
Tým Novotný   [Novákovi]   [Novákovi]   [Novákovi]
  Novotný       bourání      příčky       příčky
  Dvořák        bourání      příčky       příčky
Tým Procházka [Královic]   [Královic]   [volno]
```

### Mobilní karta "Zítra" (dělník)

Na hlavní obrazovce: zakázka, adresa, čas, úkol, kdo tam bude se mnou.

### Večerní notifikace (Cloudflare Cron + Queue)

Cron trigger v 18:00 → najde zítřejší přiřazení → pošle Expo push notifikaci každému dělníkovi.

```toml
# wrangler.toml
[triggers]
crons = ["0 17 * * *"]  # 17:00 UTC = 18:00 CET
```

### API endpointy — plánování a týmy

```
TEAMS
GET/POST   /api/teams
PATCH      /api/teams/:id
POST       /api/teams/:id/members
DELETE     /api/teams/:id/members/:userId

ASSIGNMENTS
GET    /api/assignments?week=2026-W17    # týdenní board
GET    /api/assignments/me/tomorrow      # co dělám zítra
POST   /api/assignments                  # nové přiřazení
POST   /api/assignments/bulk             # celý tým na celý týden
PATCH  /api/assignments/:id              # přesun / změna
DELETE /api/assignments/:id

NOTIFICATIONS
GET    /api/notifications/me
PATCH  /api/notifications/:id/read
POST   /api/notifications/register-push
```

## Autentizace — Zitadel Cloud

Zitadel Cloud (free 25K MAU). Projekt `kvalt-app` s rolemi admin/foreman/worker. Dvě aplikace: kvalt-web (SPA/PKCE), kvalt-mobile (native/PKCE). Google + Apple login.

JWT validace v Hono middleware přes jose knihovnu — dekóduj token, čti role z `urn:zitadel:iam:org:project:roles` a orgId z `urn:zitadel:iam:org:id`. Multi-tenancy: orgId → companyId, každý dotaz filtruje přes companyId.

## Role a přístup

| Endpoint | Admin | Foreman | Worker |
|----------|-------|---------|--------|
| Rozpočty CRUD | ✓ | ✓ | ✗ |
| Zakázky | ✓ | přiřazené | čtení |
| Plánování edit | ✓ | svůj tým | ✗ |
| Plánování view | ✓ | svůj tým | jen své |
| Docházka svá | ✓ | ✓ | ✓ |
| Docházka cizí | ✓ firma | svůj tým | ✗ |
| Schvalování | ✓ | svůj tým | ✗ |
| Výdělek svůj | ✓ | ✓ | ✓ |
| Výdělek cizí | ✓ | ✗ | ✗ |
| Správa týmů | ✓ | svůj tým | ✗ |
| Deník | ✓ | ✓ | čtení |
| Fakturace | ✓ | ✗ | ✗ |
| Reporty | ✓ | omezené | ✗ |
| Správa uživatelů | ✓ | ✗ | ✗ |
| Export pro účetní | ✓ | ✗ | ✗ |

## Implementační pořadí (TDD checklisty)

### Krok 1: Infrastruktura
- [ ] Turborepo + pnpm workspace
- [ ] Hono Workers + wrangler.toml
- [ ] Drizzle schema + Neon connection
- [ ] Vitest + Miniflare config
- [ ] GitHub Actions CI (lint + test)

### Krok 2: Auth
- [ ] TEST: middleware 401 bez tokenu
- [ ] TEST: middleware dekóduje JWT → user context
- [ ] TEST: roles guard admin OK, worker blocked
- [ ] TEST: company middleware mapuje orgId → companyId
- [ ] IMPL: Zitadel setup + middleware
- [ ] IMPL: Web + Mobile login

### Krok 3: Rozpočty (z rozpocet-app)
- [ ] TEST: POST /budgets vytvoří rozpočet
- [ ] TEST: POST /budgets/:id/parse → AI položky
- [ ] TEST: GET /budgets/:id vrátí detail
- [ ] TEST: export xlsx + pdf
- [ ] TEST: filtr podle companyId
- [ ] IMPL: routes + service + AI proxy + export
- [ ] IMPL: Web + Mobile UI

### Krok 4: Zakázky
- [ ] TEST: CRUD, stavy, vazba rozpočet→projekt, fotky R2
- [ ] IMPL: routes + service + UI

### Krok 5: Týmy
- [ ] TEST: CRUD týmů, přidání/odebrání člena, viditelnost
- [ ] IMPL: routes + service + UI

### Krok 6: Plánování
- [ ] TEST: přiřazení (tým na zakázku na den)
- [ ] TEST: hromadné přiřazení (týden)
- [ ] TEST: GET ?week= vrátí board data
- [ ] TEST: GET /me/tomorrow vrátí zítřek
- [ ] TEST: konflikty (člověk na dvou místech)
- [ ] IMPL: routes + service
- [ ] IMPL: Web plánovací board (drag & drop)
- [ ] IMPL: Mobile karta "Zítra"

### Krok 7: Notifikace
- [ ] TEST: cron najde zítřejší assignments
- [ ] TEST: generuje push zprávu
- [ ] TEST: označí notificationSent
- [ ] IMPL: Queue consumer + Expo Push + cron

### Krok 8: Docházka
- [ ] TEST: check-in/out, výpočet hodin + výdělek
- [ ] TEST: příplatky (přesčas, víkend, svátek)
- [ ] TEST: pauza 30min po 6h
- [ ] TEST: zamezení dvojitého check-inu
- [ ] TEST: getEarnings (den/týden/měsíc)
- [ ] TEST: schvalování, měsíční export CSV
- [ ] TEST: vazba na assignment
- [ ] IMPL: routes + service
- [ ] IMPL: Mobile (tlačítko, výdělek karta)
- [ ] IMPL: Web (přehled, schvalování, export)

### Krok 9: Stavební deník
- [ ] TEST: CRUD, AI strukturování, počasí, fotky, vícepráce
- [ ] IMPL: routes + service + UI

### Krok 10: Fakturace + Reporty
- [ ] TEST: generování z rozpočtu, QR, ISDOC, ziskovost
- [ ] IMPL: routes + service + UI

## Příkazy

```bash
pnpm install && pnpm dev          # Instalace a spuštění
pnpm test                         # Všechny testy (TDD progress)
pnpm test:watch                   # Watch mode
pnpm test:coverage                # Coverage
pnpm build                        # Build
pnpm deploy:api                   # Deploy Workers
pnpm deploy:web                   # Deploy Pages
pnpm db:migrate                   # Drizzle migrace
pnpm db:seed                      # Seed ceníku
```
