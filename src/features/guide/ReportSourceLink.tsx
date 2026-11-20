import { HoverCard } from "../../components/ui/HoverCard";
import { sources } from "../../data/sources";
import { formatDate } from "./flow";
import { SourceFavicon } from "./SourceFavicon";
import styles from "./ReportSourceLink.module.css";

export function ReportSourceLink({
  sourceId,
  label,
  showTitle = false,
}: {
  sourceId: string;
  label?: string;
  showTitle?: boolean;
}) {
  const { authority, title, url, verifiedAt } = sources[sourceId];
  const { hostname } = new URL(url);
  const site = hostname.replace(/^www\./, "");
  const linkLabel = showTitle ? `${title} — ${site}` : `${site} — ${label ?? title}`;

  return (
    <HoverCard
      trigger={
        <a
          className={styles.source}
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${linkLabel} (otwiera się w nowej karcie)`}
        >
          <SourceFavicon hostname={hostname} size={12} className={styles.favicon} />
          <span>{showTitle ? title : site}</span>
        </a>
      }
    >
      <div className={styles.preview}>
        <p className={styles.meta}>{authority === site ? site : `${authority} · ${site}`}</p>
        <p className={styles.title}>{title}</p>
        <p className={styles.meta}>
          Sprawdzono <time dateTime={verifiedAt}>{formatDate(verifiedAt)}</time>
        </p>
      </div>
    </HoverCard>
  );
}
