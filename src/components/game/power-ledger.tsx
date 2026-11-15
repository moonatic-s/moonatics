import { content } from "@/game/content";
import type { getLifeSupportBreakdown } from "@/game/engine";
import { fmt, signedFmt } from "@/game/life-support/format";
import type { ChannelKey } from "@/game/life-support/interpret";
import type { AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";

type Breakdown = ReturnType<typeof getLifeSupportBreakdown>;
const copy = content.lifeConsole;

/* ----------------------------- Power ledger --------------------------- */

const LEDGER_SCALE_KW = 8;
const CELL_KW = 0.5;
const SYSTEMS: {
  key: "scrubbers" | "thermostat" | "recycler";
  channel: ChannelKey;
}[] = [
  { key: "scrubbers", channel: "air" },
  { key: "thermostat", channel: "heat" },
  { key: "recycler", channel: "water" },
];

export function PowerLedger({
  mode,
  power,
  battery,
}: {
  mode: AgeMode;
  power: Breakdown["power"];
  battery: {
    pct: number;
    waterL: number;
    waterMaxL: number;
    waterDelta: number;
  };
}) {
  const { generationKw, drawKw, demandKw, netKw, batteryDeltaPerStep } = power;
  const charging = netKw >= 0;
  const cells: { channel: ChannelKey; over: boolean }[] = [];
  let cumulative = 0;
  let placed = 0;
  for (const { key, channel } of SYSTEMS) {
    cumulative += drawKw[key];
    const upTo = Math.round(cumulative / CELL_KW);
    for (; placed < upTo; placed += 1)
      cells.push({
        channel,
        over: (placed + 1) * CELL_KW > generationKw + 0.001,
      });
  }
  const solarCells = Math.round(generationKw / CELL_KW);
  return (
    <section className="ledger" aria-label={copy.ledger.title}>
      <h2 className="panel-title">{copy.ledger.title}</h2>
      {mode === "explorer" ? (
        <>
          <div
            className="cells"
            role="img"
            aria-label={copy.ledger.explorerLine(cells.length, solarCells)}
          >
            {Array.from({ length: LEDGER_SCALE_KW / CELL_KW }, (_, i) => {
              const cell = cells[i];
              return (
                <span
                  key={i}
                  className={cn(
                    "cell",
                    cell && `cell-${cell.channel}`,
                    cell?.over && "cell-over",
                    i === solarCells - 1 && "cell-solar-end",
                  )}
                />
              );
            })}
          </div>
          <p className="ledger-line">
            {copy.ledger.explorerLine(cells.length, solarCells)}
          </p>
        </>
      ) : (
        <>
          <div
            className="stack"
            role="img"
            aria-label={`${fmt(demandKw, 2)} kW used of ${fmt(generationKw, 2)} kW solar`}
          >
            {SYSTEMS.map(({ key, channel }) => (
              <span
                key={key}
                className={`stack-seg seg-${channel}`}
                style={{ width: `${(drawKw[key] / LEDGER_SCALE_KW) * 100}%` }}
              />
            ))}
            <span
              className="stack-solar"
              style={{ left: `${(generationKw / LEDGER_SCALE_KW) * 100}%` }}
            >
              <b>
                {copy.ledger.solar} {fmt(generationKw, 1)}
              </b>
            </span>
          </div>
          <ul className="ledger-legend">
            {SYSTEMS.map(({ key, channel }) => (
              <li key={key} className={`legend-${channel}`}>
                <i />
                <span>{copy.channels[channel].lever}</span>
                <b>
                  {fmt(drawKw[key], 2)} {copy.ledger.unit}
                </b>
              </li>
            ))}
          </ul>
          <p className="ledger-line">
            {copy.ledger.draw} {fmt(demandKw, 2)} {copy.ledger.unit} ·{" "}
            {copy.ledger.solar} {fmt(generationKw, 2)} {copy.ledger.unit} · Net{" "}
            {signedFmt(netKw, 2)} {copy.ledger.unit}
          </p>
        </>
      )}
      <p
        className={cn(
          "ledger-verdict",
          charging ? "verdict-good" : "verdict-warn",
        )}
      >
        {charging ? copy.ledger.surplus : copy.ledger.deficit}
      </p>
      <div className="ledger-meters">
        <Meter
          label={copy.ledger.battery}
          pct={battery.pct}
          text={
            mode === "specialist"
              ? `${fmt(battery.pct, 0)} % (${signedFmt(batteryDeltaPerStep, 1)} ${copy.ledger.per6h})`
              : `${fmt(battery.pct, 0)} %`
          }
        />
        <Meter
          label={copy.ledger.tank}
          pct={(battery.waterL / battery.waterMaxL) * 100}
          text={
            mode === "specialist"
              ? `${fmt(battery.waterL, 1)} L (${signedFmt(battery.waterDelta, 1)} ${copy.ledger.per6h})`
              : `${fmt(battery.waterL, 0)} L`
          }
        />
      </div>
    </section>
  );
}

function Meter({
  label,
  pct,
  text,
}: {
  label: string;
  pct: number;
  text: string;
}) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <b>{text}</b>
    </div>
  );
}
