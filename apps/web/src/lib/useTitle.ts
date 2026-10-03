import { useEffect } from "react";

const BASE = "WoWLocker";
const HOME = "WoWLocker — WoW Classic characters";

/** The browser tab's title for this page ("Sealinedion · WoWLocker"); screen readers announce it. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : HOME;
  }, [title]);
}
