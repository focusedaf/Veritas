"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Activity", href: "/activity", icon: Activity },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[#0b0b0d] md:flex">
      <Link href="/" className="flex h-19 items-center gap-3 px-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400 text-black">
          <ShieldCheck className="size-5" />
        </div>

        <div>
          <p className="text-lg font-semibold tracking-tight text-white">
            Veritas
          </p>
          <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-500">
            SMART ESCROW
          </p>
        </div>
      </Link>

      <div className="px-4 pt-7">
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.18em] text-zinc-600">
          WORKSPACE
        </p>

        <nav className="space-y-1">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  active
                    ? "bg-white/[0.07] font-medium text-white"
                    : "text-zinc-500 hover:bg-white/4 hover:text-zinc-200",
                )}
              >
                <Icon
                  className={cn(
                    "size-4.25",
                    active ? "text-emerald-400" : "text-current",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/projects/new"
          className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-300"
        >
          <Plus className="size-4" />
          New project
        </Link>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-xl border border-white/10 bg-white/2 p-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-zinc-300">
              Sepolia testnet
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            Transactions use test ETH on Ethereum Sepolia.
          </p>
        </div>
      </div>
    </aside>
  );
}
