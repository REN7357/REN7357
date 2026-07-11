"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/", label: "数据看板", icon: "📊" },
  { href: "/influencers", label: "达人管理", icon: "👥" },
  { href: "/campaigns", label: "Campaign 管理", icon: "🚀" },
  { href: "/templates", label: "邮件模板", icon: "📧" },
  { href: "/outreach", label: "批量触达", icon: "📨" },
  { href: "/review", label: "人工复审", icon: "✅" },
  { href: "/reports", label: "AI 迭代报告", icon: "📈" },
  { href: "/settings", label: "系统设置", icon: "⚙️" },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-700">
        <h1 className="font-bold text-lg">BD 达人系统</h1>
        <p className="text-xs text-slate-400 mt-1">{user.name}</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
