"use client";

import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  Plus,
  ShieldCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navigation = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Activity", url: "/activity", icon: Activity },
];

function isRouteActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/";

  if (url === "/projects") {
    return (
      pathname === "/projects" ||
      (pathname.startsWith("/projects/") && pathname !== "/projects/new")
    );
  }

  return pathname === url || pathname.startsWith(`${url}/`);
}

// Colors from the original hand-built sidebar, applied to shadcn's theme tokens.
const sidebarTheme = {
  "--sidebar": "#0b0b0d",
  "--sidebar-foreground": "#71717a", // zinc-500
  "--sidebar-border": "rgba(255, 255, 255, 0.1)",
  "--sidebar-accent": "rgba(255, 255, 255, 0.07)",
  "--sidebar-accent-foreground": "#ffffff",
  "--sidebar-ring": "#34d399",
} as CSSProperties;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Sidebar
      collapsible="icon"
      style={sidebarTheme}
      className="border-r border-white/10"
    >
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-black">
            <ShieldCheck className="size-5" />
          </div>

          <div className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="truncate text-lg font-semibold tracking-tight text-white">
              Veritas
            </span>
            <span className="truncate text-[10px] font-medium tracking-[0.2em] text-zinc-500">
              ESCROW PROTOCOL
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold tracking-[0.18em] text-zinc-600">
            WORKSPACE
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const active = isRouteActive(pathname, item.url);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      aria-current={active ? "page" : undefined}
                      onClick={() => router.push(item.url)}
                      className="h-10 cursor-pointer rounded-lg px-3 text-sm text-zinc-500 transition-colors hover:bg-white/4 hover:text-zinc-200 data-[active=true]:bg-white/7 data-[active=true]:font-medium data-[active=true]:text-white data-[active=true]:[&>svg]:text-emerald-400"
                    >
                      <Icon className="size-[17px] shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New project"
              onClick={() => router.push("/projects/new")}
              className="h-10 cursor-pointer justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-300 hover:text-black active:bg-emerald-300 active:text-black"
            >
              <Plus className="size-4 shrink-0" />
              <span>New project</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
