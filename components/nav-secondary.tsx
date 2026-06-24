"use client"

/**
 * NavSecondary Settings + Help links at the bottom.
 * Base UI safe: SidebarMenuButton uses onClick for navigation, no asChild.
 */

import { useRouter } from "next/navigation"
import { type LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: { title: string; url: string; icon: LucideIcon }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const router = useRouter()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {/*
                No asChild + Link produces <button><a>.
                Use onClick to handle both internal routes and external URLs.
              */}
              <SidebarMenuButton
                tooltip={item.title}
                onClick={() => {
                  if (item.url.startsWith("http")) {
                    window.open(item.url, "_blank", "noopener,noreferrer")
                  } else {
                    router.push(item.url)
                  }
                }}
                className="text-sm"
              >
                <item.icon className="size-4" strokeWidth={1.5} />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}