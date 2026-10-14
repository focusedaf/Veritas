"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderKanban, LayoutDashboard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Activity", href: "/activity", icon: Activity },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#09090b]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around gap-2">
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
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition-colors",
                active
                  ? "text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}

        <Link
          href="/projects/new"
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] text-zinc-500 transition-colors hover:text-emerald-400"
        >
          <Plus className="size-5" />
          <span>New</span>
        </Link>
      </div>
    </nav>
  );
}
