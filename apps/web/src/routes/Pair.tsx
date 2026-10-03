import { REGIONS } from "@wow-locker/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { CheckCircle2, LogIn } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useTitle } from "@/lib/useTitle";

const route = getRouteApi("/pair");

/**
 * Where the companion app sends the browser to pair: log in with Battle.net
 * (which proves which characters are yours), then go back to the companion.
 */
export function Pair() {
  const t = useT();
  useTitle(t.pair.title);
  const { code, done, error, k } = route.useSearch();
  const pending = useQuery({
    queryKey: ["pair", code],
    queryFn: async () => ((await (await fetch(`/api/companion/pair/${encodeURIComponent(code ?? "")}`)).json()) as { pending: boolean }).pending,
    enabled: !!code && !done,
  });
  // The pairing login is also a normal Battle.net login (it opened a session).
  const account = useQuery({ queryKey: ["import", k], queryFn: () => api.accountImport(k!), enabled: !!k, retry: false });

  const expired = error === "expired" || (pending.data === false && !done);

  return (
    <div className="wow-frame mx-auto mt-6 flex max-w-md flex-col items-center gap-4 px-6 pt-9 pb-7 text-center">
      <h1 className="wow-title">{t.pair.title}</h1>
      {done ? (
        <>
          <CheckCircle2 className="size-12 text-q-uncommon" />
          <p className="text-white">{t.pair.done(account.data?.battletag ?? "Battle.net")}</p>
          <p className="text-sm text-ink-dim">{t.pair.backToCompanion}</p>
          {k && (
            <Link to="/import" search={{ k }} className="wow-btn wow-btn-dark">
              {t.pair.alsoImport}
            </Link>
          )}
        </>
      ) : pending.isLoading ? null : expired || !code ? (
        <p className="text-sm text-ink-dim">{t.pair.expired}</p>
      ) : (
        <>
          <p className="text-sm text-ink-dim">{t.pair.intro}</p>
          <p className="rounded border border-[#5c5c5c] bg-black/60 px-5 py-2 font-mono text-2xl tracking-[0.3em] text-[#ffd100] [text-shadow:0_1px_2px_#000]">
            {code}
          </p>
          <p className="text-xs text-ink-faint">{t.pair.checkCode}</p>
          <div className="flex flex-col gap-2">
            {REGIONS.map((r) => (
              <a
                key={r}
                href={`/api/auth/login?region=${r}&pair=${encodeURIComponent(code)}`}
                className="wow-btn wow-btn-bnet"
              >
                <LogIn className="size-4" /> {t.account.loginRegion(r.toUpperCase())}
              </a>
            ))}
          </div>
          <p className="text-xs text-ink-faint">
            {t.pair.privacy}{" "}
            <Link to="/privacy" className="text-[#ffd100] underline-offset-2 hover:underline">
              {t.privacy.link}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
