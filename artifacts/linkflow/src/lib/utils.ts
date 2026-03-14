import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateShortUrl(slug: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/r/${slug}`;
  }
  return `/api/r/${slug}`;
}
