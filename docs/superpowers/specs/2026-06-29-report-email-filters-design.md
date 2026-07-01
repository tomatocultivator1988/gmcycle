# Report Email — Pass Active Filters to Email API

**Date:** 2026-06-29
**Status:** Approved

## Problem

Each report page has filter controls (date picker, paid/unpaid toggle, month picker). The display/print/export correctly respects these filters. The Email Report button, however, sends a bare POST with no filter params — causing every email API route to fetch ALL records unconditionally.

**Affected reports:**
| Report | Filter on screen | Email currently sends |
|--------|-----------------|----------------------|
| Due Date Monitoring (`overdue-accounts`) | Date ("Due on or before") | All active accounts |
| Account Master List (`account-master-list`) | Date + Paid/Unpaid/All | All non-closed accounts |
| Daily Collections (`daily-collections`) | Specific date | Always today |
| Monthly Collections (`monthly-collections`) | Specific month | Always current month |

## Solution

### Client: pass filter params as query string to email POST

In `src/app/reports/[slug]/page.tsx`, the email button builds URL search params from current filter state and appends them to the POST URL:

```
POST /api/reports/{slug}/email?date=2026-06-15&paidStatus=unpaid
```

### Server: each email POST reads filter params and applies them

Each affected email route reads `request.nextUrl.searchParams` and applies the same filter logic as the corresponding GET route. Supports both query string and JSON body (query string takes precedence).

**4 routes changed:**
- `overdue-accounts/email` — `?date=` → `nextDueDate <= date`
- `account-master-list/email` — `?date=` + `?paidStatus=` → schedule + paid/unpaid filter
- `daily-collections/email` — `?date=` → `paymentDate` in date range
- `monthly-collections/email` — `?month=` → `paymentDate` in month range

**3 routes unchanged** (no filters on their pages):
- `collections/email`
- `penalties/email`
- `outstanding-balances/email`

### Files changed

1. `src/app/reports/[slug]/page.tsx` — email button builds query string from filter state
2. `src/app/api/reports/overdue-accounts/email/route.ts` — accept + apply `?date=`
3. `src/app/api/reports/account-master-list/email/route.ts` — accept + apply `?date=` + `?paidStatus=`
4. `src/app/api/reports/daily-collections/email/route.ts` — accept + apply `?date=`
5. `src/app/api/reports/monthly-collections/email/route.ts` — accept + apply `?month=`
