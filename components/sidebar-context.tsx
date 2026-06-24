"use client";

/**
 * Tiny sidebar-collapse context replaces shadcn's useSidebar().
 * Avoids prop drilling collapsed state into pages like Playground
 * that need to adjust their own grid ratios based on sidebar width.
 */

import React, { createContext, useContext, useState } from "react";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
}

const Ctx = createContext<SidebarCtx | null>(null);

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Ctx.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSidebarState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebarState must be used within SidebarStateProvider");
  return ctx;
}