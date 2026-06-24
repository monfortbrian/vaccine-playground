"use client"

/**
 * NavMain
 * Accordion behaviour: only one group open at a time.
 * Base UI safe: no asChild nesting.
 * Supports soon?: boolean badge on leaf items (no subitems).
 */

import { ChevronRight, type LucideIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState, useCallback } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

interface SubItem {
  title: string
  url: string
  soon?: boolean
}

interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  soon?: boolean
  items?: SubItem[]
}

/* ── Soon badge ─────────────────────────────────────────────────────────── */
function SoonBadge() {
  return (
    <span
      className={[
        "ml-auto shrink-0 px-1.5 py-0.5 rounded",
        "text-[9px] font-semibold uppercase tracking-widest",
        "bg-muted text-muted-foreground",
        /* hide when sidebar collapses to icon mode */
        "group-data-[collapsible=icon]:hidden",
      ].join(" ")}
    >
      Soon
    </span>
  )
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const router   = useRouter()

  /*
    Accordion: track which item key is open.
    On mount, open the group that contains the active pathname.
  */
  const defaultOpen = items.find(item =>
    item.items?.some(sub => pathname.startsWith(sub.url.split("?")[0])) ||
    pathname === item.url
  )?.title ?? null

  const [openKey, setOpenKey] = useState<string | null>(defaultOpen)

  const toggle = useCallback((title: string) => {
    setOpenKey(prev => (prev === title ? null : title))
  }, [])

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-sidebar-foreground/40">
        Platform
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasItems = item.items && item.items.length > 0
          const isActiveGroup =
            item.items?.some(sub => pathname.startsWith(sub.url.split("?")[0])) ||
            pathname === item.url
          const isOpen = openKey === item.title

          /* ── Leaf item (no subitems) Soon or direct nav ── */
          if (!hasItems) {
            return (
              <SidebarMenuItem key={item.title}>
                <button
                  type="button"
                  onClick={() => !item.soon && router.push(item.url)}
                  disabled={!!item.soon}
                  data-sidebar="menu-button"
                  data-size="default"
                  data-active={isActiveGroup ? "true" : undefined}
                  className={[
                    "peer/menu-button group/menu-button flex w-full items-center gap-2",
                    "overflow-hidden rounded-md p-2 text-left text-sm outline-hidden",
                    "ring-sidebar-ring transition-[width,height,padding]",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:ring-2",
                    "disabled:pointer-events-none disabled:opacity-40",
                    "data-[active=true]:bg-foreground/8 data-[active=true]:font-semibold",
                    "data-[active=true]:text-foreground",
                    "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                    "[&>svg]:size-4 [&>svg]:shrink-0",
                  ].join(" ")}
                >
                  {item.icon && <item.icon className="size-4 shrink-0" strokeWidth={1.5} />}
                  <span className="truncate flex-1">{item.title}</span>
                  {item.soon && <SoonBadge />}
                </button>
              </SidebarMenuItem>
            )
          }

          /* ── Collapsible group ── */
          return (
            <Collapsible
              key={item.title}
              open={isOpen}
              onOpenChange={() => toggle(item.title)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {/*
                  CRITICAL Base UI constraint (HANDOFF.md):
                  CollapsibleTrigger + SidebarMenuButton asChild = button-in-button.
                  Apply sidebar CSS classes directly to CollapsibleTrigger.
                  One element, one <button>.
                */}
                <CollapsibleTrigger
                  data-sidebar="menu-button"
                  data-size="default"
                  data-active={isActiveGroup ? "true" : undefined}
                  className={[
                    "peer/menu-button group/menu-button flex w-full items-center gap-2",
                    "overflow-hidden rounded-md p-2 text-left text-sm outline-hidden",
                    "ring-sidebar-ring transition-[width,height,padding]",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:ring-2",
                    "active:bg-sidebar-accent active:text-sidebar-accent-foreground",
                    "data-[active=true]:bg-foreground/8 data-[active=true]:font-semibold",
                    "data-[active=true]:text-foreground",
                    "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                    "[&>svg]:size-4 [&>svg]:shrink-0",
                  ].join(" ")}
                >
                  {item.icon && <item.icon className="size-4 shrink-0" strokeWidth={1.5} />}
                  <span className="truncate flex-1">{item.title}</span>
                  <ChevronRight
                    className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                    strokeWidth={1.5}
                  />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((sub) => {
                      const subActive = pathname === sub.url.split("?")[0]
                      return (
                        <SidebarMenuSubItem key={sub.title}>
                          {/*
                            CRITICAL: SidebarMenuSubButton renders <a> itself.
                            Do NOT use asChild + <Link> produces <a><a>.
                            Pass href directly.
                          */}
                          {sub.soon ? (
                            /* Soon sub-items: render as div, not a link */
                            <div
                              data-slot="sidebar-menu-sub-button"
                              data-sidebar="menu-sub-button"
                              className="flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground/40 opacity-60 cursor-default select-none"
                            >
                              <span className="flex-1 truncate">{sub.title}</span>
                              <SoonBadge />
                            </div>
                          ) : (
                            <SidebarMenuSubButton
                              href={sub.url}
                              isActive={subActive}
                              className={cn(
                                "text-sm transition-colors",
                                subActive
                                  ? "bg-foreground/8 text-foreground font-medium"
                                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                              )}
                            >
                              <span>{sub.title}</span>
                            </SidebarMenuSubButton>
                          )}
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}