import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, resolving conflicts (shadcn-style helper). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Initials for an avatar bubble, e.g. "Ada Lovelace" -> "AL". */
export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Deterministic, pleasant color from a string (for avatars / tags). */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 45%)`;
}

/** Format an ISO date as a short label. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

/** Normalize an ADO `#RRGGBB` / `RRGGBB` / `AARRGGBB` color into a CSS color. */
export function adoColor(color?: string | null, fallback = "#6b6e78"): string {
  if (!color) return fallback;
  const c = color.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c}`;
  if (/^[0-9a-fA-F]{8}$/.test(c)) return `#${c.slice(2)}`; // ARGB -> RGB
  return fallback;
}
