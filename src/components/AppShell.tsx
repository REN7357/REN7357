"use client";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (!session || isLoginPage) {
    return <main>{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
