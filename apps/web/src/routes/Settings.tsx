import { NOTIFIABLE_EVENTS, type EventType, type Lang } from "@wow-locker/shared";
import { Bell, BellOff, Download, Send } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { canInstall, openInstallGuide } from "@/lib/install";
import { currentSubscription, disablePush, enablePush, pushSupport, resyncPush, type EnableResult } from "@/lib/notifications";
import { setSettings, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="wow-header mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Notifications() {
  const t = useT();
  const { events } = useSettings();
  const support = pushSupport();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<EnableResult | "test" | "saved" | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    void currentSubscription()
      .then((s) => setSubscribed(!!s))
      .catch(() => setSubscribed(false));
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!subscribed) return;
    const id = setTimeout(() => void resyncPush().then((ok) => ok && setStatus("saved")), 500);
    return () => clearTimeout(id);
  }, [events, subscribed]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        setStatus(null);
      } else {
        const r = await enablePush();
        setStatus(r);
        setSubscribed(r === "ok");
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleEvent = (e: EventType) =>
    setSettings({ events: events.includes(e) ? events.filter((x) => x !== e) : [...events, e] });

  const message =
    support === "install"
      ? t.settings.needInstall
      : support === "insecure"
        ? t.settings.insecure
        : support === "unsupported"
          ? t.settings.unsupported
          : status === "denied" || (typeof Notification !== "undefined" && Notification.permission === "denied")
            ? t.settings.denied
            : status === "unavailable"
              ? t.settings.unavailable
              : status === "test"
                ? t.settings.testSent
                : status === "saved"
                  ? t.settings.saved
                  : subscribed
                    ? t.settings.enabled
                    : t.settings.notifyHint;

  return (
    <Section title={t.settings.notifications}>
      <p className={cn("text-sm", subscribed ? "text-q-uncommon" : "text-ink-dim")}>{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {support === "ok" && (
          <button className={cn("wow-btn", subscribed && "wow-btn-dark")} onClick={toggle} disabled={busy || subscribed === null}>
            {subscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />}
            {subscribed ? t.settings.disable : t.settings.enable}
          </button>
        )}
        {support === "install" && (
          <button className="wow-btn" onClick={openInstallGuide}>
            <Download className="size-4" /> {t.settings.install}
          </button>
        )}
        {subscribed && (
          <button
            className="wow-btn wow-btn-dark"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              if (await resyncPush(true)) setStatus("test");
              setBusy(false);
            }}
          >
            <Send className="size-4" /> {t.settings.sendTest}
          </button>
        )}
      </div>

      <h3 className="mt-5 mb-2 text-sm text-[#ffd100] [text-shadow:0_1px_1px_#000]">{t.settings.which}</h3>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {NOTIFIABLE_EVENTS.map((e) => (
          <label key={e} className="flex cursor-pointer items-center gap-2.5 text-sm text-white">
            <input type="checkbox" className="wow-check" checked={events.includes(e)} onChange={() => toggleEvent(e)} />
            {t.eventType[e]}
          </label>
        ))}
      </div>
    </Section>
  );
}

export function Settings() {
  const t = useT();
  const { lang } = useSettings();
  return (
    <div className="wow-frame mx-auto max-w-2xl px-4 pt-9 pb-6 sm:px-6">
      <span className="wow-title">{t.settings.title}</span>
      <Section title={t.settings.language}>
        <div className="flex gap-2">
          {(["en", "fr"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setSettings({ lang: l })}
              aria-pressed={lang === l}
              className={cn("wow-btn wow-btn-sm min-w-28", lang !== l && "wow-btn-dark")}
            >
              {l === "en" ? "English" : "Français"}
            </button>
          ))}
        </div>
      </Section>
      <Notifications />
      {canInstall() && (
        <Section title={t.settings.install}>
          <p className="mb-2 text-sm text-ink-dim">{t.settings.installHint}</p>
          <button className="wow-btn wow-btn-dark" onClick={openInstallGuide}>
            <Download className="size-4" /> {t.settings.install}
          </button>
        </Section>
      )}
      <Section title={t.settings.about}>
        <p className="text-sm text-ink-dim">{t.settings.aboutText}</p>
        <p className="mt-3 text-xs text-ink-faint">{t.settings.version(__APP_VERSION__, __BUILD_DATE__)}</p>
      </Section>
    </div>
  );
}
