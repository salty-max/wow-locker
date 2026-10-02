import { DEFAULT_NOTIFY_EVENTS, NOTIFIABLE_EVENTS, type EventType, type Lang } from "@wow-locker/shared";
import { createStore } from "@/lib/store";

export type Settings = {
  lang: Lang;
  /** Which events this device wants pushed. */
  events: EventType[];
};

function defaultLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
  } catch {
    return "en";
  }
}

const initial: Settings = { lang: defaultLang(), events: DEFAULT_NOTIFY_EVENTS };

export const settings = createStore<Settings>("wow-locker:settings", initial, (raw) => {
  const r = (raw ?? {}) as Partial<Settings>;
  return {
    lang: r.lang === "fr" || r.lang === "en" ? r.lang : initial.lang,
    events: Array.isArray(r.events) ? r.events.filter((e) => NOTIFIABLE_EVENTS.includes(e)) : initial.events,
  };
});

export const useSettings = settings.use;
export const getSettings = settings.get;
export function setSettings(patch: Partial<Settings>): void {
  settings.set((s) => ({ ...s, ...patch }));
}
