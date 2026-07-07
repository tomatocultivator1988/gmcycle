import { prisma } from "../src/lib/prisma";
import { sendEmail } from "../src/lib/email";
import { dateToManilaDateOnly, getManilaDayRange, getManilaTodayDateString } from "../src/lib/dates";
import { formatPeso } from "../src/lib/money";
import Decimal from "decimal.js";

const TO = "nielmulabac@gmail.com";

async function sendReport(name: string, subject: string, headings: string[], rowsHtml: string, summary: string) {
  const align = (h: string) => {
    if (["Amount","Balance","Days","Per Period","Due Date","Next Due","Cash Price","Down Pmt"].includes(h)) return "right";
    if (["Status","Term","Due Day","Method","Type"].includes(h)) return "center";
    return "left";
  };
  const headerHtml = `<thead><tr style="background:#f1f5f9;">${headings.map((h) => `<th style="padding:5px 6px;text-align:${align(h)};font-weight:600;color:#475569;font-size:11px;white-space:nowrap;">${h}</th>`).join("")}</tr></thead>`;
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:820px;margin:0 auto;background:#fff;padding:24px;">
    <div style="text-align:center;border-bottom:2px solid #991b1b;padding-bottom:16px;margin-bottom:20px;">
      <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0;">MyFaveGadgets</h1>
      <p style="font-size:12px;color:#64748b;margin:4px 0;">Binan City, Laguna</p>
      <p style="font-size:16px;font-weight:600;color:#991b1b;margin:8px 0 0;">${name}</p>
    </div>
    <div style="margin-bottom:20px;">
      <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">Summary</h3>
      <p style="font-size:13px;color:#475569;margin:0;">${summary}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">${headerHtml}<tbody>${rowsHtml}</tbody></table>
    <p style="margin-top:24px;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;">
      MyFaveGadgets — Gadget Installment Monitoring &bull; Generated: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
    </p>
  </div>`;
  await sendEmail({ to: TO, subject, html });
  console.log(`  ✓ ${name} sent`);
}

async function main() {
  console.log(`Sending test emails to ${TO}...\n`);

  // 1. Collections
  let p = await prisma.payment.findMany({ where: { voided: false }, orderBy: { paymentDate: "desc" }, include: { installmentAccount: { select: { brand: true, model: true, customerName: true } } } });
  let total = p.reduce((s, x) => s.plus(new Decimal(x.totalAmount.toString())), new Decimal(0));
  let rows = p.map((x) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.brand} ${x.installmentAccount.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(x.totalAmount.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(x.paymentDate)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${x.method}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${x.paymentType}</td></tr>`).join("");
  await sendReport("Collection Report", `[TEST] Collection Report — ${getManilaTodayDateString()}`, ["Customer","Unit","Amount","Date","Method","Type"], rows, `Total: ${formatPeso(total.toFixed(2))} | Payments: ${p.length}`);

  // 2. Daily Collections
  let r = getManilaDayRange();
  p = await prisma.payment.findMany({ where: { paymentDate: { gte: r.start, lt: r.end }, voided: false }, orderBy: { paymentDate: "desc" }, include: { installmentAccount: { select: { brand: true, model: true, customerName: true } } } });
  total = p.reduce((s, x) => s.plus(new Decimal(x.totalAmount.toString())), new Decimal(0));
  if (p.length > 0) {
    rows = p.map((x) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.brand} ${x.installmentAccount.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(x.totalAmount.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${x.method}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${x.paymentType}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.cashier || "\u2014"}</td></tr>`).join("");
    await sendReport("Daily Collection Report", `[TEST] Daily Collection Report — ${getManilaTodayDateString()}`, ["Customer","Unit","Amount","Method","Type","Cashier"], rows, `Date: ${dateToManilaDateOnly(r.start)} | Total: ${formatPeso(total.toFixed(2))} | Transactions: ${p.length}`);
  } else {
    const noRows = "<p style='color:#94a3b8;font-size:13px;'>No collections today.</p>";
    await sendReport("Daily Collection Report", `[TEST] Daily Collection Report — ${getManilaTodayDateString()}`, [], noRows, `Date: ${dateToManilaDateOnly(r.start)} | No collections.`);
  }

  // 3. Monthly Collections
  let monthStart = new Date(`${dateToManilaDateOnly(r.start).slice(0, 7)}-01T00:00:00.000+08:00`);
  let monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);
  p = await prisma.payment.findMany({ where: { paymentDate: { gte: monthStart, lt: monthEnd }, voided: false }, orderBy: { paymentDate: "desc" }, include: { installmentAccount: { select: { brand: true, model: true, customerName: true } } } });
  total = p.reduce((s, x) => s.plus(new Decimal(x.totalAmount.toString())), new Decimal(0));
  let monthLabel = dateToManilaDateOnly(monthStart).slice(0, 7);
  rows = p.map((x) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.brand} ${x.installmentAccount.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(x.totalAmount.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(x.paymentDate)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${x.method}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${x.paymentType}</td></tr>`).join("");
  await sendReport("Monthly Collection Report", `[TEST] Monthly Collection Report — ${monthLabel}`, ["Customer","Unit","Amount","Date","Method","Type"], rows, `Month: ${monthLabel} | Total: ${formatPeso(total.toFixed(2))} | Transactions: ${p.length}`);

  // 4. Penalties
  let pen = await prisma.penaltyRecord.findMany({ orderBy: { appliedDate: "desc" }, include: { installmentAccount: { select: { brand: true, model: true, customerName: true } } } });
  total = pen.reduce((s, x) => s.plus(new Decimal(x.amount.toString())), new Decimal(0));
  rows = pen.map((x) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.installmentAccount.brand} ${x.installmentAccount.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;color:#b91c1c;">${formatPeso(x.amount.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(x.appliedDate)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${x.reason || "\u2014"}</td></tr>`).join("");
  await sendReport("Penalty Report", `[TEST] Penalty Report — ${getManilaTodayDateString()}`, ["Customer","Unit","Amount","Date","Reason"], rows, `Total: ${formatPeso(total.toFixed(2))} | Records: ${pen.length}`);

  // 5. Due Date Monitoring
  let allAccounts = await prisma.installmentAccount.findMany({ where: { status: { notIn: ["APPLIED", "CLOSED"] } }, orderBy: { nextDueDate: "asc" } });
  let allIds = allAccounts.map((a) => a.id);
  let scheds = allIds.length > 0 ? await prisma.installmentSchedule.findMany({ where: { installmentAccountId: { in: allIds } }, select: { installmentAccountId: true, dueDate: true, status: true } }) : [];
  let sm = new Map<string, typeof scheds>();
  for (const s of scheds) { if (!sm.has(s.installmentAccountId)) sm.set(s.installmentAccountId, []); sm.get(s.installmentAccountId)!.push(s); }
  const now = new Date();
  const today = getManilaTodayDateString();
  let computed = allAccounts.map((a) => { const periods = sm.get(a.id) ?? []; const unpaid = periods.filter((s) => s.status !== "PAID"); let cs = a.status; if (unpaid.length === 0 && periods.length > 0) cs = "FULLY_PAID"; else if (unpaid.length > 0) { cs = unpaid.some((s) => s.dueDate < now) ? "OVERDUE" : unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === today) ? "DUE_TODAY" : "ACTIVE"; } return { ...a, computedStatus: cs }; });
  let active = computed.filter((a) => ["ACTIVE","OVERDUE","DUE_TODAY"].includes(a.computedStatus));
  let overdueCount = active.filter((a) => a.computedStatus === "OVERDUE").length;
  let ids = active.map((a) => a.id);
  let op = ids.length > 0 ? await prisma.installmentSchedule.groupBy({ by: ["installmentAccountId"], where: { installmentAccountId: { in: ids }, status: { in: ["PENDING","OVERDUE","PARTIAL"] }, dueDate: { lt: new Date() } }, _min: { dueDate: true } }) : [];
  let om = new Map(op.map((x) => [x.installmentAccountId, x._min.dueDate]));
  let lp = ids.length > 0 ? await prisma.payment.findMany({ where: { installmentAccountId: { in: ids }, voided: false }, orderBy: { paymentDate: "desc" }, distinct: ["installmentAccountId"] }) : [];
  let pm = new Map(lp.map((x) => [x.installmentAccountId, x]));
  rows = active.map((a) => { const d = om.get(a.id); const days = d ? Math.floor((Date.now() - d.getTime()) / 86400000) : 0; const cs = a.computedStatus; const color = cs === "OVERDUE" ? "#b91c1c" : cs === "DUE_TODAY" ? "#d97706" : "#059669"; const per = a.scheduleType === "SEMI_MONTHLY" ? "/per" : "/mo"; const x = pm.get(a.id); const lpDisp = x ? `${dateToManilaDateOnly(x.paymentDate)} — ${formatPeso(x.totalAmount.toString())}` : "\u2014"; return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.brand} ${a.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerPhone}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(a.nextDueDate)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${color};">${cs}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(a.remainingBalance.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">${formatPeso(a.monthlyInstallment.toString())}<span style="font-size:10px;color:#94a3b8;">${per}</span></td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-size:11px;">${lpDisp}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${days > 0 ? `<span style="color:#b91c1c;">${days}d</span>` : "\u2014"}</td></tr>`; }).join("");
  await sendReport("Due Date Monitoring", `[TEST] Due Date Monitoring — ${today}`, ["Customer","Unit","Contact","Due Date","Status","Balance","Per Period","Last Payment","Days"], rows, `Total: ${active.length} | Overdue: ${overdueCount}`);

  // 6. Outstanding Balances
  let oa = await prisma.installmentAccount.findMany({ where: { status: { notIn: ["APPLIED", "CLOSED"] } }, orderBy: { remainingBalance: "desc" } });
  let oids = oa.map((a) => a.id);
  let oscheds = oids.length > 0 ? await prisma.installmentSchedule.findMany({ where: { installmentAccountId: { in: oids } }, select: { installmentAccountId: true, dueDate: true, status: true } }) : [];
  let osm = new Map<string, typeof oscheds>();
  for (const s of oscheds) { if (!osm.has(s.installmentAccountId)) osm.set(s.installmentAccountId, []); osm.get(s.installmentAccountId)!.push(s); }
  const today2 = dateToManilaDateOnly(new Date());
  let activeOa = oa.filter((a) => { const periods = osm.get(a.id) ?? []; const unpaid = periods.filter((s) => s.status !== "PAID"); if (unpaid.length === 0 && periods.length > 0) return false; return new Decimal(a.remainingBalance.toString()).gt(0); }).map((a) => { const periods = osm.get(a.id) ?? []; const unpaid = periods.filter((s) => s.status !== "PAID"); let cs = a.status; if (unpaid.length > 0) { cs = unpaid.some((s) => s.dueDate < now) ? "OVERDUE" : unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === today2) ? "DUE_TODAY" : "ACTIVE"; } return { ...a, computedStatus: cs }; });
  let oTotal = activeOa.reduce((s, a) => s.plus(new Decimal(a.remainingBalance.toString())), new Decimal(0));
  rows = activeOa.map((a) => { const cs = a.computedStatus; const color = cs === "OVERDUE" ? "#b91c1c" : cs === "DUE_TODAY" ? "#d97706" : "#059669"; return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerPhone}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.brand} ${a.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(a.remainingBalance.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPeso(a.monthlyInstallment.toString())}<span style="font-size:10px;color:#94a3b8;">${a.scheduleType === "SEMI_MONTHLY" ? "/per" : "/mo"}</span></td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(a.nextDueDate)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${color};">${cs}</td></tr>`; }).join("");
  await sendReport("Outstanding Balance Report", `[TEST] Outstanding Balance Report — ${getManilaTodayDateString()}`, ["Customer","Contact","Unit","Balance","Per Period","Due Date","Status"], rows, `Total: ${formatPeso(oTotal.toFixed(2))} | Accounts: ${activeOa.length}`);

  // 7. Account Master List
  let ma = await prisma.installmentAccount.findMany({ where: { status: { notIn: ["APPLIED", "CLOSED"] } }, orderBy: { customerName: "asc" } });
  let mids = ma.map((a) => a.id);
  let mscheds = mids.length > 0 ? await prisma.installmentSchedule.findMany({ where: { installmentAccountId: { in: mids } } }) : [];
  let msm = new Map<string, typeof mscheds>();
  for (const s of mscheds) { if (!msm.has(s.installmentAccountId)) msm.set(s.installmentAccountId, []); msm.get(s.installmentAccountId)!.push(s); }
  let mop = mids.length > 0 ? await prisma.installmentSchedule.groupBy({ by: ["installmentAccountId"], where: { installmentAccountId: { in: mids }, status: { in: ["PENDING","OVERDUE","PARTIAL"] }, dueDate: { lt: new Date() } }, _min: { dueDate: true } }) : [];
  let mom = new Map(mop.map((x) => [x.installmentAccountId, x._min.dueDate]));
  let mTotalBal = ma.reduce((s, a) => s.plus(new Decimal(a.remainingBalance.toString())), new Decimal(0));
  let tcRes = mids.length > 0 ? await prisma.payment.aggregate({ where: { installmentAccountId: { in: mids }, voided: false }, _sum: { totalAmount: true } }) : null;
  let mCollected = tcRes?._sum?.totalAmount?.toFixed(2) ?? "0.00";
  rows = ma.map((a) => { const d = mom.get(a.id); const days = d ? Math.floor((Date.now() - d.getTime()) / 86400000) : 0; const asched = msm.get(a.id) ?? []; const allPaid = asched.length > 0 && asched.every((s) => s.status === "PAID"); const unpaid = asched.filter((s) => s.status !== "PAID"); const isDT = unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === today); let cs: string; if (allPaid) cs = "FULLY_PAID"; else if (days > 0) cs = "OVERDUE"; else if (isDT) cs = "DUE_TODAY"; else cs = "ACTIVE"; const color = cs === "OVERDUE" ? "#b91c1c" : cs === "FULLY_PAID" ? "#059669" : cs === "DUE_TODAY" ? "#d97706" : "#0f172a"; const nu = unpaid.length > 0 ? unpaid.reduce((a, b) => a.periodNumber < b.periodNumber ? a : b) : null; const ndd = nu ? dateToManilaDateOnly(nu.dueDate) : "\u2014"; const tl = a.scheduleType === "SEMI_MONTHLY" ? `${a.term} per` : `${a.term} mos`; const ddl = Array.isArray(a.dueDays) ? a.dueDays.join("/") : String(a.dueDays ?? "\u2014"); return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerName}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerPhone}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.brand} ${a.model}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-size:11px;">${formatPeso(a.cashPrice.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;">${formatPeso(a.downPayment.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(a.remainingBalance.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPeso(a.monthlyInstallment.toString())}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-size:11px;">${ndd}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;">${tl}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;">${ddl}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(a.nextDueDate)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${color};">${cs}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${days > 0 ? `<span style="color:#b91c1c;">${days}d</span>` : "\u2014"}</td></tr>`; }).join("");
  await sendReport("Account Master List", `[TEST] Account Master List — ${today}`, ["Customer","Contact","Unit","Cash Price","Down Pmt","Balance","Per Period","Next Due","Term","Due Day","Due Date","Status","Days"], rows, `Total: ${ma.length} | Balance: ${formatPeso(mTotalBal.toFixed(2))} | Collected: ${formatPeso(mCollected)}`);

  console.log("\n✓ All 7 reports sent!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
