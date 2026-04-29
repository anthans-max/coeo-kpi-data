"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/voice", label: "Voice" },
  { href: "/circuits", label: "Circuits" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/upload", label: "Uploads" },
] as const;

export function NavBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="border-b border-border bg-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex gap-6 text-sm">
        <span className="font-semibold text-navy mr-2">Coeo Profitability</span>
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                active
                  ? "text-navy font-medium underline underline-offset-4"
                  : "text-text-secondary hover:text-navy transition-colors"
              }
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
