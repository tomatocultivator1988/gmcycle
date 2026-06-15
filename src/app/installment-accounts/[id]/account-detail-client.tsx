"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Decimal from "decimal.js";
import { FormEvent, memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  ChevronDown,
  ChevronUp,
  Printer,
  ReceiptText,
  User,
  MapPin,
  Save,
  X,
  Hash,
  AlertTriangle,
  Check,
  UserCheck,
  FileText,
  Pencil,
  Ban,
  Lock,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { FieldError } from "@/components/field-error";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import { dateToManilaDateOnly } from "@/lib/dates";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useEscapeKey } from "@/lib/use-escape-key";
import { createPaymentSchema } from "@/lib/validation";
import { validateForm, type FieldErrors } from "@/lib/form-validation";
import type {
  InstallmentAccountDto,
  InstallmentScheduleDto,
  PaymentDto,
  PenaltyRecordDto,
  AccountStatusValue,
  ScheduleStatusValue,
  PaymentMethod,
  PaymentTypeValue,
} from "@/types/api";

const scheduleStatusStyles: Record<ScheduleStatusValue, string> = {
  PENDING: "border-slate-200 bg-white",
  PAID: "border-emerald-200 bg-emerald-50",
  OVERDUE: "border-rose-200 bg-rose-50",
  PARTIAL: "border-amber-200 bg-amber-50",
};

function todayDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const InfoCard = memo(function InfoCard({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`mt-0.5 text-sm font-medium text-slate-900 truncate ${valueClass ?? ""}`}>{value}</div>
      </div>
    </div>
  );
});

const StatCard = memo(function StatCard({ label, value, valueClass = "text-slate-900" }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1.5 text-xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
});

export function AccountDetailClient({ accountId }: { accountId: string }) {
  const [account, setAccount] = useState<InstallmentAccountDto | null>(null);
  const [schedule, setSchedule] = useState<InstallmentScheduleDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRecordDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    totalAmount: "",
    paymentDate: todayDateOnly(),
    method: "CASH" as PaymentMethod,
    paymentType: "REGULAR" as PaymentTypeValue,
    notes: "",
    cashier: "",
    proofUrl: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [penaltyPeriodId, setPenaltyPeriodId] = useState<string | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyPerDay, setPenaltyPerDay] = useState("50");
  const [applyingPenalty, setApplyingPenalty] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [undoPenaltyId, setUndoPenaltyId] = useState<string | null>(null);
  const [undoingPenalty, setUndoingPenalty] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    fbLink: "",
    brand: "",
    model: "",
    unitDescription: "",
    itemType: "GADGET" as "GADGET" | "CASH",
    cashPrice: "",
    downPayment: "",
    processingFee: "",
    interestRate: "",
    term: 24,
    scheduleType: "SEMI_MONTHLY" as "SEMI_MONTHLY" | "MONTHLY",
    firstDueDate: "",
    dateGiven: "",
    editPassword: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editCustomFields, setEditCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [requirements, setRequirements] = useState<Record<string, boolean>>({
    validId: false,
    selfie: false,
    proofOfIncome: false,
    proofOfAddress: false,
    residencePhoto: false,
  });
  const [activating, setActivating] = useState(false);
  const [showAdjustDueModal, setShowAdjustDueModal] = useState(false);
  const [adjustDueDay1, setAdjustDueDay1] = useState("");
  const [adjustDueDay2, setAdjustDueDay2] = useState("");
  const [adjustDueError, setAdjustDueError] = useState("");
  const [savingAdjustDue, setSavingAdjustDue] = useState(false);
  const [editDueDay1, setEditDueDay1] = useState("");
  const [editDueDay2, setEditDueDay2] = useState("");
  const [editDueError, setEditDueError] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidConfirm, setVoidConfirm] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [closeRemarks, setCloseRemarks] = useState("");
  const [closePassword, setClosePassword] = useState("");
  const [closeError, setCloseError] = useState("");
  const [closing, setClosing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeviceSecurity, setShowDeviceSecurity] = useState(false);
  const [isEditingDeviceSecurity, setIsEditingDeviceSecurity] = useState(false);
  const [deviceEmail, setDeviceEmail] = useState("");
  const [deviceEmailPassword, setDeviceEmailPassword] = useState("");
  const [deviceAccountHolderEmail, setDeviceAccountHolderEmail] = useState("");
  const [savingDeviceSecurity, setSavingDeviceSecurity] = useState(false);

  const loadData = useCallback(() => {
    let active = true;

    apiRequest<any>(`/api/installment-accounts/${accountId}/statement`)
      .then((res) => {
        if (active) {
          setAccount(res.installmentAccount);
          setSchedule(res.schedule);
          setPayments(res.payments);
          setPenalties(res.penalties);
        }
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [accountId]);

  useEffect(() => {
    const cancel = loadData();
    return cancel;
  }, [loadData]);

  useEffect(() => {
    apiRequest<{ config: { penaltyPerDay: string } }>("/api/admin/config")
      .then((data) => setPenaltyPerDay(data.config.penaltyPerDay))
      .catch(() => {});
  }, []);

  useBodyScrollLock(showModal || showPenaltyModal || showEditModal || showCloseModal || showDeleteModal || showVoidModal || showDeviceSecurity || showAdjustDueModal);
  useEscapeKey(() => setShowModal(false), showModal);
  useEscapeKey(() => setShowPenaltyModal(false), showPenaltyModal);
  useEscapeKey(() => setShowEditModal(false), showEditModal);
  useEscapeKey(() => setShowCloseModal(false), showCloseModal);
  useEscapeKey(() => setShowDeleteModal(false), showDeleteModal);
  useEscapeKey(() => setShowVoidModal(false), showVoidModal);
  useEscapeKey(() => setShowDeviceSecurity(false), showDeviceSecurity);
  useEscapeKey(() => setShowAdjustDueModal(false), showAdjustDueModal);

  const latestNonVoidedPaymentId = useMemo(() => {
    const valid = payments.filter((p) => !p.voided);
    if (valid.length === 0) return null;
    const sorted = [...valid].sort((a, b) => {
      const dateCmp = new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
      if (dateCmp !== 0) return dateCmp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted[0].id;
  }, [payments]);

  // Total penalty applied per schedule period (from PenaltyRecords)
  const penaltyAppliedByPeriod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of penalties) {
      if (!p.installmentScheduleId) continue;
      const current = map.get(p.installmentScheduleId) || 0;
      map.set(p.installmentScheduleId, current + parseFloat(p.amount));
    }
    return map;
  }, [penalties]);

  async function handlePostPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;

    setPostError("");
    setPostSuccess("");

    const validation = validateForm(createPaymentSchema, {
      installmentAccountId: account.id,
      totalAmount: form.totalAmount,
      paymentDate: form.paymentDate,
      method: form.method,
      paymentType: form.paymentType,
      notes: form.notes || undefined,
      cashier: form.cashier || undefined,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    // Upload proof file first if present, then confirm
    if (proofFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", proofFile);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setForm((prev) => ({ ...prev, proofUrl: data.url }));
        setUploading(false);
        setShowPaymentConfirm(true);
      } catch (uploadError) {
        setPostError((uploadError as Error).message);
        setUploading(false);
        return;
      }
    } else {
      setShowPaymentConfirm(true);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  async function uploadProof(): Promise<string | null> {
    if (!proofFile) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data.url as string;
    } catch (uploadError) {
      setPostError((uploadError as Error).message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function confirmPostPayment() {
    if (!account) return;

    setSaving(true);
    setPostError("");

    try {
      await apiRequest<{ payment: PaymentDto }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          installmentAccountId: account.id,
          ...form,
          proofUrl: form.proofUrl || undefined,
        }),
      });

      setPostSuccess(account.customerEmail
        ? `Payment posted successfully. Receipt emailed to ${account.customerEmail}.`
        : "Payment posted successfully.");
      setFieldErrors({});
      setForm({
        totalAmount: "",
        paymentDate: todayDateOnly(),
        method: "CASH",
        paymentType: "REGULAR",
        notes: "",
        cashier: "",
        proofUrl: "",
      });

      setShowPaymentConfirm(false);

      setTimeout(() => {
        setShowModal(false);
        setPostSuccess("");
        loadData();
      }, 800);
    } catch (requestError) {
      setPostError((requestError as Error).message);
      setShowPaymentConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  function updatePaymentField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function openModal() {
    setPostError("");
    setPostSuccess("");
    setForm((prev) => ({ ...prev, paymentDate: todayDateOnly() }));
    setProofFile(null);
    setProofPreview(null);
    setShowModal(true);
  }

  function openPenaltyModal(periodId: string) {
    const period = schedule.find((s) => s.id === periodId);
    if (!period) return;

    const due = new Date(period.dueDate + "T00:00:00+08:00");
    const today = new Date(todayDateOnly() + "T00:00:00+08:00");
    const diffDays = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    const accrued = diffDays * Number(penaltyPerDay);

    setPenaltyPeriodId(periodId);
    setPenaltyAmount(accrued > 0 ? String(accrued) : penaltyPerDay);
    setShowPenaltyModal(true);
  }

  function openEditModal() {
    if (!account) return;
    setEditError("");
    setEditDueError("");
    const current = account.dueDays?.length ? [...account.dueDays].sort((a, b) => a - b) : [15, 30];
    setEditDueDay1(String(current[0]));
    setEditDueDay2(current.length > 1 ? String(current[1]) : "");
    setEditForm({
      customerName: account.customerName,
      customerPhone: account.customerPhone,
      customerEmail: account.customerEmail ?? "",
      customerAddress: account.customerAddress,
      fbLink: account.fbLink ?? "",
      brand: account.brand,
      model: account.model,
      unitDescription: account.unitDescription,
      itemType: (account.itemType as "GADGET" | "CASH") ?? "GADGET",
      cashPrice: account.cashPrice,
      downPayment: account.downPayment,
      processingFee: account.processingFee ?? "",
      interestRate: account.interestRate ?? "",
      term: account.term,
      scheduleType: (account.scheduleType as "SEMI_MONTHLY" | "MONTHLY") ?? "SEMI_MONTHLY",
      firstDueDate: account.firstDueDate ?? "",
      dateGiven: account.dateGiven ?? "",
      editPassword: "",
    });
    setEditCustomFields(
      account.customFields
        ? Object.entries(account.customFields).map(([key, value]) => ({ key, value }))
        : [],
    );
    setShowEditModal(true);
  }

  async function confirmEdit() {
    if (!account) return;
    const d1 = parseInt(editDueDay1);
    const d2 = editDueDay2 ? parseInt(editDueDay2) : null;
    if (isNaN(d1) || d1 < 1 || d1 > 31) {
      setEditDueError("Due Day 1 must be between 1 and 31");
      return;
    }
    if (editForm.scheduleType === "SEMI_MONTHLY") {
      if (d2 === null || isNaN(d2) || d2 < 1 || d2 > 31) {
        setEditDueError("Due Day 2 is required for semi-monthly and must be between 1 and 31");
        return;
      }
      if (d2 <= d1) {
        setEditDueError("Due Day 2 must be after Due Day 1");
        return;
      }
    }
    const dueDays = d2 !== null && !isNaN(d2) ? [d1, d2] : [d1];
    setEditSaving(true);
    setEditError("");
    setEditDueError("");
    try {
      const isFullUpdate = editForm.editPassword.trim().length > 0;
      const body: Record<string, unknown> = {
        ...editForm,
        itemType: editForm.itemType,
        processingFee: editForm.processingFee || undefined,
        password: editForm.editPassword || undefined,
        customFields: editCustomFields.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {} as Record<string, string>),
      };
      if (isFullUpdate) {
        body.dueDays = dueDays;
      }

      const data = await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        `/api/installment-accounts/${account.id}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      setAccount(data.installmentAccount);
      setShowEditModal(false);
    } catch (requestError) {
      setEditError((requestError as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmApplyPenalty() {
    if (!penaltyPeriodId || !account) return;
    setApplyingPenalty(true);
    try {
      await apiRequest(`/api/installment-accounts/${account.id}/apply-penalty`, {
        method: "POST",
        body: JSON.stringify({
          periodId: penaltyPeriodId,
          appliedAmount: penaltyAmount,
        }),
      });
      setShowPenaltyModal(false);
      setPenaltyPeriodId(null);
      loadData();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setApplyingPenalty(false);
    }
  }

  async function handleActivate() {
    if (!account) return;
    setActivating(true);
    try {
      await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        `/api/installment-accounts/${account.id}/activate`,
        { method: "PATCH" },
      );
      setDeviceEmail("");
      setDeviceEmailPassword("");
      setDeviceAccountHolderEmail("");
      setIsEditingDeviceSecurity(false);
      setShowDeviceSecurity(true);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setActivating(false);
    }
  }

  function handleEditDeviceSecurity() {
    if (!account) return;
    setDeviceEmail(account.deviceEmail || "");
    setDeviceEmailPassword(account.deviceEmailPassword || "");
    setDeviceAccountHolderEmail(account.deviceAccountHolderEmail || "");
    setIsEditingDeviceSecurity(true);
    setShowDeviceSecurity(true);
  }

  async function saveDeviceSecurity() {
    if (!account) return;
    setSavingDeviceSecurity(true);
    try {
      await apiRequest(`/api/installment-accounts/${account.id}/device-security`, {
        method: "PATCH",
        body: JSON.stringify({ deviceEmail, deviceEmailPassword, deviceAccountHolderEmail }),
      });
      setShowDeviceSecurity(false);
      loadData();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSavingDeviceSecurity(false);
    }
  }

  async function handleCloseAccount() {
    if (!account) return;
    setClosing(true);
    setCloseError("");
    try {
      await apiRequest(`/api/installment-accounts/${account.id}/close`, {
        method: "PATCH",
        body: JSON.stringify({ remarks: closeRemarks, password: closePassword }),
      });
      setShowCloseModal(false);
      loadData();
    } catch (requestError) {
      setCloseError((requestError as Error).message);
    } finally {
      setClosing(false);
    }
  }

  const router = useRouter();

  async function handleDeleteAccount() {
    if (!account || deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      await apiRequest(`/api/installment-accounts/${account.id}`, {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      router.push("/installment-accounts");
    } catch (requestError) {
      setError((requestError as Error).message);
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleVoidPayment() {
    if (!voidPaymentId || voidConfirm !== "VOID") return;
    setVoiding(true);
    try {
      await apiRequest(`/api/payments/${voidPaymentId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: voidReason }),
      });
      setShowVoidModal(false);
      setVoidPaymentId(null);
      setVoidConfirm("");
      loadData();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setVoiding(false);
    }
  }

  function openAdjustDueDates() {
    if (schedule.length > 0 && account) {
      const firstDueDay = parseInt(schedule[0].dueDate.slice(8, 10), 10);
      setAdjustDueDay1(String(firstDueDay));
      let secondDueDay = "";
      if (account.scheduleType === "SEMI_MONTHLY" && schedule.length > 1) {
        secondDueDay = String(parseInt(schedule[1].dueDate.slice(8, 10), 10));
      }
      setAdjustDueDay2(secondDueDay);
      setAdjustDueError("");
      setShowAdjustDueModal(true);
    }
  }

  async function confirmAdjustDueDates() {
    if (!account) return;
    setAdjustDueError("");
    const d1 = parseInt(adjustDueDay1);
    const d2 = adjustDueDay2 ? parseInt(adjustDueDay2) : null;
    if (isNaN(d1) || d1 < 1 || d1 > 31) {
      setAdjustDueError("Due Date 1 must be between 1 and 31");
      return;
    }
    if (account.scheduleType === "SEMI_MONTHLY") {
      if (d2 === null || isNaN(d2) || d2 < 1 || d2 > 31) {
        setAdjustDueError("Due Date 2 is required for semi-monthly and must be between 1 and 31");
        return;
      }
    }
    const dueDays = d2 !== null && !isNaN(d2) ? [d1, d2] : [d1];
    setSavingAdjustDue(true);
    try {
      await apiRequest(`/api/installment-accounts/${account.id}/adjust-due-dates`, {
        method: "PATCH",
        body: JSON.stringify({ dueDays }),
      });
      setShowAdjustDueModal(false);
      loadData();
    } catch (requestError) {
      setAdjustDueError((requestError as Error).message);
    } finally {
      setSavingAdjustDue(false);
    }
  }

  const requirementsList = [
    { key: "validId" as const, label: "Valid Government ID (UMID, PhilHealth, Driver's License, Passport, National ID)" },
    { key: "selfie" as const, label: "Selfie with ID" },
    { key: "proofOfIncome" as const, label: "Proof of Income (Latest 1 month Payslip, COE, or 2 months Bank Statement)" },
    { key: "proofOfAddress" as const, label: "Proof of Address (Electric or Water Bill)" },
    { key: "residencePhoto" as const, label: "Clear photo showing exterior view of residence" },
  ];

  const { allRequirementsMet } = useMemo(() => {
    const unmet = requirementsList.find((r) => !requirements[r.key]);
    return { allRequirementsMet: !unmet };
  }, [requirements]);

  const adjustPreview = useMemo(() => {
    if (!account || !showAdjustDueModal) return [];
    const d1 = parseInt(adjustDueDay1);
    const d2 = adjustDueDay2 ? parseInt(adjustDueDay2) : null;
    if (isNaN(d1) || d1 < 1 || d1 > 31) return [];
    if (account.scheduleType === "SEMI_MONTHLY" && (d2 === null || isNaN(d2) || d2 < 1 || d2 > 31)) return [];

    const dueDays = d2 !== null && !isNaN(d2) ? [d1, d2] : [d1];
    if (schedule.length === 0) return [];

    const startDate = new Date(schedule[0].dueDate + "T00:00:00.000+08:00");
    const sorted = [...dueDays].sort((a, b) => a - b);
    const perMonth = sorted.length;
    const preview: { periodNumber: number; oldDate: string; newDate: string }[] = [];
    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    const startDay = parseInt(dateToManilaDateOnly(startDate).slice(8, 10), 10);
    const startIdx = (() => {
      const exact = sorted.indexOf(startDay);
      if (exact >= 0) return exact;
      let best = 0, bestDist = Math.abs(sorted[0] - startDay);
      for (let i = 1; i < sorted.length; i++) {
        const dist = Math.abs(sorted[i] - startDay);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      return best;
    })();

    for (let i = 0; i < schedule.length; i++) {
      const adjustedI = startIdx + i;
      const dayIndex = adjustedI % perMonth;
      const monthOffset = Math.floor(adjustedI / perMonth);
      const targetDay = sorted[dayIndex];
      let targetMonth = startMonth + monthOffset;
      let targetYear = startYear;
      while (targetMonth > 11) {
        targetMonth -= 12;
        targetYear++;
      }
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const safeDay = Math.min(targetDay, lastDay);
      const yy = String(targetYear);
      const mm = String(targetMonth + 1).padStart(2, "0");
      const dd = String(safeDay).padStart(2, "0");
      preview.push({
        periodNumber: schedule[i].periodNumber,
        oldDate: schedule[i].dueDate,
        newDate: `${yy}-${mm}-${dd}`,
      });
    }
    return preview;
  }, [account, showAdjustDueModal, adjustDueDay1, adjustDueDay2, schedule]);

  if (loading) return <LoadingBlock label="Loading account" />;
  if (!account) return <ErrorMessage message={error || "Account not found"} />;

  const totalPaymentsAmount = payments.reduce((s, p) => s.plus(new Decimal(p.totalAmount)), new Decimal(0));
  const totalPenaltiesAmount = penalties.reduce((s, p) => s.plus(new Decimal(p.amount)), new Decimal(0));

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const daysOverdue = account.nextDueDate && today > account.nextDueDate
    ? Math.floor(
        (new Date(today).getTime() - new Date(account.nextDueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${account.brand} ${account.model}`}
        description={account.unitDescription}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/installment-accounts/${account.id}/statement`}
              className="inline-flex h-8 sm:h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <FileText size={16} aria-hidden="true" />
              <span className="inline">Statement</span>
            </Link>
            <Link
              href={`/installment-accounts/${account.id}/down-payment-receipt`}
              className="inline-flex h-8 sm:h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <Printer size={16} aria-hidden="true" />
              <span className="hidden sm:inline">DP Receipt</span>
            </Link>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex h-8 sm:h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <Pencil size={16} aria-hidden="true" />
              <span className="inline">Edit</span>
            </button>
            {account.status !== "APPLIED" && account.status !== "CLOSED" ? (
              <button
                type="button"
                onClick={openModal}
                className="inline-flex h-8 sm:h-10 items-center gap-1.5 rounded-lg bg-red-800 px-2.5 sm:px-4 text-xs sm:text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
              >
                <ReceiptText size={16} aria-hidden="true" />
                <span className="inline">Post Payment</span>
              </button>
            ) : null}
            {account.status !== "APPLIED" && account.status !== "CLOSED" ? (
              <button
                type="button"
                onClick={() => { setCloseRemarks(""); setClosePassword(""); setCloseError(""); setShowCloseModal(true); }}
                className="inline-flex h-8 sm:h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                <Ban size={16} aria-hidden="true" />
                <span className="inline">Close</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => { setDeletePassword(""); setDeleteConfirm(""); setShowDeleteModal(true); }}
              className="inline-flex h-8 sm:h-10 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-[0.98]"
            >
              <Trash2 size={16} aria-hidden="true" />
              <span className="inline">Delete</span>
            </button>
          </div>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={User} label="Customer" value={
          <div>
            <div className="font-medium">{account.customerName}</div>
            <div className="text-xs text-slate-500 mt-0.5">{account.customerPhone}</div>
            {account.customerEmail ? <div className="text-xs text-slate-400 mt-0.5">{account.customerEmail}</div> : null}
            {account.fbLink ? (
              <a href={account.fbLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook Profile
              </a>
            ) : null}
          </div>
        } />
        <InfoCard icon={MapPin} label="Address" value={account.customerAddress} />
        <InfoCard icon={Smartphone} label={account.itemType === "CASH" ? "Type" : "Device"} value={
          account.itemType === "CASH"
            ? <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">Cash</span>
            : `${account.brand} ${account.model}`
        } />
        <InfoCard icon={Hash} label="Term" value={account.scheduleType === "SEMI_MONTHLY" ? `${account.term} months (${account.term * 2} periods)` : `${account.term} months`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={<StatusBadge status={account.status as AccountStatusValue} />} />
        <StatCard label="Next Due Date" value={account.nextDueDate} />
        <StatCard label="Days Overdue" value={String(daysOverdue)} valueClass={daysOverdue > 0 ? "text-rose-600" : "text-slate-900"} />
        <StatCard label="Date Given" value={account.dateGiven ?? "—"} />
        <StatCard label="First Due Date" value={account.firstDueDate ?? "—"} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-2">Pricing</div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
          {account.interestRate
            ? `${account.interestRate}%${account.itemType === "CASH" ? " one-time" : " /mo"}`
            : "Interest"}
        </div>
      </div>

      {account.deviceEmail ? (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold font-heading uppercase tracking-wider text-blue-600">Device Security</p>
            <button
              type="button"
              onClick={handleEditDeviceSecurity}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-600 shadow-sm transition-all hover:bg-blue-50 active:scale-[0.95]"
            >
              <Pencil size={13} />
            </button>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-slate-600">📱 <span className="font-medium">{account.deviceEmail}</span></span>
            <span className="text-slate-600">🔑 <span className="font-medium">{account.deviceEmailPassword}</span></span>
            <span className="text-slate-600">👤 <span className="font-medium">{account.deviceAccountHolderEmail}</span></span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Cash Price" value={formatPeso(account.cashPrice)} />
        <StatCard label="Net Price" value={formatPeso((parseFloat(account.installmentPrice) - parseFloat(account.downPayment)).toFixed(2))} valueClass="text-red-800" />
        <StatCard label="Down Payment" value={formatPeso(account.downPayment)} />
        <StatCard label="Processing Fee" value={formatPeso(account.processingFee)} />
        <StatCard label="Remaining Balance" value={formatPeso(account.remainingBalance)} valueClass="text-emerald-700" />
        <StatCard label={account.scheduleType === "SEMI_MONTHLY" ? "Per Period" : "Monthly"} value={formatPeso(account.monthlyInstallment)} />
        <StatCard label="Gross Profit" value={formatPeso(account.grossProfit)} valueClass="text-emerald-700" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total Payments" value={formatPeso(totalPaymentsAmount.toFixed(2))} valueClass="text-emerald-700" />
        <StatCard label="Total Penalties" value={formatPeso(totalPenaltiesAmount.toFixed(2))} valueClass="text-rose-700" />
      </div>

      {account.customFields && Object.keys(account.customFields).length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Custom Fields</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(account.customFields).map(([key, value]) => (
              <div key={key} className="flex gap-2 items-baseline">
                <span className="text-xs font-medium text-slate-500 min-w-24">{key}:</span>
                <span className="text-sm text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {account.status === "APPLIED" ? (
        <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <UserCheck size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Requirements Checklist</h2>
              <p className="text-xs text-slate-500">Tick all requirements to activate this account</p>
            </div>
          </div>
          <div className="space-y-3">
            {requirementsList.map((req) => (
              <label
                key={req.key}
                className={`flex items-start gap-3 rounded-lg border p-3.5 transition-all cursor-pointer ${
                  requirements[req.key]
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-red-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={requirements[req.key]}
                  onChange={(e) =>
                    setRequirements((prev) => ({ ...prev, [req.key]: e.target.checked }))
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-red-700 focus:ring-red-500"
                />
                <span className={`text-sm ${requirements[req.key] ? "text-slate-700 line-through decoration-emerald-500" : "text-slate-700"}`}>
                  {req.label}
                </span>
              </label>
            ))}
          </div>
          {allRequirementsMet ? (
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300"
            >
              <Check size={16} aria-hidden="true" />
              {activating ? "Activating..." : "Activate Account"}
            </button>
          ) : (
            <p className="mt-4 text-xs text-slate-500 text-center">
              Complete all requirements above to activate
            </p>
          )}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
        >
          <h2 className="text-sm font-semibold font-heading text-slate-900">Installment Schedule ({schedule.length} periods)</h2>
          {showSchedule ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        {showSchedule ? (
          <div className="px-5 pb-3">
            <button
              type="button"
              onClick={openAdjustDueDates}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              Adjust Due Dates
            </button>
          </div>
        ) : null}
        {showSchedule ? (
          <div className="divide-y divide-slate-100">
            {schedule.map((period, sIdx) => (
              <div
                key={period.id}
                className={`px-5 py-3.5 transition-colors ${
                  period.status === "PAID" ? scheduleStatusStyles.PAID :
                  period.status === "OVERDUE" || (period.status === "PENDING" && period.dueDate < todayDateOnly()) ? scheduleStatusStyles.OVERDUE :
                  period.status === "PARTIAL" ? scheduleStatusStyles.PARTIAL :
                  scheduleStatusStyles.PENDING
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      period.status === "PAID" ? "bg-emerald-200 text-emerald-800" :
                      period.status === "OVERDUE" || (period.status === "PENDING" && period.dueDate < todayDateOnly()) ? "bg-rose-200 text-rose-800" :
                      period.status === "PARTIAL" ? "bg-amber-200 text-amber-800" :
                      "bg-slate-200 text-slate-700"
                    }`}>
                      {period.periodNumber}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{formatPeso(period.amount)}</div>
                      <div className="text-xs text-slate-500">Due: {period.dueDate}</div>
                      {(() => {
                        const paid = parseFloat(period.paidAmount || "0");
                        const principal = parseFloat(period.amount);
                        const penalty = parseFloat(period.penaltyAmount);
                        const remainingPrincipal = Math.max(0, principal - paid);
                        const totalRemaining = remainingPrincipal + penalty;
                        const isFullyPaid = period.status === "PAID";

                        // Detect carryover: same payment covered consecutive periods
                        const prevPeriod = sIdx > 0 ? schedule[sIdx - 1] : null;
                        const isCarryover = !!(prevPeriod && period.paymentId && prevPeriod.paymentId && prevPeriod.paymentId === period.paymentId);

                        return isFullyPaid ? (
                          <div className="text-xs text-emerald-600 mt-0.5">
                            Paid: {formatPeso(period.paidAmount || "0")}
                            {isCarryover ? <span className="text-emerald-500"> (carryover)</span> : null}
                          </div>
                        ) : (
                          <>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {paid > 0 ? (
                                <>
                                  Paid: {formatPeso(period.paidAmount!)}
                                  {isCarryover ? <span className="text-slate-400"> (carryover)</span> : null}
                                  &middot;{" "}
                                </>
                              ) : null}
                              Total Due: {formatPeso(totalRemaining.toFixed(2))}
                              {penalty > 0 ? (
                                <span className="text-rose-500"> (₱{remainingPrincipal.toFixed(2)} + ₱{penalty.toFixed(2)})</span>
                              ) : null}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={period.status as ScheduleStatusValue} />
                    {(() => {
                      const totalApplied = penaltyAppliedByPeriod.get(period.id) || 0;
                      const remainingPen = parseFloat(period.penaltyAmount);
                      const paidPen = Math.max(0, totalApplied - remainingPen);
                      const isOverdue = period.status === "OVERDUE" || period.status === "PARTIAL" || (period.status === "PENDING" && period.dueDate < todayDateOnly());
                      const noPenaltyHistory = totalApplied === 0 && remainingPen === 0;

                      return (
                        <>
                          {remainingPen > 0 ? (
                            <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                              Pen: {formatPeso(period.penaltyAmount)}
                            </span>
                          ) : null}

                          {paidPen > 0 ? (
                            <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${
                              remainingPen === 0
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}>
                              Penalty Paid: {formatPeso(paidPen.toFixed(2))}
                            </span>
                          ) : null}

                          {noPenaltyHistory && isOverdue ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-rose-600 font-medium">
                                {(() => {
                                  const due = new Date(period.dueDate + "T00:00:00+08:00");
                                  const today = new Date(todayDateOnly() + "T00:00:00+08:00");
                                  const diffDays = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
                                  const accrued = diffDays * Number(penaltyPerDay);
                                  return `Accrued: ₱${accrued.toFixed(2)} (${diffDays}d)`;
                                })()}
                              </span>
                              <button
                                type="button"
                                onClick={() => openPenaltyModal(period.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-all hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98]"
                              >
                                <AlertTriangle size={12} />
                                Apply Penalty
                              </button>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold font-heading text-slate-900">Payment History</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <div key={payment.id} className="px-5 py-3.5 transition-colors hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{formatPeso(payment.totalAmount)}</span>
                    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {payment.paymentType}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{payment.paymentDate}</span>
                    <span>{payment.method}</span>
                    {payment.cashier ? <span>Cashier: {payment.cashier}</span> : null}
                  </div>
                  {payment.penaltyAmount !== "0.00" ? (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      <span className="font-medium text-rose-600">Penalty: {formatPeso(payment.penaltyAmount)}</span>
                    </div>
                  ) : null}
                  {payment.notes ? (
                    <div className="mt-1 text-xs text-slate-400 italic">{payment.notes}</div>
                  ) : null}
                  {payment.proofUrl ? (
                    <a href={payment.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block max-w-[120px] rounded-lg border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity">
                      <img src={payment.proofUrl} alt="Payment proof" className="w-full h-16 object-cover" />
                    </a>
                  ) : null}
                </div>
                <Link
                  href={`/payments/${payment.id}/receipt`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
                >
                  <Printer size={14} />
                  Print
                </Link>
                {!payment.voided && account.status !== "CLOSED" && payment.id === latestNonVoidedPaymentId ? (
                  <button
                    type="button"
                    onClick={() => { setVoidPaymentId(payment.id); setVoidReason(""); setShowVoidModal(true); }}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-[0.98]"
                  >
                    <Ban size={14} />
                    Void
                  </button>
                ) : payment.voided ? (
                  <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">VOIDED</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No payments yet.</div>
        ) : null}
      </section>

      {penalties.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold font-heading text-rose-700">Penalty History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {penalties.map((penalty) => (
              <div key={penalty.id} className="px-5 py-3 text-sm transition-colors hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">{formatPeso(penalty.amount)}</span>
                  <div className="flex items-center gap-2">
                    {account?.status !== "FULLY_PAID" ? (
                      <button
                        type="button"
                        onClick={() => setUndoPenaltyId(penalty.id)}
                        className="inline-flex h-6 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] font-medium text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.98]"
                      >
                        Undo
                      </button>
                    ) : null}
                    <span className="text-xs text-slate-500">{new Date(penalty.appliedDate).toLocaleDateString()}</span>
                  </div>
                </div>
                {penalty.reason ? <div className="mt-0.5 text-xs text-slate-400">{penalty.reason}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ConfirmModal
        open={undoPenaltyId !== null}
        title="Undo Penalty?"
        message="This will remove the penalty amount and recalculate the remaining balance. This action cannot be reversed."
        confirmLabel={undoingPenalty ? "Undoing..." : "Yes, undo penalty"}
        onConfirm={async () => {
          if (!undoPenaltyId) return;
          setUndoingPenalty(true);
          try {
            await apiRequest(`/api/penalty-records/${undoPenaltyId}`, { method: "DELETE" });
            setUndoPenaltyId(null);
            loadData();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setUndoingPenalty(false);
          }
        }}
        onCancel={() => setUndoPenaltyId(null)}
        loading={undoingPenalty}
      />

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handlePostPayment} className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Post Payment</h2>
                <p className="mt-0.5 text-sm text-slate-500">{account.brand} {account.model} — {account.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
              {postError ? <ErrorMessage message={postError} /> : null}
              {postSuccess ? <SuccessMessage message={postSuccess} /> : null}

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Amount Paid
                  <input
                    required
                    inputMode="decimal"
                    value={form.totalAmount}
                    onChange={(e) => updatePaymentField("totalAmount", e.target.value.replace(/[^\d.]/g, ""))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                <FieldError error={fieldErrors.totalAmount} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Payment Date
                    <input
                      required
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => updatePaymentField("paymentDate", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                  <FieldError error={fieldErrors.paymentDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Type
                  </label>
                  {(() => {
                    const amt = parseFloat(form.totalAmount) || 0;
                    const remaining = parseFloat(account.remainingBalance);
                    const monthly = parseFloat(account.monthlyInstallment);
                    let type = "REGULAR";
                    let color = "border-blue-200 bg-blue-50 text-blue-700";
                    if (amt >= remaining) { type = "FULL"; color = "border-emerald-200 bg-emerald-50 text-emerald-700"; }
                    else if (amt < monthly) { type = "PARTIAL"; color = "border-amber-200 bg-amber-50 text-amber-700"; }
                    else { type = "REGULAR"; color = "border-blue-200 bg-blue-50 text-blue-700"; }
                    return (
                      <span className={`mt-1.5 inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold ${color}`}>
                        {type === "FULL" ? "FULL — Pays entire balance" : type === "PARTIAL" ? "PARTIAL — Less than monthly" : "REGULAR"}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Method
                    <select
                      value={form.method}
                      onChange={(e) => updatePaymentField("method", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="BANK">Bank</option>
                    </select>
                  </label>
                  <FieldError error={fieldErrors.method} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Cashier
                    <input
                      value={form.cashier}
                      onChange={(e) => updatePaymentField("cashier", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) => updatePaymentField("notes", e.target.value)}
                    className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Payment Proof (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="mt-1.5 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  />
                </label>
                {proofPreview ? (
                  <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden relative">
                    <img src={proofPreview} alt="Payment proof preview" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setProofFile(null); setProofPreview(null); }}
                      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
              >
                <Save size={16} aria-hidden="true" />
                Post Payment
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Edit Account</h2>
                <p className="mt-0.5 text-sm text-slate-500">{account.brand} {account.model} — {account.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
              {editError ? <ErrorMessage message={editError} /> : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Customer Name
                    <input
                      value={editForm.customerName}
                      onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Contact
                    <input
                      value={editForm.customerPhone}
                      onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value.replace(/\D/g, "") }))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    value={editForm.customerEmail}
                    onChange={(e) => setEditForm((p) => ({ ...p, customerEmail: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Address
                  <textarea
                    value={editForm.customerAddress}
                    onChange={(e) => setEditForm((p) => ({ ...p, customerAddress: e.target.value }))}
                    className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Facebook Profile Link <span className="text-slate-400">(optional)</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="flex items-center justify-center size-10 rounded-xl border border-slate-300 bg-slate-50 text-blue-600 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </span>
                    <input
                      type="url"
                      value={editForm.fbLink}
                      onChange={(e) => setEditForm((p) => ({ ...p, fbLink: e.target.value }))}
                      placeholder="https://facebook.com/username"
                      className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">{editForm.itemType === "CASH" ? "Cash Info" : "Device Info"}</p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Item Type</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, itemType: "GADGET" }))}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        editForm.itemType === "GADGET"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      📱 Gadget
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, itemType: "CASH" }))}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        editForm.itemType === "CASH"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      💰 Cash
                    </button>
                  </div>
                </div>

                {editForm.itemType === "GADGET" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Brand
                        <input
                          value={editForm.brand}
                          onChange={(e) => setEditForm((p) => ({ ...p, brand: e.target.value }))}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Model
                        <input
                          value={editForm.model}
                          onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
                <div className={editForm.itemType === "GADGET" ? "mt-4" : ""}>
                  <label className="block text-sm font-medium text-slate-700">
                    {editForm.itemType === "CASH" ? "Description" : "Unit Description"}
                    <textarea
                      value={editForm.unitDescription}
                      onChange={(e) => setEditForm((p) => ({ ...p, unitDescription: e.target.value }))}
                      className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Financial</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Processing Fee
                    <input
                      inputMode="decimal"
                      value={editForm.processingFee}
                      onChange={(e) => setEditForm((p) => ({ ...p, processingFee: e.target.value.replace(/[^\d.]/g, "") }))}
                      placeholder="0.00"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Custom Fields</p>
                <div className="space-y-2">
                  {editCustomFields.map((field, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 items-start">
                      <input
                        placeholder="Field name"
                        value={field.key}
                        onChange={(e) => {
                          const updated = [...editCustomFields];
                          updated[i] = { ...updated[i], key: e.target.value };
                          setEditCustomFields(updated);
                        }}
                        className="h-10 w-full sm:flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      />
                      <div className="flex gap-2 w-full sm:flex-[2]">
                        <input
                          placeholder="Value"
                          value={field.value}
                          onChange={(e) => {
                            const updated = [...editCustomFields];
                            updated[i] = { ...updated[i], value: e.target.value };
                            setEditCustomFields(updated);
                          }}
                          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                        <button
                          type="button"
                          onClick={() => setEditCustomFields(editCustomFields.filter((_, j) => j !== i))}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 transition-all"
                        >
                          <X size={16} />
                      </button>
                    </div>
                  </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditCustomFields([...editCustomFields, { key: "", value: "" }])}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-all"
                  >
                  + Add Field
                </button>
              </div>
            </div>

            <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50/30 mt-4">
              <p className="text-xs font-semibold font-heading uppercase tracking-wider text-red-700 mb-2">⚠️ Contract Terms</p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-4 text-[11px] text-amber-800">
                Changing contract terms recalculates the installment price and regenerates unpaid schedule periods. Paid periods are preserved.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-medium text-slate-600">Cash Price</label><input inputMode="decimal" value={editForm.cashPrice} onChange={(e) => setEditForm((p) => ({ ...p, cashPrice: e.target.value.replace(/[^\d.]/g, "") }))} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                <div><label className="block text-[11px] font-medium text-slate-600">Down Payment</label><input inputMode="decimal" value={editForm.downPayment} onChange={(e) => setEditForm((p) => ({ ...p, downPayment: e.target.value.replace(/[^\d.]/g, "") }))} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                <div><label className="block text-[11px] font-medium text-slate-600">Interest Rate (%/mo)</label><input inputMode="decimal" value={editForm.interestRate} onChange={(e) => setEditForm((p) => ({ ...p, interestRate: e.target.value.replace(/[^\d.]/g, "") }))} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                <div><label className="block text-[11px] font-medium text-slate-600">Term (months)</label><input type="number" value={editForm.term} onChange={(e) => setEditForm((p) => ({ ...p, term: Number(e.target.value) }))} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                <div><label className="block text-[11px] font-medium text-slate-600">Schedule</label><select value={editForm.scheduleType} onChange={(e) => setEditForm((p) => ({ ...p, scheduleType: e.target.value as any }))} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"><option value="MONTHLY">Monthly</option><option value="SEMI_MONTHLY">Semi-Monthly</option></select></div>
                <div><label className="block text-[11px] font-medium text-slate-600">First Due Date</label><input type="date" value={editForm.firstDueDate} onChange={(e) => setEditForm((p) => ({ ...p, firstDueDate: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                <div><label className="block text-[11px] font-medium text-slate-600">Due Day 1</label><input type="number" min={1} max={31} value={editDueDay1} onChange={(e) => { setEditDueDay1(e.target.value); setEditDueError(""); }} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                {editForm.scheduleType === "SEMI_MONTHLY" ? (
                  <div><label className="block text-[11px] font-medium text-slate-600">Due Day 2</label><input type="number" min={1} max={31} value={editDueDay2} onChange={(e) => { setEditDueDay2(e.target.value); setEditDueError(""); }} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
                ) : null}
              </div>
              {editDueError ? <p className="mt-2 text-xs font-medium text-rose-600">{editDueError}</p> : null}
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-slate-700">
                Admin Password (required to save)
                <input type="password" value={editForm.editPassword} onChange={(e) => setEditForm((p) => ({ ...p, editPassword: e.target.value }))} placeholder="Enter admin password" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" />
              </label>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEdit}
                disabled={editSaving || !editForm.customerName.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={showPaymentConfirm}
        title="Post Payment?"
        message={`${formatPeso(form.totalAmount || "0")} payment for ${account.brand} ${account.model}.`}
        confirmLabel="Yes, post payment"
        onConfirm={confirmPostPayment}
        onCancel={() => setShowPaymentConfirm(false)}
        loading={saving}
      />

      {showPenaltyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold font-heading text-slate-900">Apply Penalty</h2>
              <button
                type="button"
                onClick={() => setShowPenaltyModal(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
              <div className="space-y-4 px-6 py-4">
              {(() => {
                const period = schedule.find((s) => s.id === penaltyPeriodId);
                if (!period) return null;
                const due = new Date(period.dueDate + "T00:00:00+08:00");
                const today = new Date(todayDateOnly() + "T00:00:00+08:00");
                const diffDays = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
                const accrued = diffDays * Number(penaltyPerDay);
                const applied = Number(penaltyAmount) || 0;
                const waived = accrued - applied > 0 ? accrued - applied : 0;

                return (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                      <p className="text-xs text-slate-500">Period #{period.periodNumber} — Due: {period.dueDate}</p>
                      <p className="text-xs text-slate-500">Days Overdue: <span className="font-semibold text-slate-900">{diffDays}</span></p>
                      <p className="text-xs text-slate-500">Rate: ₱{penaltyPerDay}/day</p>
                      <p className="text-sm font-bold text-rose-700">Accrued: ₱{accrued.toLocaleString()}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Apply Amount (₱)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={penaltyAmount}
                          onChange={(e) => setPenaltyAmount(e.target.value)}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                      </label>
                      {waived > 0 ? (
                        <p className="mt-1 text-xs text-amber-600">Waived: ₱{waived.toFixed(2)}</p>
                      ) : null}
                    </div>
                  </>
                );
              })()}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPenaltyModal(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmApplyPenalty}
                  disabled={applyingPenalty || !penaltyAmount || Number(penaltyAmount) <= 0}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-rose-600 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300"
                >
                  {applyingPenalty ? "Applying..." : "Apply Penalty"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCloseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <Ban size={24} />
                </span>
                <h3 className="mt-4 text-base font-bold font-heading text-slate-900">Close Account</h3>
                <p className="mt-1.5 text-sm text-slate-500">
                  {account.brand} {account.model} — {account.customerName}
                </p>
                {account.remainingBalance !== "0.00" ? (
                  <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800">
                    ⚠️ Outstanding balance of <strong>{formatPeso(account.remainingBalance)}</strong> will be written off. This action requires admin password.
                  </p>
                ) : null}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  Remarks
                  <textarea
                    required
                    value={closeRemarks}
                    onChange={(e) => setCloseRemarks(e.target.value)}
                    placeholder="Why is this account being closed?"
                    className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">
                  Admin Password
                  <input
                    type="password"
                    required
                    value={closePassword}
                    onChange={(e) => setClosePassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              {closeError ? <p className="mt-2 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{closeError}</p> : null}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={closing || !closeRemarks.trim() || !closePassword.trim()}
                  onClick={handleCloseAccount}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-rose-500 active:scale-[0.98] disabled:bg-slate-300"
                >
                  {closing ? "Closing..." : "Close Account"}
                </button>
                <button
                  type="button"
                  disabled={closing}
                  onClick={() => setShowCloseModal(false)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <Trash2 size={24} />
                </span>
                <h3 className="mt-4 text-base font-bold font-heading text-slate-900">Delete Account</h3>
                <p className="mt-1.5 text-sm text-slate-500">
                  {account.brand} {account.model} — {account.customerName}
                </p>
                <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-800">
                  All records (payments, penalties, schedule, activity log) will be <strong>permanently deleted</strong>. This cannot be undone.
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  Admin Password
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">
                  Type DELETE to confirm
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold tracking-wider outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={deleting || !deletePassword.trim() || deleteConfirm !== "DELETE"}
                  onClick={handleDeleteAccount}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-rose-500 active:scale-[0.98] disabled:bg-slate-300"
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDeviceSecurity ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex-shrink-0 p-6 pb-0">
              <div className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Lock size={24} />
                </span>
                <h3 className="mt-4 text-base font-bold font-heading text-slate-900">{isEditingDeviceSecurity ? "Edit Device Security" : "Device Security Setup"}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{isEditingDeviceSecurity ? "Update the device email credentials" : "Install this email on the device for security tracking"}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Device Email *
                  <input
                    type="email"
                    required
                    value={deviceEmail}
                    onChange={(e) => setDeviceEmail(e.target.value)}
                    placeholder="gadgets.myfave.10@gmail.com"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password *
                  <input
                    type="text"
                    required
                    value={deviceEmailPassword}
                    onChange={(e) => setDeviceEmailPassword(e.target.value)}
                    placeholder="Password of this email"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Account Holder Email *
                  <input
                    type="email"
                    required
                    value={deviceAccountHolderEmail}
                    onChange={(e) => setDeviceAccountHolderEmail(e.target.value)}
                    placeholder="myfave.gadgets.02@gmail.com"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col gap-2 px-6 pb-6">
              <button
                type="button"
                disabled={savingDeviceSecurity || !deviceEmail || !deviceEmailPassword || !deviceAccountHolderEmail}
                onClick={saveDeviceSecurity}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:bg-slate-300"
              >
                {savingDeviceSecurity ? "Saving..." : isEditingDeviceSecurity ? "Save Changes" : "Save & Continue"}
              </button>
              <button
                type="button"
                disabled={savingDeviceSecurity}
                onClick={() => { setShowDeviceSecurity(false); loadData(); }}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAdjustDueModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="overflow-y-auto p-6">
              <div className="text-center">
                <h3 className="text-base font-bold font-heading text-slate-900">Adjust Due Dates</h3>
                <p className="mt-1 text-sm text-slate-500">Set new due day numbers for all remaining unpaid periods. Paid periods stay unchanged.</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Due Date 1
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={adjustDueDay1}
                    onChange={(e) => { setAdjustDueDay1(e.target.value); setAdjustDueError(""); }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                {account?.scheduleType === "SEMI_MONTHLY" ? (
                  <label className="block text-sm font-medium text-slate-700">
                    Due Date 2
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={adjustDueDay2}
                      onChange={(e) => { setAdjustDueDay2(e.target.value); setAdjustDueError(""); }}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                ) : null}
              </div>
              {adjustDueError ? (
                <p className="mt-2 text-xs font-medium text-rose-600">{adjustDueError}</p>
              ) : null}

              {adjustPreview.length > 0 ? (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Preview</p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {adjustPreview.map((p) => (
                      <div key={p.periodNumber} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Period {p.periodNumber}</span>
                        <span className="text-slate-400 line-through">{p.oldDate}</span>
                        <span className="text-red-700 font-medium">{p.newDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={savingAdjustDue || !adjustDueDay1 || !!adjustDueError}
                  onClick={confirmAdjustDueDates}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:bg-slate-300"
                >
                  {savingAdjustDue ? "Saving..." : `Apply to ${adjustPreview.length} unpaid periods`}
                </button>
                <button
                  type="button"
                  disabled={savingAdjustDue}
                  onClick={() => setShowAdjustDueModal(false)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showVoidModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold font-heading text-slate-900">Void Payment</h2>
              <button type="button" onClick={() => setShowVoidModal(false)} aria-label="Close" className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm text-rose-800">This will reverse the payment and restore the schedule. This cannot be undone.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Type VOID to confirm
                  <input value={voidConfirm} onChange={(e) => setVoidConfirm(e.target.value)} placeholder="VOID"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold tracking-wider outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Reason
                  <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why is this being voided?"
                    className="mt-1.5 min-h-[60px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setShowVoidModal(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.98]">
                  Cancel
                </button>
                <button type="button" onClick={handleVoidPayment} disabled={voiding || voidConfirm !== "VOID"}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-600 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300">
                  {voiding ? "Voiding..." : "Void Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
