import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/Copy';
import { cn } from '@/lib/utils';

interface NodeProps {
  name?: string;
  value: unknown;
  depth: number;
  openAll: boolean;
}

function Scalar({ value }: { value: unknown }) {
  if (typeof value === 'string') return <span className="break-all text-green">&quot;{value}&quot;</span>;
  if (typeof value === 'number') return <span className="text-cyan">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-purple">{String(value)}</span>;
  return <span className="text-fg-3">null</span>;
}

function JsonNode({ name, value, depth, openAll }: NodeProps) {
  const expandable = value !== null && typeof value === 'object';
  const [open, setOpen] = useState(openAll || depth < 1);
  const label = name === undefined ? null : <span className="text-fg-2">{name}: </span>;

  if (!expandable) {
    return (
      <div className="py-px ps-5">
        {label}
        <Scalar value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  const [openBrace, closeBrace] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return (
    <div className="py-px">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded text-start hover:bg-hover/60">
        <ChevronRight className={cn('size-3.5 shrink-0 text-fg-3 transition-transform rtl:rotate-180', open && 'rotate-90 rtl:rotate-90')} aria-hidden />
        <span>
          {label}
          <span className="text-fg-3">{openBrace}</span>
          {!open ? (
            <span className="text-fg-3">
              {' '}…{entries.length}{' '}
              {closeBrace}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <>
          <div className="ms-2 border-s border-line ps-2">
            {entries.map(([k, v]) => (
              <JsonNode key={k} name={Array.isArray(value) ? undefined : k} value={v} depth={depth + 1} openAll={openAll} />
            ))}
          </div>
          <div className="ps-5 text-fg-3">{closeBrace}</div>
        </>
      ) : null}
    </div>
  );
}

/** A collapsible JSON tree (always left-to-right) with expand all / collapse all and a copy button. */
export function JsonViewer({ data, caption }: { data: unknown; caption: string }) {
  const { t } = useTranslation();
  const [openAll, setOpenAll] = useState(false);
  const [version, setVersion] = useState(0);
  const apply = (all: boolean): void => {
    setOpenAll(all);
    setVersion((v) => v + 1); // new key: every node re-mounts with the requested state
  };
  return (
    <div className="rounded-xl border border-line bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2">
        <p className="text-[12.5px] font-medium text-fg-2">{caption}</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => apply(true)}>
            {t('common.expandAll')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => apply(false)}>
            {t('common.collapseAll')}
          </Button>
          <CopyButton value={JSON.stringify(data, null, 2)} label={t('common.copyJson')} />
        </div>
      </div>
      <div dir="ltr" role="group" aria-label={caption} className="max-h-[480px] overflow-auto p-3.5 font-mono text-[11.5px] leading-relaxed text-fg">
        <JsonNode key={version} value={data} depth={0} openAll={openAll} />
      </div>
    </div>
  );
}
