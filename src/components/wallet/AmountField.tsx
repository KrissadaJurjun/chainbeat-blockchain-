import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, Input, fieldAria } from '@/components/ui/Field';
import { useFormat } from '@/hooks/useFormat';
import { cn } from '@/lib/utils';

interface AmountFieldProps {
  id: string;
  label: ReactNode;
  register?: UseFormRegisterReturn;
  error?: string;
  balance?: number;
  symbol?: string;
  onMax?: () => void;
  /** Rendered inside the field's right edge, e.g. a token symbol or select. */
  trailing?: ReactNode;
  readOnly?: boolean;
  value?: string;
  placeholder?: string;
  hint?: ReactNode;
}

/** Decimal amount input with an optional balance line and "Max" shortcut. */
export function AmountField({ id, label, register, error, balance, symbol, onMax, trailing, readOnly, value, placeholder = '0.00', hint }: AmountFieldProps) {
  const { t } = useTranslation();
  const fmt = useFormat();
  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      aside={
        balance !== undefined ? (
          <span className="flex items-center gap-2 text-[11.5px] text-fg-3">
            {t('common.balance')}: <span className="tabular-nums text-fg-2">{fmt.token(balance, symbol ?? '', 6)}</span>
            {onMax ? (
              <button type="button" onClick={onMax} className="rounded-md border border-line-strong px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-cyan transition-colors hover:bg-hover">
                {t('common.max')}
              </button>
            ) : null}
          </span>
        ) : undefined
      }
    >
      <div className="relative">
        <Input
          {...fieldAria(id, error, Boolean(hint))}
          {...register}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          readOnly={readOnly}
          value={value}
          placeholder={placeholder}
          className={cn('tabular-nums', trailing && 'pe-24', readOnly && 'bg-transparent')}
        />
        {trailing ? <div className="absolute inset-y-0 end-3 flex items-center text-[12px] font-semibold text-fg-2">{trailing}</div> : null}
      </div>
    </Field>
  );
}
