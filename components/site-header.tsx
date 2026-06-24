"use client"

import { usePathname, useParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Moon, Sun, Monitor, Bug } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription,
  DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/* ── GMT+2 clock ── */
function GMT2Clock() {
  const [tick, setTick] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => setTick(new Date())
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  if (!tick) return <span className="w-44 inline-block" />

  const utcMs = tick.getTime() + tick.getTimezoneOffset() * 60_000
  const gmt2  = new Date(utcMs + 2 * 3_600_000)
  const time  = gmt2.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", second:"2-digit", hour12:true })
  const date  = gmt2.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })

  return (
    <span className="font-mono text-sm text-muted-foreground whitespace-nowrap select-none tabular-nums">
      {time}
      <span className="mx-1.5 opacity-30">·</span>
      {date}
      <span className="ml-1.5 opacity-40 text-[11px]">GMT+2</span>
    </span>
  )
}

/* ── ModeToggle ──────────────────────────────────────────────────────────
   FIX: Base UI DropdownMenuTrigger does NOT support asChild.
   Removed asChild entirely. Styles applied directly to DropdownMenuTrigger.
   motion.button caused nested <button><button> hydration crash.
────────────────────────────────────────────────────────────────────────── */
function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Toggle theme"
      >
        <Sun  className="size-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" strokeWidth={1.5} />
        <Moon className="absolute size-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-lg shadow-lg">
        {[
          { label:"Light",  icon:Sun,     value:"light"  },
          { label:"Dark",   icon:Moon,    value:"dark"   },
          { label:"System", icon:Monitor, value:"system" },
        ].map(({ label, icon: Icon, value }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-2 text-sm py-1.5 cursor-pointer",
              resolvedTheme === value && "font-medium"
            )}
          >
            <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ── Bug report drawer ───────────────────────────────────────────────────
   FIX: DrawerTrigger asChild + motion.button = same nested button crash.
   Removed asChild. Styles applied directly to DrawerTrigger.
────────────────────────────────────────────────────────────────────────── */
function BugReportDrawer() {
  const [desc, setDesc] = useState("")
  const [sent, setSent]  = useState(false)
  const [open, setOpen]  = useState(false)

  const handleSubmit = () => {
    console.info("[bug-report]", desc)
    setSent(true)
    setTimeout(() => { setSent(false); setDesc(""); setOpen(false) }, 2500)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger
        aria-label="Report a bug"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bug className="size-[18px]" strokeWidth={1.5} />
      </DrawerTrigger>

      <DrawerContent className="fixed right-0 top-0 h-full w-[400px] flex flex-col bg-background border-l border-border/20 rounded-none">
        <DrawerHeader className="border-b border-border/20 px-5 py-4 shrink-0">
          <DrawerTitle className="text-sm font-semibold">Report a bug</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground mt-0.5">
            Describe what happened. We'll investigate and follow up.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Page</Label>
            <p className="text-sm font-mono bg-muted rounded px-2.5 py-1.5 select-all border border-border/20">
              {typeof window !== "undefined" ? window.location.pathname : "-"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bug-desc" className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Description</Label>
            <Textarea
              id="bug-desc" rows={8} placeholder="Steps to reproduce…"
              value={desc} onChange={e => setDesc(e.target.value)}
              className="text-sm resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Browser</Label>
            <p className="text-sm text-muted-foreground leading-relaxed break-all">
              {typeof window !== "undefined" ? navigator.userAgent : "-"}
            </p>
          </div>
        </div>
        <DrawerFooter className="border-t border-border/20 px-5 py-4 flex flex-row gap-2 shrink-0">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.p
                key="sent"
                initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="text-sm text-emerald-600 dark:text-emerald-400 font-medium"
              >
                Sent, thank you.
              </motion.p>
            ) : (
              <motion.div key="form" className="flex gap-2 flex-1">
                <Button
                  onClick={handleSubmit}
                  disabled={!desc.trim()}
                  className="flex-1 h-9 text-sm"
                >
                  Send report
                </Button>
                <DrawerClose
                  className="h-9 px-4 text-sm rounded-md border border-border bg-transparent hover:bg-accent transition-colors"
                >
                  Cancel
                </DrawerClose>
              </motion.div>
            )}
          </AnimatePresence>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

/* ── Dynamic breadcrumbs ── */
function useDynamicCrumbs() {
  const pathname = usePathname()
  const params   = useParams<{ runId?: string }>()

  const crumbs: { label: string; href?: string }[] = [
    { label: "Home", href: "/playground" },
  ]

  if (pathname.startsWith("/results")) {
    crumbs.push({ label: "History", href: "/history" })
    crumbs.push({ label: "Results" })
    if (params.runId) crumbs.push({ label: params.runId.slice(0, 8) + "…" })
  } else if (pathname.startsWith("/history"))    { crumbs.push({ label: "History" }) }
  else if (pathname.startsWith("/playground"))   { crumbs.push({ label: "Playground" }) }
  else if (pathname.startsWith("/agents"))       { crumbs.push({ label: "Agents" }) }
  else if (pathname.startsWith("/science"))      { crumbs.push({ label: "Science" }) }
  else if (pathname.startsWith("/intelligence")) { crumbs.push({ label: "Intelligence" }) }
  else if (pathname.startsWith("/starred"))      { crumbs.push({ label: "Starred" }) }
  else if (pathname.startsWith("/settings"))     { crumbs.push({ label: "Settings" }) }
  else if (pathname.startsWith("/projects"))     { crumbs.push({ label: "Projects" }) }
  else if (pathname.startsWith("/team"))         { crumbs.push({ label: "Team" }) }

  return crumbs
}

/* ── SiteHeader ── */
export function SiteHeader() {
  const crumbs = useDynamicCrumbs()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/20 bg-background/90 backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center justify-between gap-2 px-4">

        {/* Left */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-accent" />
          <Separator orientation="vertical" className="h-4 mx-1 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList className="gap-1 flex-nowrap">
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <BreadcrumbSeparator className="text-muted-foreground/30 select-none" />}
                  <BreadcrumbItem>
                    {c.href ? (
                      <BreadcrumbLink
                        href={c.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {c.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-sm font-medium text-foreground">
                        {c.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 shrink-0">
          <GMT2Clock />
          <div className="w-px h-4 bg-border/30 mx-2" />
          <ModeToggle />
          <BugReportDrawer />
        </div>

      </div>
    </header>
  )
}