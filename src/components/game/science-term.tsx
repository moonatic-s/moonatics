import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { content } from "@/game/content";
import type { AgeMode } from "@/game/state";

export type ScienceTermKey = keyof typeof content.lifeConsole.science.terms;
const copy = content.lifeConsole.science;

/** A small "?" that opens a short explanation of a science term in place, with no separate page. */
export function ScienceTerm({
  term,
  label,
  mode,
}: {
  term: ScienceTermKey;
  label: string;
  mode: AgeMode;
}) {
  const entry = copy.terms[term];
  const text = entry[mode];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="science-open"
          aria-label={copy.open(label)}
        >
          <CircleHelp size={15} />
        </Button>
      </DialogTrigger>
      <DialogContent className="science-dialog">
        <DialogTitle className="science-title">{entry.title}</DialogTitle>
        <DialogDescription className="science-body">
          {text.body}
        </DialogDescription>
        <div className="science-why">
          <span className="science-why-label">{copy.why}</span>
          <p>{text.why}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
