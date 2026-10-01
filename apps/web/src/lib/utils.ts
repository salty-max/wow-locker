import clsx, { type ClassValue } from "clsx";

export const cn = (...v: ClassValue[]) => clsx(v);

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}
