import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Loading and error states shared by the pages: skeletons shaped like what's
 * coming (announced as loading to screen readers), and an error with a way out.
 */

function Bar({ className }: { className?: string }) {
  return <span className={cn("block rounded bg-stone-2/60", className)} />;
}

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <div aria-busy="true" className={cn("animate-pulse", className)}>
      <span className="sr-only" role="status">
        {t.common.loading}
      </span>
      {children}
    </div>
  );
}

/** The character page while it loads: header, paper doll, stats. */
export function CharacterSkeleton() {
  const slots = (n: number) => (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <Bar key={i} className="size-[42px]" />
      ))}
    </div>
  );
  return (
    <Loading className="mx-auto max-w-3xl">
      <Bar className="mb-6 h-8 w-32" />
      <div className="wow-frame px-3 pt-8 pb-4 sm:px-5">
        <div className="flex items-center gap-3">
          <Bar className="size-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bar className="h-4 w-48" />
            <Bar className="h-3 w-32" />
          </div>
        </div>
        <Bar className="mt-4 h-3 w-full" />
        <div className="mt-6 flex items-start justify-center gap-4">
          {slots(8)}
          <Bar className="h-[22rem] max-w-64 flex-1" />
          {slots(8)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Bar className="h-40" />
          <Bar className="h-40" />
        </div>
      </div>
    </Loading>
  );
}

/** A page of frames while it loads (Today, the memorial). */
export function PageSkeleton({ frames = 2 }: { frames?: number }) {
  return (
    <Loading className="mx-auto max-w-3xl space-y-10">
      {Array.from({ length: frames }, (_, i) => (
        <div key={i} className="wow-frame space-y-3 px-5 pt-8 pb-5">
          <Bar className="h-4 w-1/3" />
          <Bar className="h-10 w-full" />
          <Bar className="h-10 w-full" />
          <Bar className="h-10 w-2/3" />
        </div>
      ))}
    </Loading>
  );
}

/** The page couldn't load: say so, offer to try again (or the way back, when it doesn't exist). */
export function LoadError({ notFound = false, onRetry }: { notFound?: boolean; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="wow-frame mx-auto mt-6 flex max-w-md flex-col items-center gap-4 px-6 py-8 text-center">
      <p className="text-sm text-ink-dim">{notFound ? t.common.notFound : t.common.loadError}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {!notFound && onRetry && (
          <button type="button" className="wow-btn" onClick={onRetry}>
            {t.common.retry}
          </button>
        )}
        <Link to="/" className="wow-btn wow-btn-dark">
          {t.common.toLocker}
        </Link>
      </div>
    </div>
  );
}
