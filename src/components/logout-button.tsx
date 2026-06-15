"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-red-50 hover:text-red-700 active:scale-[0.98]"
      title="Sign out"
    >
      <LogOut size={16} />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}
