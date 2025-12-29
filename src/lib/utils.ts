import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INVARIANT_PREFIX = "Invariant failed";

export function isServer() {
  return typeof window === "undefined";
}

export function invariant(
  condition: unknown,
  message?: string | (() => string),
): asserts condition {
  if (condition) return;

  const providedMessage = typeof message === "function" ? message() : message;

  throw new Error(providedMessage ? `${INVARIANT_PREFIX}: ${providedMessage}` : INVARIANT_PREFIX);
}
