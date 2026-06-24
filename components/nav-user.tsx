"use client"

/**
 * NavUser
 * Base UI constraint: DropdownMenuTrigger asChild + SidebarMenuButton = button-in-button.
 * Fix: DropdownMenuTrigger renders its own element with sidebar button classes applied
 * directly. SidebarMenuButton is NOT used inside the trigger.
 */

import {
  ChevronsUpDown, LogOut, Settings, User, Bell,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

function DiceBearAvatar({ email, name, size = 32 }: { email: string; name: string; size?: number }) {
  const seed = encodeURIComponent(email || name || "researcher")
  const src  = `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&backgroundColor=transparent`
  return (
    <div className="shrink-0 overflow-hidden rounded-md bg-muted" style={{ width: size, height: size, minWidth: size }}>
      <img src={src} alt={name} width={size} height={size} className="block size-full object-cover" loading="lazy" />
    </div>
  )
}

export function NavUser({ user }: { user: { name: string; title?: string; email: string } }) {
  const { isMobile } = useSidebar()
  const { signOut }  = useAuth() as any
  const router       = useRouter()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          {/*
            CRITICAL Base UI constraint:
            DropdownMenuTrigger asChild + SidebarMenuButton = button-in-button.
            Fix: no asChild, no SidebarMenuButton inside trigger.
            Apply sidebar button classes directly to the trigger element.
          */}
          <DropdownMenuTrigger
            className="peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-12 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-2"
          >
            <DiceBearAvatar email={user.email} name={user.name} size={32} />
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/50">
                {user.title || "Vaccine Researcher"}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" strokeWidth={1.5} />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <DiceBearAvatar email={user.email} name={user.name} size={40} />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.title || "Vaccine Researcher"}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground/60 mt-0.5">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                <User className="size-4" strokeWidth={1.5} />Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                <Settings className="size-4" strokeWidth={1.5} />Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Bell className="size-4" strokeWidth={1.5} />Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => signOut?.()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="size-4" strokeWidth={1.5} />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}