import { Popover } from "@base-ui/react/popover";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import type { Source } from "../../types/catalog";
import { SourceFavicon } from "./SourceFavicon";
import cardStyles from "../../components/ui/HoverCard.module.css";
import styles from "./GuideSources.module.css";

const maxAvatars = 3;
const pluralRules = new Intl.PluralRules("pl");
const sourceNouns: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "źródło",
  few: "źródła",
};

export function GuideSources({ citations }: { citations: readonly (Source & { id: string })[] }) {
  const links = citations.map((source) => ({ ...source, hostname: new URL(source.url).hostname }));
  const hostnames = [...new Set(links.map(({ hostname }) => hostname))].slice(0, maxAvatars);
  const count = citations.length;
  const noun = sourceNouns[pluralRules.select(count)] ?? "źródeł";

  return (
    <Popover.Root>
      <Popover.Trigger
        render={<Button variant="ghost" size="xs" rounded className={styles.trigger} />}
      >
        <span className={styles.avatars} aria-hidden="true">
          {hostnames.map((hostname) => (
            <SourceFavicon key={hostname} hostname={hostname} size={20} className={styles.avatar} />
          ))}
        </span>
        {count} {noun}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className={cardStyles.positioner}
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
        >
          <Popover.Popup
            className={`${cardStyles.popup} ${styles.popup}`}
            aria-label="Źródła odpowiedzi"
          >
            <ul className={styles.list}>
              {links.map(({ id, authority, title, url, hostname }) => (
                <li key={id}>
                  <a
                    className={styles.link}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${title}, ${authority} (otwiera się w nowej karcie)`}
                  >
                    <SourceFavicon hostname={hostname} size={16} className={styles.favicon} />
                    <span className={styles.title} title={title}>
                      {title}
                    </span>
                    <Icon name="arrowUpRight" size="sm" />
                  </a>
                </li>
              ))}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
