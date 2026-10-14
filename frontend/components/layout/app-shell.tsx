"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ProjectsProvider } from "../providers/projects-provider";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProjectsProvider>
      <SidebarProvider>
        <div className="flex h-dvh w-full overflow-hidden bg-[#09090b] text-zinc-100">
          <AppSidebar />

          <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#09090b]">
            <AppHeader />

            <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-24 md:pb-8">
              <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>
          </SidebarInset>

          <MobileNav />
        </div>
      </SidebarProvider>
    </ProjectsProvider>
  );
}

