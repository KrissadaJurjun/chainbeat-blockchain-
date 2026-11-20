import { Maximize2, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tip } from '@/components/ui/Tooltip';

interface PanZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canReset: boolean;
}

const btn =
  'grid size-8 place-items-center rounded-lg text-fg-2 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-cyan/40 disabled:cursor-not-allowed disabled:opacity-40';

/** Zoom in / zoom out / reset-view buttons for a pannable chart (the same actions as the keyboard shortcuts). */
export function PanZoomControls({ zoom, onZoomIn, onZoomOut, onReset, canReset }: PanZoomControlsProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('chart.zoomControls')} className="flex items-center gap-0.5 rounded-xl border border-line bg-card/70 p-0.5 backdrop-blur">
      <Tip label={t('chart.zoomOut')}>
        <button type="button" className={btn} onClick={onZoomOut} aria-label={t('chart.zoomOut')}>
          <Minus className="size-4" aria-hidden />
        </button>
      </Tip>
      <output className="min-w-[3.25rem] text-center text-[11.5px] font-medium tabular-nums text-fg-2" aria-label={t('chart.zoomLevel')}>
        {Math.round(zoom * 100)}%
      </output>
      <Tip label={t('chart.zoomIn')}>
        <button type="button" className={btn} onClick={onZoomIn} aria-label={t('chart.zoomIn')}>
          <Plus className="size-4" aria-hidden />
        </button>
      </Tip>
      <Tip label={t('chart.resetView')}>
        <button type="button" className={btn} onClick={onReset} disabled={!canReset} aria-label={t('chart.resetView')}>
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </Tip>
    </div>
  );
}
