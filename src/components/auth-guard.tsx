"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const authed = document.cookie.includes("auth=1");
    const isLoginPage = pathname === "/login";

    if (!authed && !isLoginPage) {
      router.replace("/login");
    } else if (authed && isLoginPage) {
      router.replace("/dashboard");
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked) return null;

  return <>{children}</>;
}
