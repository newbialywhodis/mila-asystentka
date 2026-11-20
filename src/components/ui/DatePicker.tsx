import { Popover } from "@base-ui/react/popover";
import { DayPicker } from "@daypicker/react";
import type { ChevronProps } from "@daypicker/react";
import { pl } from "@daypicker/react/locale/pl";
import { useRef, useState } from "react";
import type { ComponentPropsWithRef } from "react";
import { normalizeNumericDate, parseDate } from "../../engine/dates";
import { Button, IconButton } from "./Button";
import { Icon } from "./Icon";
import styles from "./DatePicker.module.css";

const inputDateFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const calendarClasses = {
  month: styles.month,
  month_caption: styles.caption,
  dropdowns: styles.dropdowns,
  dropdown_root: styles.dropdownRoot,
  dropdown: styles.dropdown,
  caption_label: styles.captionLabel,
  button_previous: styles.previous,
  button_next: styles.next,
  chevron: styles.chevron,
  month_grid: styles.grid,
  weekday: styles.weekday,
  day: styles.day,
  day_button: styles.dayButton,
};

const calendarComponents = {
  Chevron: CalendarChevron,
  PreviousMonthButton: CalendarNavigationButton,
  NextMonthButton: CalendarNavigationButton,
};

type DatePickerProps = Pick<
  ComponentPropsWithRef<"input">,
  "ref" | "name" | "required" | "aria-label" | "aria-describedby" | "aria-invalid"
> & {
  defaultValue?: string;
  min: string;
  max: string;
  today: string;
  onValueChange?: (text: string) => void;
};

export function DatePicker({
  defaultValue,
  min,
  max,
  today,
  onValueChange,
  ...inputProps
}: DatePickerProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const inputOpener = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => {
    const date = parseDate(defaultValue);
    return date ? inputDateFormat.format(date) : "";
  });
  const isoValue = normalizeNumericDate(value);
  const selected = isoValue && isoValue >= min && isoValue <= max ? parseDate(isoValue) : undefined;
  const start = parseDate(min);
  const end = parseDate(max);

  function changeValue(text: string) {
    setValue(text);
    onValueChange?.(text);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, { reason }) => {
        if (reason !== "escape-key") inputOpener.current = null;
        setOpen(next);
      }}
    >
      <div ref={anchor} className={styles.field}>
        <input
          {...inputProps}
          className={styles.input}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="DD.MM.RRRR"
          value={value}
          onChange={(event) => changeValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            inputOpener.current = event.currentTarget;
            setOpen(true);
          }}
        />
        <Popover.Trigger
          render={<IconButton icon="calendar" label="Otwórz kalendarz" size="icon" />}
        />
      </div>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={styles.positioner}
        >
          <Popover.Popup
            className={styles.popup}
            aria-label="Kalendarz"
            initialFocus={false}
            finalFocus={() => inputOpener.current}
          >
            <DayPicker
              mode="single"
              required
              locale={pl}
              timeZone="UTC"
              today={parseDate(today)}
              defaultMonth={selected}
              startMonth={start}
              endMonth={end}
              disabled={[start ? { before: start } : false, end ? { after: end } : false]}
              selected={selected}
              onSelect={(date) => {
                changeValue(inputDateFormat.format(date));
                setOpen(false);
              }}
              captionLayout="dropdown"
              navLayout="around"
              reverseYears
              showOutsideDays
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- Focus the day grid after opening the calendar.
              autoFocus
              classNames={calendarClasses}
              components={calendarComponents}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CalendarChevron({ orientation, className }: ChevronProps) {
  return (
    <span className={className} data-direction={orientation}>
      <Icon name="chevron" size="sm" />
    </span>
  );
}

function CalendarNavigationButton(props: ComponentPropsWithRef<"button">) {
  return <Button variant="ghost" size="icon-sm" {...props} />;
}
