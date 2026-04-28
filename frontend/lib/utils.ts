import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  HIGH: "text-severity-high bg-severity-high/10 border-severity-high/30",
  MEDIUM: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  LOW: "text-severity-low bg-severity-low/10 border-severity-low/30",
  OK: "text-severity-ok bg-severity-ok/10 border-severity-ok/30",
  COMPLIANT: "text-severity-ok bg-severity-ok/10 border-severity-ok/30",
  NON_COMPLIANT: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
};

export const SEVERITY_HEX: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#EAB308",
  LOW: "#84CC16",
  OK: "#22C55E",
};
