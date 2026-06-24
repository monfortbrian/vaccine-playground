"use client"

/**
 * AppSidebar
 * sidebar-07 pattern. Base UI safe.
 * Agents: 4 sub-items (Overview, Pipeline Status, Agent Log, Changelog).
 * Soon badge on Projects and Team.
 * KPI numbers use foreground, badges carry signal color.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FlaskConical, SquareTerminal, Bot, Dna, Brain,
  FolderOpen, Users, Settings, BookOpen, Archive
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"

const navMain = [
  {
    title: "Playground",
    url: "/playground",
    icon: SquareTerminal,
    items: [
      { title: "New Run", url: "/playground" },
      { title: "Run History", url: "/history" },
      { title: "Starred", url: "/starred" },

    ],
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
    items: [
      { title: "Overview", url: "/agents" },
      { title: "Pipeline Status", url: "/agents/status" },
      { title: "Agent Log", url: "/agents/log" },
      { title: "Changelog", url: "/agents/changelog" },
    ],
  },
  {
    title: "Science",
    url: "#",
    icon: Dna,
    items: [
      { title: "Epitope Library", url: "/science/epitopes", soon: true },
      { title: "Constructs", url: "/science/constructs", soon: true },
      { title: "Wet-Lab Protocols", url: "/science/protocols", soon: true },
    ],
  },
  {
    title: "Intelligence",
    url: "#",
    icon: Brain,
    items: [
      { title: "Literature", url: "/intelligence/literature", soon: true },
      { title: "Coverage Atlas", url: "/intelligence/coverage", soon: true },
    ],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderOpen,
    soon: true,
    items: [],
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
    soon: true,
    items: [],
  },
  {
    title: "Archive",
    url: "/archive",
    icon: Archive,

    items: [],
  },
]

const navSecondary = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Documentation", url: "https://docs.kozi-ai.com", icon: BookOpen, external: true },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth() as any
  const router = useRouter()

  const userData = {
    name: user?.user_metadata?.full_name
      || user?.user_metadata?.name
      || user?.email?.split("@")[0]
      || "Researcher",
    title: user?.user_metadata?.title || "Vaccine Researcher",
    email: user?.email || "",
    avatar: `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(user?.email || "researcher")}&backgroundColor=transparent`,
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* No asChild Base UI constraint. onClick for navigation. */}
            <SidebarMenuButton
              size="lg"
              onClick={() => router.push("/playground")}
              className="cursor-pointer"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
                <FlaskConical className="size-4" strokeWidth={1.75} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate text-xs text-sidebar-foreground/50">TOPE_DEEP</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}