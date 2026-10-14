
"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="hidden h-full shrink-0 overflow-hidden md:flex">
        <AppSidebar />
      </aside>

      {/* Main application area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0">
          <AppHeader />
        </div>

        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto h-full w-full max-w-[1440px] overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-7 sm:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}

