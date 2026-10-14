
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  Plus,
} from "lucide-react";

const navigation = [
  {
    title: "Home",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
  },
  {
    title: "Create",
    url: "/projects/new",
    icon: Plus,
  },
];

function isRouteActive(pathname: string, url: string) {
  if (url === "/projects") {
    return pathname === "/projects" ||
      (pathname.startsWith("/projects/") &&
        pathname !== "/projects/new");
  }

  if (url === "/projects/new") {
    return pathname === url;
  }

  return pathname === url || pathname.startsWith(`${url}/`);
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-2">
        {navigation.map((item) => {
          const active = isRouteActive(pathname, item.url);
          const Icon = item.icon;

          return (
            <Link
              key={item.url}
              href={item.url}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
              )}

              <span
                className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                  active
                    ? "bg-primary/10"
                    : "group-hover:bg-muted"
                }`}
              >
                <Icon
                  className={`size-[19px] ${
                    active ? "stroke-[2.3]" : "stroke-[1.8]"
                  }`}
                />
              </span>

              <span
                className={`max-w-full truncate text-[10px] leading-none ${
                  active ? "font-semibold" : "font-medium"
                }`}
              >
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
