import { PackagePlus } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { stormStatus } from "@/game/storm/model";

/** One shared budget across the whole training: water, power, supplies and food, with what this mission has spent. */
export function Ledger({ mission, mode }: { mission: "m2" | "m3"; mode: AgeMode }) {
  const { sim, story, callSupplyDrop } = useGame();
  const { water, power } = sim.subSystems;
  const start = useRef({ water: water.reserveLiters, power: power.batteryPct });
  const spentWater = Math.max(0, start.current.water - water.reserveLiters);
  const spentPower = Math.max(0, start.current.power - power.batteryPct);
  const st = mission === "m3" ? stormStatus(sim) : null;
  const inv = sim.subSystems.radiation.shelterInventory;
  const placed = st ? st.shelterCounts.water + st.shelterCounts.supply + st.shelterCounts.equipment : 0;
  const total = inv.water + inv.supply + inv.equipment;
  const used = story.run.supplyDropUsed;
  const stormLocked = mission === "m3" && sim.subSystems.radiation.stormPhase >= 4;
  const rows = [
    { key: "water", label: "WATER", value: `${water.reserveLiters.toFixed(1)} L`, pct: (water.reserveLiters / water.maxLiters) * 100, note: spentWater > 0.05 ? `${spentWater.toFixed(1)} L used here` : "" },
    { key: "power", label: "POWER", value: `${Math.round(power.batteryPct)}%`, pct: power.batteryPct, note: spentPower >= 1 ? `${Math.round(spentPower)}% used here` : "" },
    mission === "m3"
      ? { key: "supplies", label: "SUPPLIES", value: `${placed} / ${total} placed`, pct: total > 0 ? (placed / total) * 100 : 0, note: "shelter material" }
      : { key: "supplies", label: "HARVEST", value: `${sim.subSystems.greenhouse.estimatedRipeFruits} tomatoes`, pct: Math.min(100, sim.subSystems.greenhouse.estimatedRipeFruits * 20), note: "becomes shelter supplies later" },
    { key: "food", label: "FOOD", value: `${Math.round(sim.resources.foodProduction)}%`, pct: sim.resources.foodProduction, note: "" },
  ];
  return (
    <section className="ledger" aria-label="Outpost ledger">
      <h3>OUTPOST LEDGER</h3>
      <ul>
        {rows.map((r) => (
          <li key={r.key}>
            <span className="ledger-label">{r.label}</span>
            <span className="ledger-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} className={cn(r.pct < 25 && "low")} />
            </span>
            <b>{r.value}</b>
            {mode === "specialist" && r.note && <small>{r.note}</small>}
          </li>
        ))}
      </ul>
      {!stormLocked && (
        <div className="ledger-drop">
          <Button variant="outline" disabled={used} onClick={() => callSupplyDrop()} title="One supply drop per training. It helps now and counts against your efficiency.">
            <PackagePlus size={16} aria-hidden="true" />
            {used ? "SUPPLY DROP USED" : mission === "m2" ? "CALL SUPPLY DROP (+12 L WATER)" : "CALL SUPPLY DROP (+1 POWER BLOCK)"}
          </Button>
          <small>One per training. It helps now and costs a little efficiency.</small>
        </div>
      )}
    </section>
  );
}
