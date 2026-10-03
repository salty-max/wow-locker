import { Link } from "@tanstack/react-router";
import { Download, Laptop, Monitor, Package } from "lucide-react";
import type { ReactNode } from "react";
import { ADDON_VERSION, COMPANION_VERSION, detectPlatform, download, FILES, RELEASES_URL } from "@/lib/downloads";
import { useT } from "@/lib/i18n";
import { useTitle } from "@/lib/useTitle";

/** Get started: what the addon + companion add, downloads, setup, FAQ. */
export function Addon() {
  const t = useT();
  useTitle(t.nav.addon);
  const a = t.addon;
  const platform = detectPlatform();

  return (
    <div className="flex flex-col gap-10">
      <section className="wow-frame px-4 pt-9 pb-6 sm:px-6">
        <h1 className="wow-title">{a.title}</h1>
        <p className="text-ink">{a.intro}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-ink-dim sm:grid-cols-2">
          {a.features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-[#ffd100]">•</span>
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-faint">{a.withoutAddon}</p>
      </section>

      <section className="wow-frame px-4 pt-9 pb-6 sm:px-6">
        <h2 className="wow-title">{a.downloads}</h2>
        {platform === "other" && <p className="mb-4 text-sm text-ink-dim">{a.onComputer}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <DownloadCard
            icon={<Package className="size-5" />}
            kind={a.kindAddon}
            name="WoWLocker"
            version={ADDON_VERSION}
            detail={a.addonDetail}
            href={download(FILES.addon)}
            label={a.downloadZip}
            yours={a.yourSystem}
            mine={false}
          />
          <DownloadCard
            icon={<Monitor className="size-5" />}
            kind={a.kindCompanion}
            name="Windows"
            version={COMPANION_VERSION}
            detail={a.windowsDetail}
            href={download(FILES.windows)}
            label={a.downloadExe}
            yours={a.yourSystem}
            mine={platform === "windows"}
          />
          <DownloadCard
            icon={<Laptop className="size-5" />}
            kind={a.kindCompanion}
            name="macOS"
            version={COMPANION_VERSION}
            detail={a.macDetail}
            href={download(FILES.macos)}
            label={a.downloadZip}
            yours={a.yourSystem}
            mine={platform === "macos"}
          />
        </div>
        <p className="mt-4 text-xs text-ink-faint">
          <a href={download(FILES.windowsArm)} className="underline hover:text-ink-dim">
            {a.windowsArm}
          </a>
          {" · "}
          {a.openSource}{" "}
          <a href={RELEASES_URL} target="_blank" rel="noopener" className="underline hover:text-ink-dim">
            {a.allReleases}
          </a>
        </p>
      </section>

      <section className="wow-frame px-4 pt-9 pb-6 sm:px-6">
        <h2 className="wow-title">{a.setup}</h2>
        <ol className="flex flex-col gap-5">
          {a.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3.5">
              <span className="wow-slot flex size-9 shrink-0 items-center justify-center font-semibold text-[#ffd100] [font-family:Cinzel,serif]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-[#ffd100]">{s.title}</h3>
                <div className="mt-1 flex flex-col gap-1.5 text-sm text-ink-dim">
                  {s.body.map((p) => (
                    <p key={p}>{rich(p)}</p>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/" className="wow-btn wow-btn-sm">
            <Package className="size-3.5" />
            {a.toLocker}
          </Link>
          <Link to="/settings" className="wow-btn wow-btn-sm wow-btn-dark">
            {a.toNotifications}
          </Link>
        </div>
      </section>

      <section className="wow-frame px-4 pt-9 pb-6 sm:px-6">
        <h2 className="wow-title">{a.faq}</h2>
        <dl className="flex flex-col gap-4">
          {a.questions.map((q) => (
            <div key={q.q}>
              <dt className="font-semibold text-ink">{q.q}</dt>
              <dd className="mt-1 text-sm text-ink-dim">{rich(q.a)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function DownloadCard(props: {
  icon: ReactNode;
  kind: string;
  name: string;
  version: string;
  detail: string;
  href: string;
  label: string;
  /** The visitor's platform: tagged, the card itself stays the same. */
  mine: boolean;
  yours: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded border border-[#3a3a40] bg-black/40 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="wow-slot flex size-10 shrink-0 items-center justify-center text-[#ffd100]">{props.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] tracking-wide text-ink-faint uppercase">{props.kind}</div>
          <div className="leading-tight font-semibold text-[#ffd100]">{props.name}</div>
          <div className="text-xs text-ink-faint">
            v{props.version}
            {props.mine && <span className="text-[#ffd100]"> · {props.yours}</span>}
          </div>
        </div>
      </div>
      <p className="flex-1 text-xs text-ink-dim">{props.detail}</p>
      <a href={props.href} className="wow-btn wow-btn-sm justify-center">
        <Download className="size-3.5" />
        {props.label}
      </a>
    </div>
  );
}

/** `code` spans in the copy: `Interface/AddOns` → monospace. */
function rich(text: string): ReactNode {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i} className="rounded bg-black/50 px-1 py-px font-mono text-[0.92em] [overflow-wrap:anywhere] text-ink">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

