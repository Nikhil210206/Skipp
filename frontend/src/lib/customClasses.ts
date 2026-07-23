// Persistence for user-added custom classes. On-device only (localStorage),
// scoped per student so different logins on one device don't mix. Not sensitive,
// so no encryption — but it lives only on the device, like everything else.

import type { CustomClass } from "@/types";

const key = (reg: string) => `skipp.custom.${reg}`;

export function loadCustomClasses(reg: string): CustomClass[] {
  try {
    const raw = localStorage.getItem(key(reg));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomClass[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomClasses(reg: string, list: CustomClass[]): void {
  try {
    localStorage.setItem(key(reg), JSON.stringify(list));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export function newCustomId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
