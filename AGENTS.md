# MyFaveGadgets — Gadget Installment Monitoring System

## MIGRATION PLAN: Cash Loan Management → Gadget Installment Monitoring

**Business:** MyFaveGadgets, Binan City, Laguna
**Original System:** CreditFlow v0.1.0 (Micro-lending MVP)

---

## CRITICAL: BUSINESS MODEL RULES

This is **NOT** a loan system. Do NOT treat this as lending, financing, or banking.

**Do NOT compute:**
- Interest Rates / Interest Income
- Principal vs Interest Breakdown
- Loan Amortization / Financing Charges

**The model:**
GM Cycle sells motorcycles through installment. There is a predefined Cash Price and a predefined Installment Price. The difference is already built into the pricing model. The system only monitors: installment accounts, payments, balances, due dates, penalties, discounts, and collections.

**Example:**
- Cash Price = ₱80,000
- Installment Price = ₱96,000
- Down Payment = ₱10,000
- Balance = ₱86,000
- Term = 24 Months
- Monthly Installment = ₱86,000 ÷ 24 = ₱3,583.33

---

## ACCOUNT INFORMATION

### Customer Details
- Customer Name
- Address
- Contact Number
- Valid ID Information (type + number)

### Motorcycle Details
- Brand
- Model
- Unit Description

### Contract Details
- Cash Price
- Installment Price
- Down Payment
- Remaining Balance
- Term (12/24/36/48 months)
- Monthly Installment
- Start Date
- Due Date Schedule

---

## TERM OPTIONS

Support: 12, 24, 36, 48 months.

**Monthly Installment Formula:**
```
(Installment Price - Down Payment) ÷ Number of Months
```

System auto-computes the monthly installment. Last period absorbs any rounding remainder.

---

## DUE DATE CONFIGURATION

Admin assigns a fixed due day (10, 20, or 30). System auto-generates installment schedules based on:
- Start Date
- Due Day of Month
- Term (number of periods)

---

## PAYMENT POSTING WORKFLOW

Each payment applies to exactly ONE installment account (no split payments).

### Fields
- Payment Date
- OR Number (required, unique)
- Amount Paid
- Cashier/User
- Notes

### Payment Types
- REGULAR — pays the current due period
- PARTIAL — pays less than the full monthly installment
- ADVANCE — pays before the due date or pays for a future period
- FULL — pays off the entire remaining balance

### Business Logic on Post
1. Update balance automatically
2. Update account status
3. Update payment history
4. Apply penalty — manual via admin (no auto-penalty)
5. Apply discount if applicable (paid before due date → ₱200)
6. Mark schedule period as paid/partial

---

## PENALTY RULE

**Per-day penalty accrual:** Penalty = ₱50 per day overdue (configurable)

Example: Due June 10, Today June 15 (5 days overdue) → Accrued = ₱250

Admin manually applies penalty with ability to discount/waive a portion.
Only the applied amount is added to the remaining balance.

Requirements:
- Penalty per day amount configurable by admin
- Manual penalty application via "Apply Penalty" button on overdue periods
- Accrued penalty displayed per period (days × rate)
- Admin chooses how much to apply (can waive portion)
- Penalty history (PenaltyRecord table) with applied/accrued/waived tracking
- Penalty reporting

---

## ADVANCE PAYMENT DISCOUNT

**If customer pays before the due date:** Discount = ₱200

Example: Due June 10, Paid June 5 → Discount = ₱200

Requirements:
- Discount amount configurable by admin
- Automatic discount application
- Discount history (DiscountRecord table)
- Discount reporting

**Paid exactly on due date:** No discount, no penalty.

---

## ACCOUNT STATUS

- ACTIVE — account is current and on track
- DUE_TODAY — payment is due today
- OVERDUE — past due date with remaining balance
- FULLY_PAID — all payments completed

---

## ACCOUNT MONITORING (Per Customer Dashboard)

### Display Sections
1. Customer Information
2. Motorcycle Information
3. Contract Information
4. Payment History (with OR#)
5. Penalty History
6. Discount History

### Account Summary
- Installment Price
- Down Payment
- Total Payments
- Total Penalties
- Total Discounts
- Remaining Balance
- Next Due Date
- Days Overdue
- Account Status

---

## COLLECTION MONITORING

Track: Daily, Weekly, Monthly Collections
Monitor: Cashier Collections, User Collections

---

## ANALYTICS DASHBOARD

### Account Metrics
- Total Accounts
- Active Accounts
- Fully Paid Accounts
- Overdue Accounts

### Financial Metrics
- Total Installment Sales
- Total Down Payments
- Total Collections
- Outstanding Balances
- Total Penalties Collected
- Total Discounts Granted

### Collection Metrics
- Collections Today
- Collections This Week
- Collections This Month

---

## AGING REPORT

Buckets:
- Current
- 1–30 Days Overdue
- 31–60 Days Overdue
- 61–90 Days Overdue
- 90+ Days Overdue

---

## REPORTS

- Collection Report
- Daily Collection Report
- Monthly Collection Report
- Overdue Accounts Report
- Penalty Report
- Discount Report
- Customer Ledger
- Account Ledger
- Outstanding Balance Report

---

## PRISMA SCHEMA

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum AccountStatus {
  ACTIVE
  DUE_TODAY
  OVERDUE
  FULLY_PAID
}

enum PaymentMethod {
  CASH
  GCASH
  BANK
}

enum PaymentType {
  REGULAR
  PARTIAL
  ADVANCE
  FULL
}

enum ScheduleStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
}

model Customer {
  id               String                @id @default(cuid())
  fullName         String
  phone            String
  address          String
  idNumber         String
  validIdType      String?
  createdAt        DateTime              @default(now())
  updatedAt        DateTime              @updatedAt

  accounts         InstallmentAccount[]

  @@index([fullName])
}

model InstallmentAccount {
  id                 String               @id @default(cuid())
  customerId         String
  // Motorcycle
  brand              String
  model              String
  unitDescription    String
  // Contract
  cashPrice          Decimal(12, 2)
  installmentPrice   Decimal(12, 2)
  downPayment        Decimal(12, 2)
  remainingBalance   Decimal(12, 2)
  term               Int
  monthlyInstallment Decimal(12, 2)
  // Status & dates
  status             AccountStatus        @default(ACTIVE)
  startDate          DateTime
  dueDayOfMonth      Int
  nextDueDate        DateTime
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt
  // Relations
  customer           Customer             @relation(fields: [customerId], references: [id], onDelete: Restrict)
  payments           Payment[]
  schedule           InstallmentSchedule[]

  @@index([customerId])
  @@index([status])
  @@index([nextDueDate])
}

model InstallmentSchedule {
  id                   String          @id @default(cuid())
  installmentAccountId String
  periodNumber         Int
  dueDate              DateTime
  amount               Decimal(12, 2)
  status               ScheduleStatus  @default(PENDING)
  paidDate             DateTime?
  paymentId            String?
  paidAmount           Decimal(12, 2)?
  penaltyAmount        Decimal(12, 2)  @default(0.00)
  discountAmount       Decimal(12, 2)  @default(0.00)

  installmentAccount   InstallmentAccount @relation(fields: [installmentAccountId], references: [id])

  @@index([installmentAccountId])
  @@index([dueDate])
  @@index([status])
}

model Payment {
  id                   String            @id @default(cuid())
  installmentAccountId String
  customerId           String
  totalAmount          Decimal(12, 2)
  paymentDate          DateTime
  method               PaymentMethod
  orNumber             String
  paymentType          PaymentType
  penaltyAmount        Decimal(12, 2)    @default(0.00)
  discountAmount       Decimal(12, 2)    @default(0.00)
  notes                String?
  cashier              String?
  createdAt            DateTime          @default(now())

  customer             Customer          @relation(fields: [customerId], references: [id], onDelete: Restrict)
  installmentAccount   InstallmentAccount @relation(fields: [installmentAccountId], references: [id])

  @@unique([orNumber])
  @@index([installmentAccountId])
  @@index([customerId])
  @@index([paymentDate])
}

model PenaltyRecord {
  id                   String             @id @default(cuid())
  installmentAccountId String
  paymentId            String
  amount               Decimal(12, 2)
  appliedDate          DateTime           @default(now())
  reason               String?

  installmentAccount   InstallmentAccount @relation(fields: [installmentAccountId], references: [id])
  payment              Payment            @relation(fields: [paymentId], references: [id])

  @@index([installmentAccountId])
  @@index([appliedDate])
}

model DiscountRecord {
  id                   String             @id @default(cuid())
  installmentAccountId String
  paymentId            String
  amount               Decimal(12, 2)
  appliedDate          DateTime           @default(now())
  reason               String?

  installmentAccount   InstallmentAccount @relation(fields: [installmentAccountId], references: [id])
  payment              Payment            @relation(fields: [paymentId], references: [id])

  @@index([installmentAccountId])
  @@index([appliedDate])
}

model AdminConfig {
  id             String          @id @default(cuid())
  penaltyAmount  Decimal(12, 2)  @default(200.00)
  discountAmount Decimal(12, 2)  @default(200.00)
  dueDayOptions  Int[]           @default([10, 20, 30])
  updatedAt      DateTime        @updatedAt
}
```

---

## REUSABLE COMPONENTS (KEEP AS-IS)

### Infrastructure & Utilities
- `src/lib/prisma.ts` — PgBouncer-compatible singleton
- `src/lib/dates.ts` — Asia/Manila timezone (correct for GM Cycle)
- `src/lib/money.ts` — Decimal.js, 2-decimal precision, PHP formatting
- `src/lib/field-validation.ts` — Name, phone, ID, money sanitization
- `src/lib/errors.ts` — ValidationError, NotFoundError
- `src/lib/api.ts` — readJson(), handleApiError()
- `src/lib/client-api.ts` — typed fetch wrapper
- `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `next.config.ts`, `postcss.config.mjs`, `prisma.config.ts`

### UI Components
- `src/components/page-header.tsx`
- `src/components/status-badge.tsx` — Add DUE_TODAY style
- `src/components/ui-state.tsx` — ErrorMessage, SuccessMessage, LoadingBlock
- `lucide-react` icons

---

## COMPONENTS TO MODIFY

### Schema
- `CreditAccountStatus` enum → rename to `AccountStatus`, add `DUE_TODAY`, rename `PAID` to `FULLY_PAID`
- `Payment` model → add orNumber, paymentType, penaltyAmount, discountAmount, notes, cashier, installmentAccountId (remove allocations)
- `Customer` model → add validIdType
- `Customer` → update serializers/routes to include new field

### API Routes
- `POST /api/credit-accounts` → rewrite as `POST /api/installment-accounts`
- `GET /api/customers/[id]/credit-accounts` → `GET /api/customers/[id]/installment-accounts`
- `POST /api/payments` → add penalty/discount/OR/paymentType logic
- `GET /api/dashboard` → entirely new metrics

### Frontend
- `/dashboard` → new metric cards
- `/customers/[id]` → motorcycle info, contract details, installment schedule
- `/payments/new` → OR number, penalty/discount, payment type
- Navigation layout → rename and restructure links

### Library
- `src/lib/account-labels.ts` → rewrite for installment terminology
- `src/lib/account-status.ts` → add DUE_TODAY, days overdue calculation
- `src/lib/validation.ts` → new schemas
- `src/lib/serializers.ts` → new DTOs, remove product sale serializers
- `src/types/api.ts` → all new DTOs

### Seed
- `prisma/seed.ts` → replace with motorcycle installment data

---

## COMPONENTS TO REMOVE

### Entire Models
- `ProductSale` — no product profit tracking needed
- `PaymentAllocation` — no split payments across accounts
- `CreditAccount` — replaced by InstallmentAccount

### Enums
- `CreditAccountType` (CASH_LOAN, INSTALLMENT) — only one account type now
- `ProductSalePaymentType` — irrelevant
- `ProductSaleStatus` — irrelevant

### API Routes
- `POST /api/product-sales`
- `GET /api/product-sales`
- `GET /api/customers/[id]/product-sales`
- `PUT /api/credit-accounts/[id]` — accounts should not be edited
- `DELETE /api/credit-accounts/[id]` — accounts should be archived, not deleted

### UI Pages
- `/product-sales/new`
- `/credit-accounts/new` (redirect)
- `/cash-loans/new` — replaced by `/installment-accounts/new`

### Library Code
- `src/lib/product-sale.ts` + `src/lib/product-sale.test.ts`
- `src/lib/payment-allocation.ts` + `src/lib/payment-allocation.test.ts`

---

## API DESIGN

### New Endpoints
```
GET|POST /api/installment-accounts
GET      /api/installment-accounts/[id]
GET      /api/installment-accounts/[id]/schedule
GET      /api/installment-accounts/[id]/payments
GET      /api/installment-accounts/[id]/penalties
GET      /api/installment-accounts/[id]/discounts
POST     /api/payments
GET      /api/dashboard
GET      /api/admin/config
PUT      /api/admin/config
GET      /api/reports/collections
GET      /api/reports/daily-collections
GET      /api/reports/monthly-collections
GET      /api/reports/overdue-accounts
GET      /api/reports/penalties
GET      /api/reports/discounts
GET      /api/reports/customer-ledger/[id]
GET      /api/reports/outstanding-balances
```

### Modified Endpoints
```
GET|POST /api/customers — add validIdType
GET|PUT  /api/customers/[id] — add validIdType
GET      /api/customers/[id]/installment-accounts (was: credit-accounts)
GET      /api/customers/[id]/payments — new fields
```

### Removed Endpoints
```
POST /api/credit-accounts
GET|PUT|DELETE /api/credit-accounts/[id]
GET /api/credit-accounts/[id]/payments
GET|POST /api/product-sales
GET /api/customers/[id]/product-sales
GET /api/customers/[id]/credit-accounts
```

---

## PENALTY LOGIC

```typescript
function computePenalty(dueDate: Date, paymentDate: Date, config: { penaltyAmount: Decimal }): Decimal {
  const diffDays = differenceInCalendarDays(paymentDate, dueDate);
  if (diffDays >= 7) {
    return config.penaltyAmount; // default ₱200
  }
  return new Decimal(0);
}
```

Penalty applies per schedule period. Multiple penalties can accrue across multiple overdue periods.

---

## DISCOUNT LOGIC

```typescript
function computeAdvanceDiscount(dueDate: Date, paymentDate: Date, config: { discountAmount: Decimal }): Decimal {
  const diffDays = differenceInCalendarDays(dueDate, paymentDate);
  if (diffDays > 0) {
    return config.discountAmount; // default ₱200
  }
  return new Decimal(0);
}
```

Only one discount per period. Paid exactly on due date = no discount, no penalty.

---

## INSTALLMENT SCHEDULE GENERATION

```typescript
function generateSchedule(
  startDate: Date,
  dueDayOfMonth: number,
  term: number,
  monthlyInstallment: Decimal,
  totalRemainingBalance: Decimal,
): InstallmentScheduleInput[] {
  const schedule: InstallmentScheduleInput[] = [];
  let allocated = new Decimal(0);

  for (let i = 1; i <= term; i++) {
    const dueDate = computeNextDueDate(startDate, dueDayOfMonth, i);
    let amount: Decimal;

    if (i === term) {
      // Last period absorbs rounding remainder
      amount = totalRemainingBalance.minus(allocated);
    } else {
      amount = monthlyInstallment;
      allocated = allocated.plus(amount);
    }

    schedule.push({
      periodNumber: i,
      dueDate,
      amount: amount.toDecimalPlaces(2),
      status: "PENDING",
    });
  }

  return schedule;
}

function computeNextDueDate(startDate: Date, dueDay: number, periodIndex: number): Date {
  const startMonth = startDate.getMonth();
  const startYear = startDate.getFullYear();
  const targetMonth = (startMonth + periodIndex) % 12;
  const yearOffset = Math.floor((startMonth + periodIndex) / 12);
  const targetYear = startYear + yearOffset;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(dueDay, lastDay);
  return new Date(targetYear, targetMonth, safeDay);
}
```

---

## DASHBOARD METRICS (GET /api/dashboard)

```typescript
{
  metrics: {
    // Account
    totalAccounts: number;
    activeAccounts: number;
    fullyPaidAccounts: number;
    overdueAccounts: number;
    dueTodayAccounts: number;
    // Financial
    totalInstallmentSales: string;
    totalDownPayments: string;
    totalCollections: string;
    outstandingBalances: string;
    totalPenaltiesCollected: string;
    totalDiscountsGranted: string;
    // Collection
    collectionsToday: string;
    collectionsThisWeek: string;
    collectionsThisMonth: string;
    // Aging
    aging: {
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      days90plus: number;
    };
  };
}
```

---

## UI RECOMMENDED PAGES

| Route | Description |
|-------|-------------|
| `/dashboard` | Account metrics, financial metrics, collection metrics, aging |
| `/customers` | Customer list with search + create |
| `/customers/[id]` | Profile with motorcycle accounts, payment/penalty/discount history |
| `/installment-accounts/new` | New account form (customer + motorcycle + contract + auto-compute) |
| `/installment-accounts/[id]` | Full account detail with schedule timeline |
| `/payments/new` | Payment posting form (select account, OR#, amount, auto penalty/discount) |
| `/payments` | Payment list with filters |
| `/reports` | Reports hub |
| `/admin/config` | Settings (penalty amount, discount amount, due day) |

**New components needed:**
- InstallmentScheduleTimeline — visual timeline of periods
- PaymentTypeSelector — REGULAR/PARTIAL/ADVANCE/FULL radio group
- AccountSummaryCard — contract info summary
- AgingBarChart — visual aging buckets
- CollectionCards — metric cards for collections
- ReportDateRangeFilter — reusable date range picker

---

## IMPLEMENTATION PLAN (8 Days)

### Phase 1: Foundation (Days 1-3)
- **Day 1:** Create new Prisma schema, migration, remove old tables, seed script
- **Day 2:** Update types, serializers, field validation, create schedule/penalty/discount lib modules
- **Day 3:** Build installment-account API routes, rewrite payments API, rewrite dashboard API, admin config API

### Phase 2: UI (Days 4-6)
- **Day 4:** Rewrite dashboard, create new account form, rewrite customer profile
- **Day 5:** Rewrite payment form, create account detail page with schedule timeline
- **Day 6:** Build report endpoints, create report pages, admin config page, update navigation

### Phase 3: Polish (Days 7-8)
- **Day 7:** Handle edge cases (rounding, partial payments, advance, month-end due days)
- **Day 8:** Write tests, full QA walkthrough

---

## EDGE CASES & RISKS

1. **Rounding:** Last period absorbs remainder; use `toDecimalPlaces(2)`
2. **Month-end due day:** 30th in February → use `new Date(year, month+1, 0)` for last day
3. **Concurrent payments:** Use Prisma transactions
4. **Partial payments:** Mark schedule as PARTIAL, carry balance forward
5. **Advance payments:** Apply excess to next unpaid period(s)
6. **Multiple overdue periods:** Each period incurs its own penalty
7. **No auth:** Acceptable for MVP; add basic auth later
8. **Down payment > installment price:** Validation error

---

## RECOMMENDED INDEXES

```sql
CREATE INDEX idx_installment_account_status ON "InstallmentAccount"(status);
CREATE INDEX idx_installment_account_next_due ON "InstallmentAccount"(nextDueDate);
CREATE INDEX idx_schedule_due_date ON "InstallmentSchedule"(dueDate);
CREATE INDEX idx_schedule_status ON "InstallmentSchedule"(status);
CREATE INDEX idx_payment_or_number ON "Payment"(orNumber);
CREATE INDEX idx_payment_date ON "Payment"(paymentDate);
CREATE INDEX idx_penalty_applied_date ON "PenaltyRecord"(appliedDate);
CREATE INDEX idx_discount_applied_date ON "DiscountRecord"(appliedDate);
```

---

## FILE CHANGE SUMMARY

- **New:** ~25 files (models, API routes, UI pages, lib modules)
- **Modified:** ~15 files (Customer, Payment, Dashboard, seed, types, serializers)
- **Deleted:** ~8 files (ProductSale, PaymentAllocation, cash loan form, etc.)
- **Kept:** ~15 files (infrastructure, shared UI, configs)
