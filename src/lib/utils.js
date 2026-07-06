import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges class names, resolving conflicting Tailwind utility classes (clsx + tailwind-merge). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const isIframe = window.self !== window.top;
