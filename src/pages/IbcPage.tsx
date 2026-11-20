import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeftRight, Link2, Network, Waypoints } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChainGem } from "@/components/brand/Logo";
import { PanZoomControls } from "@/components/charts/PanZoomControls";
import { DemoBadge } from "@/components/ui/Demo";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { useIbc } from "@/hooks/useChainData";
import { useFormat } from "@/hooks/useFormat";
import { usePanZoom } from "@/hooks/usePanZoom";
import { cn } from "@/lib/utils";

const W = 800;
const H = 520;

/** Interactive IBC map: chains are nodes, channels are edges sized by 24 h transfer volume. */
export default function IbcPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const uid = useId().replace(/:/g, "");
  const { data, isLoading, isError, refetch } = useIbc();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = hovered ?? selected;
  const pz = usePanZoom(W, H);

  const model = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.nodes.map((n) => [n.id, n] as const));
    const maxLink = Math.max(...data.links.map((l) => l.volume24hUsd), 1);
    const maxNode = Math.max(...data.nodes.map((n) => n.volume24hUsd), 1);
    const top = [...data.links].sort(
      (a, b) => b.volume24hUsd - a.volume24hUsd,
    )[0];
    return { byId, maxLink, maxNode, top };
  }, [data]);

  const channels = useMemo(() => {
    if (!data) return [];
    return [...data.links]
      .filter((l) => !focus || l.a === focus || l.b === focus)
      .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
      .slice(0, 10);
  }, [data, focus]);

  const focusNode = focus && model ? model.byId.get(focus) : undefined;
  const partner = useMemo(() => {
    if (!data || !focus || !model) return undefined;
    const best = data.links
      .filter((l) => l.a === focus || l.b === focus)
      .sort((a, b) => b.volume24hUsd - a.volume24hUsd)[0];
    return best
      ? model.byId.get(best.a === focus ? best.b : best.a)
      : undefined;
  }, [data, focus, model]);

  const toggle = (id: string): void => {
    if (pz.consumeDrag()) return; // the click that ends a pan is not a selection
    setSelected((s) => (s === id ? null : id));
  };
  const onKey = (e: KeyboardEvent, id: string): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(id);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("navigation.ibcNetwork")}
        description={t("ibcPage.description")}
        badge={<DemoBadge label={t("common.simulated")} />}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ArrowLeftRight}
          label={t("ibcPage.volume")}
          value={data ? fmt.usdCompact(data.totalVolume24hUsd) : "–"}
          loading={isLoading}
        />
        <StatCard
          icon={Network}
          label={t("ibcPage.chains")}
          value={data ? fmt.integer(data.nodes.length) : "–"}
          loading={isLoading}
        />
        <StatCard
          icon={Link2}
          label={t("ibcPage.links")}
          value={data ? fmt.integer(data.links.length) : "–"}
          loading={isLoading}
        />
        <StatCard
          icon={Waypoints}
          label={t("ibcPage.busiest")}
          value={
            model?.top
              ? `${model.byId.get(model.top.a)?.symbol} ↔ ${model.byId.get(model.top.b)?.symbol}`
              : "–"
          }
          hint={model?.top ? fmt.usdCompact(model.top.volume24hUsd) : undefined}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="p-3 sm:p-4">
          {isLoading ? (
            <Skeleton className="aspect-[800/520] w-full" />
          ) : isError || !data || !model ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <div className="relative">
              <div className="absolute end-2 top-2 z-10">
                <PanZoomControls
                  zoom={pz.view.k}
                  onZoomIn={pz.zoomIn}
                  onZoomOut={pz.zoomOut}
                  onReset={pz.reset}
                  canReset={pz.canReset}
                />
              </div>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full select-none"
                role="group"
                aria-label={t("ibcPage.mapLabel")}
                style={{
                  direction: "ltr",
                  cursor: pz.dragging ? "grabbing" : "grab",
                  touchAction: "pan-y pinch-zoom",
                }}
                {...pz.handlers}
              >
                <defs>
                  {data.links.map((l, i) => {
                    const a = model.byId.get(l.a);
                    const b = model.byId.get(l.b);
                    if (!a || !b) return null;
                    return (
                      <linearGradient
                        key={i}
                        id={`${uid}-l${i}`}
                        gradientUnits="userSpaceOnUse"
                        x1={a.x * W}
                        y1={a.y * H}
                        x2={b.x * W}
                        y2={b.y * H}
                      >
                        <stop offset="0" stopColor={a.gradient[0]} />
                        <stop offset="1" stopColor={b.gradient[0]} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <g
                  transform={`translate(${pz.view.x} ${pz.view.y}) scale(${pz.view.k})`}
                >
                  <g>
                    {data.links.map((l, i) => {
                      const a = model.byId.get(l.a);
                      const b = model.byId.get(l.b);
                      if (!a || !b) return null;
                      const ax = a.x * W;
                      const ay = a.y * H;
                      const bx = b.x * W;
                      const by = b.y * H;
                      const cx = (ax + bx) / 2 + (W / 2 - (ax + bx) / 2) * 0.28;
                      const cy = (ay + by) / 2 + (H / 2 - (ay + by) / 2) * 0.28;
                      const active = !focus || l.a === focus || l.b === focus;
                      return (
                        <path
                          key={i}
                          d={`M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`}
                          fill="none"
                          stroke={`url(#${uid}-l${i})`}
                          strokeWidth={
                            1 + 6 * Math.sqrt(l.volume24hUsd / model.maxLink)
                          }
                          strokeLinecap="round"
                          opacity={active ? 0.6 : 0.07}
                          style={{ transition: "opacity 180ms" }}
                        />
                      );
                    })}
                  </g>
                  {data.nodes.map((n) => {
                    const r =
                      17 + 13 * Math.sqrt(n.volume24hUsd / model.maxNode);
                    const x = n.x * W;
                    const y = n.y * H;
                    const isFocus = focus === n.id;
                    const dim =
                      focus &&
                      !isFocus &&
                      !data.links.some(
                        (l) =>
                          (l.a === focus && l.b === n.id) ||
                          (l.b === focus && l.a === n.id),
                      );
                    return (
                      <g
                        key={n.id}
                        transform={`translate(${x} ${y})`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected === n.id}
                        aria-label={t("ibcPage.nodeLabel", {
                          name: n.name,
                          volume: fmt.usdCompact(n.volume24hUsd),
                          channels: n.channels,
                        })}
                        onClick={() => toggle(n.id)}
                        onKeyDown={(e) => onKey(e, n.id)}
                        onPointerEnter={() => setHovered(n.id)}
                        onPointerLeave={() => setHovered(null)}
                        onFocus={() => setHovered(n.id)}
                        onBlur={() => setHovered(null)}
                        style={{
                          cursor: "pointer",
                          outline: "none",
                          opacity: dim ? 0.3 : 1,
                          transition: "opacity 180ms",
                        }}
                      >
                        <circle
                          r={r + 7}
                          fill={n.gradient[0]}
                          opacity={isFocus ? 0.22 : 0.1}
                        />
                        <circle
                          r={r}
                          fill="var(--c-panel-hi)"
                          stroke={isFocus ? "var(--c-fg)" : n.gradient[0]}
                          strokeWidth={isFocus ? 2.5 : 1.5}
                        />
                        <foreignObject
                          x={-9}
                          y={-9}
                          width={18}
                          height={18}
                          aria-hidden
                        >
                          <ChainGem
                            gradient={n.gradient}
                            className="size-[18px]"
                          />
                        </foreignObject>
                        <text
                          y={r + 17}
                          textAnchor="middle"
                          fontSize="13"
                          fontWeight="600"
                          fill="var(--c-fg)"
                          stroke="var(--c-panel)"
                          strokeWidth="4"
                          paintOrder="stroke"
                          strokeLinejoin="round"
                        >
                          {n.name}
                        </text>
                        <text
                          y={r + 32}
                          textAnchor="middle"
                          fontSize="11"
                          fill="var(--c-fg-3)"
                          stroke="var(--c-panel)"
                          strokeWidth="4"
                          paintOrder="stroke"
                          strokeLinejoin="round"
                        >
                          {fmt.usdCompact(n.volume24hUsd)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
          <p className="mt-2 text-center text-[11.5px] text-fg-3">
            {t("ibcPage.hint")}
          </p>
        </Panel>

        <Panel className="p-4">
          {focusNode && data ? (
            <div className="mb-4 rounded-xl border border-line bg-card/40 p-3">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
                <ChainGem gradient={focusNode.gradient} className="size-5" />{" "}
                {focusNode.name}{" "}
                <span className="text-[11.5px] font-normal text-fg-3">
                  {focusNode.symbol}
                </span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                <div>
                  <dt className="text-fg-3">{t("ibcPage.info.volume")}</dt>
                  <dd className="font-medium tabular-nums text-fg">
                    {fmt.usdCompact(focusNode.volume24hUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-3">{t("ibcPage.info.channels")}</dt>
                  <dd className="font-medium tabular-nums text-fg">
                    {fmt.integer(focusNode.channels)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-3">{t("ibcPage.info.share")}</dt>
                  <dd className="font-medium tabular-nums text-fg">
                    {fmt.percent(
                      focusNode.volume24hUsd /
                        Math.max(1, data.totalVolume24hUsd),
                      0,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-3">{t("ibcPage.info.partner")}</dt>
                  <dd className="font-medium text-fg">
                    {partner?.name ?? "–"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
          <h2 className="font-display text-[15px] font-semibold">
            {focus && model
              ? t("ibcPage.channelsOf", {
                  name: model.byId.get(focus)?.name ?? "",
                })
              : t("ibcPage.topChannels")}
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {isLoading
              ? Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="py-2">
                    <Skeleton className="h-9" />
                  </li>
                ))
              : channels.map((l) => (
                  <li
                    key={`${l.a}-${l.b}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-[13px] font-medium text-fg",
                        )}
                      >
                        {model?.byId.get(l.a)?.name} ↔{" "}
                        {model?.byId.get(l.b)?.name}
                      </span>
                      <span className="ltr-isolate block font-mono text-[11px] text-fg-3">
                        {l.channel}
                      </span>
                    </span>
                    <span className="text-end">
                      <span className="block text-[13px] font-semibold tabular-nums text-fg">
                        {fmt.usdCompact(l.volume24hUsd)}
                      </span>
                      <span className="block text-[11px] tabular-nums text-fg-3">
                        {t("ibcPage.transfers", { count: l.transfers24h })}
                      </span>
                    </span>
                  </li>
                ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
