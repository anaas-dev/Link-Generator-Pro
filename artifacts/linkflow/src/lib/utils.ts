import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateShortUrl(_slug: string) {
  return `yas-link.to/${_slug}`;
}

export function getWorkingShortUrl(slug: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/r/${slug}`;
  }
  return `/r/${slug}`;
}
