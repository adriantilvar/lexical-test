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

export function ensure<ExpectedType>(
  value: unknown,
  validator: (value: unknown) => value is ExpectedType,
  message?: string | (() => string),
): ExpectedType {
  if (validator(value)) return value;

  const providedMessage = typeof message === "function" ? message() : message;

  throw new Error(providedMessage ?? "Some error");
}

export function partition<T>(
  array: Array<T>,
  predicate: (item: T) => boolean,
): [Array<T>, Array<T>] {
  if (!Array.isArray(array)) throw new Error("The provided array is not valid");
  if (array.length === 0) return [[], []];

  const matching: Array<T> = [];
  const notMatching: Array<T> = [];
  array.forEach((item) => {
    if (predicate(item)) matching.push(item);
    else notMatching.push(item);
  });

  return [matching, notMatching];
}

export function not<T>(predicate: (item: T) => boolean): (item: T) => boolean {
  return (item: T) => !predicate(item);
}
