import { useT } from "@/lib/i18n";

const ISSUES = "https://github.com/salty-max/wow-locker/issues";

/** What WoWLocker stores, why, for how long, and how to delete it. */
export function Privacy() {
  const t = useT();
  const P = t.privacy;
  return (
    <div className="wow-frame mx-auto max-w-2xl px-4 pt-9 pb-6 sm:px-6">
      <span className="wow-title">{P.title}</span>
      <p className="text-xs text-ink-faint">{P.updated}</p>
      <p className="mt-3 text-sm text-ink-dim">{P.intro}</p>
      {P.sections.map((sec) => (
        <section key={sec.title} className="mt-5">
          <h2 className="wow-header mb-2">{sec.title}</h2>
          <p className="text-sm leading-relaxed text-ink">{sec.body}</p>
        </section>
      ))}
      <p className="mt-6 text-sm">
        <a href={ISSUES} target="_blank" rel="noreferrer" className="text-[#ffd100] underline-offset-2 hover:underline">
          {P.contact}
        </a>
      </p>
    </div>
  );
}
