import { useLang } from "@/lib/i18n";
import { fullDate, timeAgo } from "@/lib/time";

/** A relative time ("2 days ago"), with the full date one hover away. */
export function When({ iso }: { iso: string }) {
  const lang = useLang();
  return (
    <time dateTime={iso} title={fullDate(iso, lang)}>
      {timeAgo(iso, lang)}
    </time>
  );
}
