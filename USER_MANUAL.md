# MyFaveGadgets — User Manual

## Gadget Installment Monitoring System

---

## 1. Introduction

MyFaveGadgets is a system for monitoring gadget and motorcycle installment accounts. It helps you track customer information, payment schedules, collections, penalties, and account statuses. The system is designed for the staff of MyFaveGadgets in Binan City, Laguna.

This manual covers everything you can do in the system — from creating a new account to printing reports. Each section explains a feature step by step. You do not need any technical knowledge to use this manual.

---

## 2. System Overview

The system has six main sections, accessible from the navigation bar:

| Section | Purpose |
|---------|---------|
| **Dashboard** | View overall business metrics at a glance |
| **Accounts** | Manage all installment accounts |
| **Payments** | Record and view customer payments |
| **Reports** | Generate collection, overdue, and account reports |
| **Settings** | Configure penalty rates and admin email |

---

## 3. Getting Started

### 3.1 Opening the System

Open your web browser and go to the system URL provided by your administrator. You will see the Dashboard as your home page.

### 3.2 The Screen Layout

- **Top bar (Header):** Shows the MyFaveGadgets logo and company name on the left, and navigation links on the right (Dashboard, Accounts, Payments, Reports, Settings).
- **Main area:** Displays the current page content.
- **On mobile:** The navigation bar moves to the bottom of the screen with icon buttons. The company name and logo appear at the top.

---

## 4. Navigation Guide

### 4.1 Desktop Navigation

Click any of these links in the top header to jump to that section:

- **Dashboard** — Home page with summary metrics
- **Accounts** — List of all installment accounts
- **Payments** — List of all payment records
- **Reports** — Collection and monitoring reports
- **Settings** — System configuration

### 4.2 Mobile Navigation

On phones, use the icon buttons at the bottom of the screen to navigate between sections.

### 4.3 Going Back

Most pages have a **Back** or **All Reports** button to return to the previous screen. On the Accounts page, use the browser back button or the navigation bar.

---

## 5. Feature-by-Feature Instructions

---

### 5.1 DASHBOARD

The Dashboard is your home page. It shows key numbers about your business.

#### What You See

- **Total Accounts** — How many accounts are in the system
- **Active Accounts** — Accounts currently being paid
- **Fully Paid Accounts** — Completed accounts
- **Overdue Accounts** — Accounts past their due date
- **Due Today** — Accounts with payment due today
- **Applied Accounts** — New accounts not yet activated
- **Total Installment Sales** — Total value of all installment contracts
- **Total Down Payments** — Sum of all down payments collected
- **Total Collections** — All payments received
- **Outstanding Balances** — Total amount still owed by customers
- **Total Penalties Collected** — Penalty fees collected
- **Collections Today / This Week / This Month** — Recent collection amounts
- **Aging Summary** — How many accounts are overdue and for how long

#### Quick Actions

Below the metrics, you will see action cards showing:
- **Due Today** — Number of accounts due today
- **Overdue** — Overdue accounts grouped by severity
- **Unactivated** — Accounts waiting to be activated

Click any number to go directly to the relevant section.

---

### 5.2 ACCOUNTS (Installment Accounts)

The Accounts page is where you manage all customer installment accounts.

#### 5.2.1 Accounts List

The main Accounts page shows a table of all installment accounts.

**Columns displayed:**
- Customer Name
- Device/Item (brand and model)
- Balance (remaining amount owed)
- Monthly Installment
- Status (Applied, Active, Due Today, Overdue, Fully Paid, Closed)
- Next Due Date
- Actions (Bad Record button, View button)

**Searching:**
Use the search box at the top to find accounts by customer name, brand, or model. Just type and results appear automatically.

**Showing Closed Accounts:**
By default, closed accounts are hidden. Click the **"Show Closed"** button to see them. Click again to hide them.

**Marking Bad Record:**
Click the **"Bad Record"** button next to any account to flag it. Enter a reason (remark) and confirm. Bad record accounts are highlighted in the list. To remove the flag, click the button again.

**Viewing an Account:**
Click the **"View"** button next to any account to open its full detail page.

**Send Reminders:**
Click the **"Send Reminders"** button to open the reminder selection modal (see Section 5.2.5).

#### 5.2.2 Creating a New Account

Click the **"New Account"** button (red, top right) on the Accounts page.

You must fill in all fields. Required fields are marked with an asterisk (*).

**Customer Details:**
| Field | What to Enter |
|-------|---------------|
| Full Name | Customer's complete name |
| Contact | Phone number (7 to 15 digits) |
| Email | Customer's email address (required) |
| Address | Customer's full address |
| Facebook Profile Link | Customer's Facebook profile URL (required) |

**Device Details:**
Select the item type first — **Gadget** or **Cash**.

| Field | What to Enter |
|-------|---------------|
| Item Type | Gadget (motorcycle/phone) or Cash |
| Brand | Brand name (e.g., Honda, Samsung) |
| Model | Model name (e.g., Click 125i) |
| Unit Description | Short description of the unit |

**Custom Fields (optional):**
You can add extra fields like Reference Number, Color, etc. Click **"+ Add Field"** to add a key-value pair.

**Contract Details:**
| Field | What to Enter |
|-------|---------------|
| Cash Price | The original cash price of the item |
| Interest Rate (% per month) | Monthly interest rate percentage |
| Down Payment | Amount paid upfront |
| Processing Fee | Any processing or documentation fee |
| Term (months) | How many months (6 to 48) |
| First Due Date | When the first payment is due |
| Date Given | When the item was given to the customer |

**Schedule:**
Choose the payment frequency:
- **Semi-Monthly** — Two due dates per month (e.g., 15th and 30th)
- **Monthly** — One due date per month

**Preview:**
As you fill in the contract details, the system automatically computes:
- Installment Price (cash price + total interest)
- Remaining Balance
- Monthly Installment
- Number of periods

**Creating the Account:**
Click **"Create Account"** when all fields are filled. A confirmation will appear with two options:
- **View Account** — Go to the account detail page
- **Down Payment Receipt** — Print the down payment receipt immediately

#### 5.2.3 Account Detail Page

When you view an account, you will see several sections:

**Customer Information:**
- Customer name, phone, email, address
- Facebook profile link (clickable, opens in new tab)

**Account Summary:**
- Status badge
- Remaining Balance
- Next Due Date
- Days Overdue
- Date Given
- First Due Date

**Action Buttons (top right):**
| Button | What It Does |
|--------|-------------|
| Statement | View and print full account statement |
| DP Receipt | View and print down payment receipt |
| Edit | Edit customer and device information |
| Post Payment | Record a new payment |
| Close | Close the account (ends the account) |
| Requirements | Show activation checklist (for Applied accounts) |

**Requirements Checklist (for Applied accounts):**
Before activating an account, you must complete:
- Customer has valid ID
- Proof of income verified
- Down payment collected
- Processing fee collected

Click the **Requirements** button to see which items are pending. When all are marked complete, the account can be activated.

**Activating an Account:**
Applied accounts have an **"Activate Account"** button. Click it to change the status from Applied to Active and start the payment schedule.

**Installment Schedule Timeline:**
Shows each period (due date) as a card. Each period shows:
- Period number
- Due date
- Amount due
- Status (Pending, Paid, Overdue, Partial)
- Penalty amount (if any)
- Payment date (if paid)

For overdue periods, you can apply a penalty by clicking the **"Apply Penalty"** button on the period card.

**Payment History:**
Lists all payments made for this account. Each row shows:
- Date
- Amount
- Payment Type (Regular, Partial, Full)
- Method (Cash, GCash, Bank)
- Penalty included
- Proof (click to view image in a popup)
- **Print** button — opens the payment receipt
- **Void** button — cancels this payment (requires typing "VOID" to confirm)

**Penalty History:**
Lists all penalties applied to this account. Each row shows:
- Amount
- Date applied
- Reason

#### 5.2.4 Posting a Payment

From the Account Detail page, click **"Post Payment"**.

**Fields:**
| Field | What to Enter |
|-------|---------------|
| Amount Paid | The amount the customer is paying |
| Payment Date | Date the payment was made (defaults to today) |
| Payment Type | Auto-detected: Regular, Partial, or Full (read-only) |
| Method | Cash, GCash, or Bank |
| Cashier | Name of the cashier (optional) |
| Notes | Any additional notes (optional) |
| Payment Proof | Upload an image of the receipt/proof (optional) |

**Payment Type Auto-Detection:**
The system automatically determines the payment type based on the amount:
- **Full** — Amount covers the entire remaining balance
- **Partial** — Amount is less than one monthly installment
- **Regular** — Amount is at least one monthly installment

You do not need to select the type manually.

**After Posting:**
- The remaining balance is updated
- Schedule periods are marked as paid
- A confirmation appears
- If the customer has an email, a receipt is sent automatically

**Posting from the Payments Page:**
You can also post payments from the main Payments page. The process is the same, but you must first select the account from a dropdown list. The account's balance, next due date, and monthly installment are displayed for reference.

#### 5.2.5 Sending Reminders

Click **"Send Reminders"** on the Accounts page.

A modal opens showing all accounts that have email addresses. You can filter by:
- **Date:** Only accounts with due dates on or before the selected date
- **Status:** All, Active, Overdue, or Due Today

**Selecting Accounts:**
- Click individual checkboxes to select specific accounts
- Click the top checkbox to select or deselect all

**Sending:**
Click **"Send to X accounts"** to email reminders to the selected accounts. Each customer receives an email listing their unpaid periods with:
- Period number and due date
- Amount due
- Days overdue
- Penalty amount (if any)
- Total due per period

---

### 5.3 PAYMENTS

The Payments page shows all payment records across all accounts.

#### 5.3.1 Payments List

Each row shows:
- Customer Name
- Amount
- Date
- Payment Type (Regular, Partial, Full, Advance)
- Penalty (if any)
- Method
- Proof (clickable image thumbnail)
- **Receipt** button — opens the printable payment receipt

**On mobile:** Tap a payment card to expand and see all details.

**Posting a New Payment:**
Click **"New Payment"** to open the payment form (see Section 5.2.4).

#### 5.3.2 Payment Receipt

Click the **"Receipt"** button on any payment row to view the full receipt. The receipt shows:

- Receipt Number
- Date
- Payment Type and Method
- Customer Name, Address, Phone
- Device/Brand details
- Amount Paid
- Penalty (if any)
- Total Paid by this customer
- Remaining Balance
- Payment progress (e.g., "Payment 3 of 12 months")
- Notes and Cashier name
- **Print** button — prints the receipt

#### 5.3.3 Voiding a Payment

From the Account Detail page, click **"Void"** on any payment row in the Payment History section.

A confirmation modal appears. You must type the word **"VOID"** (all caps) and provide a reason. The payment will be cancelled and the account balance will be recalculated.

**Important:** Voiding cannot be undone. Only void payments that were truly made in error.

---

### 5.4 APPLYING PENALTIES

Penalties are applied per overdue period from the Account Detail page.

**To apply a penalty:**
1. Go to the Account Detail page
2. Find the overdue period in the Schedule Timeline
3. Click **"Apply Penalty"** on that period
4. The modal shows:
   - Days overdue
   - Penalty rate (per day)
   - Accrued penalty (days × rate)
   - Applied amount (you can adjust this to waive a portion)
   - Waived amount (the difference)
5. Enter the amount you want to apply
6. Click **"Apply Penalty"**

The penalty amount is added to the account's remaining balance. Penalty history is recorded.

---

### 5.5 CLOSING AN ACCOUNT

Use this when a customer stops paying or the account needs to be terminated.

**To close an account:**
1. Go to the Account Detail page
2. Click the **"Close"** button
3. If there is an outstanding balance, a warning appears showing how much will be written off
4. Enter a **remark** explaining why the account is being closed
5. Enter the **admin password** (`myfave2026`)
6. Click **"Close Account"**

**What happens when you close:**
- The account status changes to **Closed**
- The remaining balance is set to zero (written off)
- The write-off amount is recorded in the remarks
- Closed accounts are hidden from most reports and monitoring
- The account's payment history is preserved

**To view closed accounts:**
On the Accounts page, click the **"Show Closed"** button.

**Important:** Closing requires the admin password. Closing cannot be undone.

---

### 5.6 EDITING AN ACCOUNT

From the Account Detail page, click **"Edit"**.

**You can change:**
- Customer name, phone, email, address
- Facebook profile link
- Item type (Gadget or Cash)
- Brand, model, unit description
- Processing fee
- Custom fields

**You cannot change:**
- Contract terms (price, down payment, interest rate, term)
- Payment schedule

Click **"Save Changes"** to update the account.

---

### 5.7 ADJUSTING DUE DATES

From the Account Detail page, click **"Adjust Due Dates"** (in the schedule section).

This allows you to change the due day for all future unpaid periods. Enter the new due day and confirm. This is useful if the customer requests a different due date.

---

### 5.8 DEVICE SECURITY

From the Account Detail page, you can set up device security credentials (for gadget accounts). This stores the email and password associated with the device (e.g., Google account on an Android phone).

Click **"Device Security"** and enter:
- Device Email
- Device Email Password
- Account Holder Email

This information is stored securely and can be used for device tracking or recovery.

---

### 5.9 ACCOUNT STATEMENT

The Statement page shows a complete, printable summary of the account.

**To access:** Click **"Statement"** on the Account Detail page.

The statement includes:
- Customer information
- Device information
- Contract details (cash price, installment price, down payment, etc.)
- Full payment history
- Full schedule (all periods with status)
- Penalty history
- Total payments and total penalties

Click **"Print / Export PDF"** to save or print the statement.

---

### 5.10 DOWN PAYMENT RECEIPT

A separate receipt for the down payment and processing fee.

**To access:**
- From Account Detail: Click **"DP Receipt"**
- From Statement page: Click **"DP Receipt"**
- After creating an account: Click **"Down Payment Receipt"** in the success popup

The receipt shows:
- Receipt Number (DP-XXXXXXXX)
- Date Given
- Customer information
- Device information
- Down Payment amount
- Processing Fee amount
- Total Paid (down payment + processing fee)

Click **"Print"** to print.

---

### 5.11 REPORTS

The Reports section contains seven reports. Access them from the sidebar or the main Reports page.

#### 5.11.1 Collection Report

Shows ALL payments ever recorded.

**Filters:** None (shows all payments).

**Columns:** Customer (clickable link to account), Unit, Amount, Date, Method, Payment Type.

#### 5.11.2 Daily Collection Report

Shows collections for a specific day. Defaults to today.

**Filters:**
- **Date picker** — select any date to view that day's collections
- Click **Clear Filter** to return to today

**Columns:** Customer (link), Unit, Amount, Method, Payment Type, Cashier.

#### 5.11.3 Monthly Collection Report

Shows collections for a specific month. Defaults to the current month.

**Filters:**
- **Month picker** — select any month to view that month's collections
- Click **Clear Filter** to return to current month

**Columns:** Customer (link), Unit, Amount, Date, Method, Payment Type.

#### 5.11.4 Due Date Monitoring

Shows all active accounts sorted by due date. This is your main collection tool.

**Filters:**
- **Date picker** — "Due on or before" a specific date. This shows all accounts whose next due date falls on or before the selected date.
- **Example:** Select June 15 to see everyone who should have paid by June 15 — including overdue accounts and accounts exactly due on June 15.

**Columns:** Customer (link), Unit, Contact, Due Date, Status, Balance, Monthly, Last Payment.

**On mobile:** Tap a card to expand and see the details.

#### 5.11.5 Account Master List

A complete reference list of all non-applied, non-closed accounts.

**Filters:**
- **Date picker** — Show accounts with due dates on or before the selected date
- **Status chips:**
  - **All** — All accounts
  - **Paid** — Accounts that have paid all schedule periods due on or before the selected date
  - **Unpaid** — Accounts that still have unpaid periods due on or before the selected date

**Summary cards:**
- Total Accounts
- Total Balance Outstanding
- Total Collected

**Columns:** Customer (link), Contact, Unit, Cash Price, Down Payment, Balance, Monthly, Term, Due Day, Due Date, Status, Days Overdue, Last Payment, Total Paid.

This is useful for identifying who to collect from vs. who has already paid.

#### 5.11.6 Penalty Report

Shows all penalties applied across all accounts.

**Columns:** Customer, Unit, Amount, Date Applied, Reason.

#### 5.11.7 Outstanding Balance Report

Shows all active accounts that still have a remaining balance.

**Columns:** Customer, Contact, Unit, Balance, Monthly, Due Date, Status.

**Summary:** Total Outstanding, Active Accounts.

#### 5.11.8 Printing and Exporting Reports

All reports have a **"Print / Export PDF"** button at the top. Click it to open the browser's print dialog, where you can:
- Print the report directly
- Save as PDF (select "Save as PDF" as the printer)

On the printed version, the filter, navigation, and buttons are hidden — only the report data is shown.

---

### 5.12 SETTINGS

Access from the navigation bar: **Settings**.

#### 5.12.1 Penalty Settings

- **Penalty Per Day (₱):** The penalty amount charged per day for overdue payments. Default is ₱50.00. You can change this at any time.

#### 5.12.2 Admin Email

- **Admin Email (for reports):** Email address where reports can be sent. This is optional.

Click **"Save Configuration"** to apply changes.

---

### 5.13 MOBILE USAGE

The system works on mobile phones and tablets.

#### Key Mobile Differences:
- **Navigation** — Icon buttons at the bottom instead of text links at the top
- **Tables** — On small screens, tables become cards. Tap a card to expand and see all details
- **Account Master List** — Cards show Customer Name + Status. Tap to expand and see full details
- **Due Date Monitoring** — Same card layout
- **Payments** — Cards show Customer + Type. Tap to expand

All features, forms, and reports work the same way on mobile as on desktop.

---

## 6. Common Tasks and Workflows

### 6.1 Registering a New Customer (Complete Flow)

1. Go to **Accounts** → Click **"New Account"**
2. Fill in all Customer Details (name, phone, email, address, FB link)
3. Select **Item Type** (Gadget or Cash)
4. Enter Device Details (brand, model, description)
5. Enter Contract Details (cash price, interest rate, down payment, term, dates)
6. Select **Schedule** (Semi-Monthly or Monthly)
7. Review the preview section
8. Click **"Create Account"**
9. In the success popup, click **"Down Payment Receipt"** to print the receipt
10. Complete the Requirements checklist:
    - Go to Account Detail → Click **"Requirements"**
    - Mark each item as complete
11. Click **"Activate Account"** to start the payment schedule

### 6.2 Recording a Daily Collection

1. Go to **Payments** → Click **"New Payment"**
2. Select the customer from the dropdown
3. Enter the amount paid
4. The payment type is auto-detected (no need to select)
5. Select the payment method (Cash, GCash, Bank)
6. Optionally enter cashier name and notes
7. Click **"Post Payment"** → Confirm
8. The receipt is automatically emailed to the customer (if they have an email)

### 6.3 Checking Who Needs to Pay Today

1. Go to **Reports** → Click **"Due Date Monitoring"**
2. The list shows all active accounts sorted by due date
3. Use the date picker to see who was due on or before a specific date
4. Accounts with **Overdue** status need immediate follow-up
5. Click any customer name to go to their account detail

### 6.4 Sending Payment Reminders

1. Go to **Accounts** → Click **"Send Reminders"**
2. Use the date filter to select which accounts to include
3. Use the status chips (All, Active, Overdue, Due Today) to narrow down
4. Check the boxes for the accounts you want to remind
5. Click **"Send to X accounts"**
6. Each customer receives an email with their unpaid periods and amounts due

### 6.5 Closing an Unpaid Account

1. Go to the Account Detail page of the account
2. Click **"Close"**
3. Read the warning about the write-off amount
4. Enter a remark explaining why
5. Enter the admin password (`myfave2026`)
6. Click **"Close Account"**
7. The account is now Closed and removed from active monitoring

### 6.6 Printing an Account Statement

1. Go to Account Detail → Click **"Statement"**
2. Review the complete statement
3. Click **"Print / Export PDF"**
4. In the print dialog, choose "Save as PDF" or select your printer

### 6.7 Viewing End-of-Day Collections

1. Go to **Reports** → Click **"Daily Collection Report"**
2. The report defaults to today
3. Use the date picker to view a different day
4. Click **"Print / Export PDF"** to save or print

---

## 7. Troubleshooting and Frequently Asked Questions

### 7.1 "Why can't I activate an account?"

The account must have all requirements met. Go to Account Detail → Click **"Requirements"** and make sure all items are marked complete.

### 7.2 "Why can't I close an account?"

You need to enter the correct admin password (`myfave2026`). If you forgot it, ask your manager.

### 7.3 "I made a mistake with a payment. How do I fix it?"

Go to the Account Detail page, find the payment in Payment History, and click **"Void"**. You must type "VOID" to confirm.

### 7.4 "Why is the account balance not updating?"

The balance updates automatically after each payment, penalty, or void. Refresh the page if you don't see the change.

### 7.5 "Why does the search feel slow?"

The system searches across all accounts in the database. Try typing a more specific name, brand, or model for faster results.

### 7.6 "Can I edit the contract terms after creating an account?"

No. Contract terms (price, down payment, interest rate, term) cannot be changed after creation. You can only edit customer details and device information.

### 7.7 "How do I mark an account as fully paid?"

You don't need to. When all schedule periods are paid, the account automatically changes to Fully Paid status.

### 7.8 "The table is cut off on my screen."

On small screens, tables become cards. Tap a card to expand and see all details. On desktop, the table adjusts to fit your screen.

### 7.9 "I can't see closed accounts."

By default, closed accounts are hidden. Click **"Show Closed"** on the Accounts page to view them.

### 7.10 "What happens when I void a payment?"

The payment is cancelled, the schedule periods are reset to unpaid, the balance is recalculated, and any penalties linked to that payment are removed. Voiding cannot be undone.

---

## 8. Important Reminders

### 8.1 Data Accuracy
- Always enter correct amounts and dates
- Double-check customer details before saving
- Verify the payment amount before posting

### 8.2 Password Security
- The admin password for closing accounts is **`myfave2026`**
- Do not share this password with unauthorized staff
- Only managers should close accounts

### 8.3 Payment Types
- You do not need to manually select the payment type — the system detects it automatically
- **Regular** — Standard monthly payment
- **Partial** — Less than one monthly installment
- **Full** — Pays off the entire remaining balance

### 8.4 Penalties
- Penalties are applied per period, not per account
- The penalty rate is configurable in Settings (default ₱50/day)
- You can waive a portion of the penalty when applying it
- Applied penalties increase the remaining balance

### 8.5 Reports
- All reports have Print/Export PDF buttons
- Reports reflect the filters you have selected
- The date filter in Due Date Monitoring and Account Master List affects the totals shown

### 8.6 Closed Accounts
- Closing an account writes off the remaining balance
- Closed accounts are preserved for record-keeping
- Closed accounts are hidden from reports and monitoring by default
- Closing cannot be undone

### 8.7 Emails
- Customers with email addresses automatically receive receipts after payments
- Reminder emails show all unpaid periods with penalty details
- Make sure customer email addresses are correct

---

## 9. Glossary of Terms

| Term | Definition |
|------|------------|
| **Account** | An installment record for one customer and one item |
| **Activate** | Change an account from Applied to Active status, starting the payment schedule |
| **Active** | An account that is current and on track |
| **Applied** | A new account that has not yet been activated |
| **Bad Record** | A flagged account with collection issues |
| **Balance (Remaining)** | How much the customer still owes |
| **Cash Price** | The original cash price of the item |
| **Close** | Terminate an account (write off remaining balance) |
| **Collection** | A payment received from a customer |
| **Down Payment** | The upfront amount paid when the account is created |
| **Due Date** | The date a payment is scheduled |
| **Due Today** | An account whose payment is due on the current date |
| **Fully Paid** | An account where all payments are complete |
| **Installment Price** | The total price including interest |
| **Interest Rate** | The monthly interest percentage applied to the financed amount |
| **Monthly Installment** | The amount due each payment period |
| **Overdue** | An account past its due date with outstanding balance |
| **Partial Payment** | A payment less than one full installment |
| **Penalty** | A fee charged for late payment |
| **Period** | One installment payment in the schedule |
| **Processing Fee** | A documentation or processing charge |
| **Receipt** | A printed or digital proof of payment |
| **Schedule** | The list of all payment periods and their due dates |
| **Statement** | A complete summary of an account's history |
| **Term** | The number of months for the installment contract |
| **Void** | Cancel a payment that was made in error |
| **Write-off** | Removing an outstanding balance when closing an account |

---

**MyFaveGadgets — Binan City, Laguna**

*End of User Manual*
