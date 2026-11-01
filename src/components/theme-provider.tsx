"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// next-themes puts a small script in the page so the chosen theme applies before
// the first paint. That script only has to run from the server-rendered HTML; when
// React renders it again in the browser, React 19 warns about a <script> tag. So
// in the browser it is marked as plain text (never run, no warning).
const scriptProps = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
  suppressHydrationWarning: true,
} as const;

// Light by default; the user's choice is remembered in the browser.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}
