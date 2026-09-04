"use client";

import { Bot, ExternalLink, LayoutDashboard, LogOut, Plug, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import type { User, Workspace } from "@/lib/types";

export const MOBILE_NAV = [
  { section: "Workspace", items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agents", label: "Agents", icon: Bot },
  ]},
  { section: "Manage", items: [
    { href: "/settings", label: "Integrasi & Keys", icon: Plug },
    { href: "/demo", label: "Demo Widget", icon: ExternalLink },
  ]},
];

export default function MobileDrawer({
  open,
  onClose,
  me,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  me: { user: User; workspace: Workspace };
  onLogout: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <div
        onClick={onClose}
        className={cx(
          "fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={cx(
          "glass fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col p-4 transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-700 text-lg font-bold text-white">
            S
          </div>
          <div className="flex-1 text-[17px] font-bold tracking-tight">Sapa AI</div>
          <button onClick={onClose} className="rounded-lg p-2 text-ink-3 hover:bg-white/70">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-line bg-white/70 px-3 py-2.5 text-[13px] font-semibold">
          <Sparkles size={13} className="mr-2 inline text-primary-600" />
          {me.workspace.name}
        </div>
        <nav className="mt-4 flex-1 overflow-y-auto">
          {MOBILE_NAV.map((g) => (
            <div key={g.section} className="mb-4">
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g.section}</div>
              {g.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={cx(
                      "mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold",
                      active ? "bg-primary-soft text-primary-600" : "text-ink-2 hover:bg-white/70"
                    )}
                  >
                    <Icon size={16} /> {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="rounded-2xl border border-line bg-white/70 p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary text-[13px] font-bold text-white">
              {(me.user.name || me.user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{me.user.name || me.user.email}</div>
              <div className="truncate text-[11px] text-ink-3">{me.user.email}</div>
            </div>
            <button onClick={onLogout} className="rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
