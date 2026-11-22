import { NumberField } from "@base-ui/react/number-field";
import type { NumberFieldInputProps, NumberFieldRootProps } from "@base-ui/react/number-field";
import { useId } from "react";
import { InputHelp } from "./InputHelp";
import styles from "./NumericInput.module.css";

type NumericInputProps = Pick<
  NumberFieldRootProps,
  "id" | "name" | "min" | "max" | "required" | "value" | "defaultValue" | "onValueChange"
> &
  Pick<NumberFieldInputProps, "ref" | "placeholder" | "aria-describedby" | "aria-invalid"> & {
    className?: string;
    decimal?: boolean;
    help?: string;
  };

const integerDraft = /^\d*$/;
const decimalDraft = /^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})?$/;

export function NumericInput({
  ref,
  className,
  decimal = false,
  placeholder,
  help,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: NumericInputProps) {
  const helpId = useId();

  function accepts(text: string) {
    const ungrouped = text.replace(/\p{Zs}/gu, "");
    const pattern = decimal ? decimalDraft : integerDraft;
    return (
      pattern.test(ungrouped) &&
      (ungrouped !== "" || text === "") &&
      Number.isFinite(Number(ungrouped.replace(",", ".")))
    );
  }

  const step = decimal ? 0.01 : 1;
  return (
    <NumberField.Root
      {...props}
      className={className ? `${styles.root} ${className}` : styles.root}
      locale="pl-PL"
      format={{ maximumFractionDigits: decimal ? 2 : 0 }}
      step={step}
      smallStep={step}
      allowOutOfRange
    >
      <NumberField.Input
        ref={ref}
        className={styles.input}
        data-has-help={Boolean(help) || undefined}
        inputMode={decimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        aria-describedby={help ? [describedBy, helpId].filter(Boolean).join(" ") : describedBy}
        aria-invalid={invalid}
        aria-roledescription="pole liczbowe"
        onChange={(event) => {
          if (!accepts(event.currentTarget.value)) event.preventBaseUIHandler();
        }}
        onPaste={(event) => {
          const input = event.currentTarget;
          const pasted = event.clipboardData.getData("text/plain");
          const next =
            input.value.slice(0, input.selectionStart ?? 0) +
            pasted +
            input.value.slice(input.selectionEnd ?? input.value.length);
          if (!accepts(next)) event.preventDefault();
        }}
      />
      {help ? <InputHelp id={helpId} text={help} className={styles.help} /> : null}
    </NumberField.Root>
  );
}
