import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

/*
  Geist Sans body text, UI, headings
  Geist Mono sequences, IDs, tabular data, code
  Both mapped to CSS vars consumed by globals.css --font-sans / --font-mono
*/
const geist = Geist({
  subsets:  ["latin"],
  variable: "--font-geist",
  display:  "swap",
});

const geistMono = Geist_Mono({
  subsets:  ["latin"],
  variable: "--font-geist-mono",
  display:  "swap",
});

export const metadata: Metadata = {
  title:       "Vaccine Discovery, Automated",
  description: "AI-orchestrated epitope prediction pipeline. From pathogen to ranked vaccine candidates in hours.",
  icons: {
    icon:     "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}