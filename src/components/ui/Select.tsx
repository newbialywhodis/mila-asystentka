"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Button } from "./Button";
import { Icon } from "./Icon";
import styles from "./Select.module.css";

export function Select<Value extends string | number>({
  label,
  value,
  items,
  onValueChange,
  side = "bottom",
  className,
}: {
  label: string;
  value: Value;
  items: ReadonlyArray<{ value: Value; label: string }>;
  onValueChange: (value: Value) => void;
  side?: BaseSelect.Positioner.Props["side"];
  className?: string;
}) {
  return (
    <BaseSelect.Root<Value>
      value={value}
      items={items}
      modal={false}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <BaseSelect.Trigger
        aria-label={label}
        render={<Button className={className} size="sm" variant="outline" rounded />}
      >
        <BaseSelect.Value />
        <BaseSelect.Icon>
          <Icon name="chevronDown" size="sm" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className={styles.positioner}
          side={side}
          sideOffset={4}
          align="end"
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup className={styles.popup}>
            <BaseSelect.List className={styles.list}>
              {items.map((item) => (
                <BaseSelect.Item className={styles.item} key={item.value} value={item.value}>
                  <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Icon name="check" size="sm" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
