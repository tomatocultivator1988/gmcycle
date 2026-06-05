# CreditFlow

CreditFlow is a serverless-ready MVP for small lenders and collectors who handle cash loans, product sales, home-credit receivables, and manual split payments.

The important business rule is simple: payments are never auto-allocated. A collector chooses exactly which open balance receives money.

## Business Model

- Cash Loan: the customer receives cash. The open balance is cash released plus interest or service charge.
- Product Sale - Cash: the customer buys an item and pays immediately. CreditFlow records the sale amount and product profit, but creates no open balance.
- Product Sale - Home Credit: the customer receives an item now and pays the higher selling price later. CreditFlow records original cost, selling price, profit, and creates an open balance.
- Payment: one customer payment can be manually split across cash loans and home-credit product balances.

## Stack

- Next.js App Router, TypeScript, React, Tailwind CSS
- PostgreSQL with Prisma ORM
- Prisma Decimal columns for all money values
- API routes designed for serverless runtimes
- Asia/Manila date rules for overdue and "collected today" metrics
- No authentication in the MVP

## Environment

Copy `.env.example` to `.env` and update the credentials.

For Supabase, use the pooled connection string for runtime:

```env
DATABASE_URL="postgresql://postgres.project-ref:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require&uselibpqcompat=true"
```

Use the session pooler connection for migrations. If your direct database host resolves correctly, a direct `db.<project-ref>.supabase.co:5432` connection can also be used:

```env
DIRECT_URL="postgresql://postgres.project-ref:password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true"
```

`prisma.config.ts` uses `DIRECT_URL` for Prisma CLI commands when it is available, then falls back to `DATABASE_URL`. At runtime, the app uses `DATABASE_URL` through `@prisma/adapter-pg`.

Other serverless-safe pooling options:

- Prisma Accelerate connection URL
- Neon pooled connection string
- Supabase pooler
- PgBouncer in front of PostgreSQL

Keep transactions short. Product sale creation and payment allocation both use short Prisma transactions.

## Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Scripts

```bash
npm run dev              # Start local dev server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint
npm run test             # Vitest tests
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run Prisma migration dev
npm run prisma:seed      # Load sample data
```

## Main Routes

- `/dashboard`
- `/customers`
- `/customers/[id]`
- `/cash-loans/new`
- `/product-sales/new`
- `/payments/new`

`/credit-accounts/new` redirects to `/cash-loans/new` for compatibility.

## API Routes

- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/[id]`
- `PUT /api/customers/[id]`
- `DELETE /api/customers/[id]`
- `POST /api/credit-accounts` for cash loans only
- `GET /api/credit-accounts/[id]`
- `PUT /api/credit-accounts/[id]`
- `DELETE /api/credit-accounts/[id]`
- `GET /api/customers/[id]/credit-accounts`
- `POST /api/product-sales`
- `GET /api/product-sales`
- `GET /api/customers/[id]/product-sales`
- `POST /api/payments`
- `GET /api/customers/[id]/payments`
- `GET /api/credit-accounts/[id]/payments`
- `GET /api/dashboard`

## Seed Data

The seed script creates:

- 3 customers
- One customer with a cash loan and a home-credit product balance
- A sample `500.00` payment split as `200.00` to the cash loan and `300.00` to the home-credit product balance
- One cash product sale with profit and no open balance
- One overdue home-credit product balance
- One paid home-credit product balance with payment history

## Payment Rules

- A payment belongs to one customer.
- Allocations must be entered manually.
- Allocation totals must equal the payment total.
- Allocation amounts must be greater than `0.00`.
- Allocations cannot exceed open balances.
- Allocated balances must belong to the payment customer.
- The same open balance cannot appear twice in one payment.
- Balances are reduced only after the transaction passes validation.
- A zero balance marks the account and linked product sale `PAID`.
- A remaining balance with due date before today in Asia/Manila marks it `OVERDUE`.
- Otherwise, it is `ACTIVE`.

Money values should be sent to APIs as strings, for example `"500.00"`. Responses also return money as strings to avoid floating point precision issues.
