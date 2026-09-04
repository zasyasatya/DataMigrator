"use client";

import {
  Bot,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  Plug,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, setToken } from "@/lib/api";
import type { User, Workspace } from "@/lib/types";
import { cx, Kbd } from "@/components/ui";

const NAV = [
  { section: "Workspace", items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agents", label: "Agents", icon: Bot },
  ]},
  { section: "Manage", items: [
    { href: "/settings", label: "Integrasi & Keys", icon: Plug },
    { href: "/demo", label: "Demo Widget", icon: ExternalLink },
  ]},
];

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ user: User; workspace: Workspace } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then(setMe)
      .catch(() => router.replace("/login"))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <Sparkles className="animate-pulse text-primary" size={28} />
      </div>
    );
  }
  if (!me) return null;

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1720px] gap-0 p-0 lg:p-4">
        {/* sidebar ------------------------------------------------------ */}
        <aside className="glass sticky top-0 z-20 hidden h-screen w-[264px] shrink-0 flex-col rounded-none p-4 lg:flex lg:rounded-r-3xl lg:rounded-l-none xl:rounded-3xl xl:h-[calc(100vh-2rem)] xl:sticky xl:top-4">
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-700 text-lg font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,92,246,.7)]">
              S
            </div>
            <div className="flex-1 text-[17px] font-bold tracking-tight">Sapa AI</div>
            <PanelLeft size={17} className="text-ink-3" />
          </div>

          <button className="mt-5 flex w-full items-center gap-2.5 rounded-xl border border-line bg-white/70 px-3 py-2.5 text-left text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(23,15,60,.04)] hover:border-primary/40">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-soft text-primary-600">
              <Sparkles size={13} />
            </span>
            <span className="flex-1 truncate">{me.workspace.name}</span>
            <ChevronDown size={15} className="text-ink-3" />
          </button>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white/60 px-3 py-2 text-ink-3">
            <Search size={14} />
            <span className="flex-1 text-[13px]">Search</span>
            <Kbd>/</Kbd>
          </div>

          <nav className="mt-5 flex-1 overflow-y-auto scroll-thin">
            {NAV.map((group) => (
              <div key={group.section} className="mb-4">
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  {group.section}
                </div>
                {group.items.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={cx(
                        "mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition",
                        active
                          ? "bg-primary-soft text-primary-600 shadow-[inset_0_0_0_1px_rgba(124,92,246,.18)]"
                          : "text-ink-2 hover:bg-white/70 hover:text-ink"
                      )}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mt-3 rounded-2xl border border-line bg-white/70 p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary text-[13px] font-bold text-white">
                {(me.user.name || me.user.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{me.user.name || me.user.email}</div>
                <div className="truncate text-[11px] text-ink-3">{me.user.email}</div>
              </div>
              <button
                title="Log out"
                onClick={() => {
                  setToken(null);
                  api("/auth/logout", { method: "POST" }).finally(() => router.replace("/login"));
                }}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* main ---------------------------------------------------------- */}
        <main className="min-w-0 flex-1 px-4 pb-10 pt-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function TopBar({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-ink-2">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {right}
        <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-ink">
          <i className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_#12B76A]" />
          Semua sistem normal
        </span>
      </div>
    </div>
  );
}

export function MobileNav() {
  return (
    <div className="glass sticky top-0 z-20 mb-4 flex items-center gap-2 rounded-2xl p-2 lg:hidden">
      <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">S</span>
        Sapa AI
      </Link>
      <Link href="/agents" className="rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-2">
        <Bot size={16} />
      </Link>
      <Link href="/settings" className="rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-2">
        <Plug size={16} />
      </Link>
      <Link href="/demo" className="ml-auto rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-2">
        <MessageSquare size={16} />
      </Link>
    </div>
  );
}
