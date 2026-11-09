import { cn } from "@/lib/utils";

/** Splits "NL01AL1658" into ["NL01AL", "1658"]; anything without 4 trailing digits stays whole. */
export function splitPlate(regNo: string): [string, string] {
  const m = /^(.*?)(\d{4})$/.exec(regNo);
  return m ? [m[1], m[2]] : [regNo, ""];
}

const SIZES = {
  sm: { box: "h-7 px-2 gap-1 rounded-md border-[1.5px]", pre: "text-[10px]", last: "text-sm" },
  md: { box: "h-9 px-2.5 gap-1.5 rounded-lg border-2", pre: "text-xs", last: "text-lg" },
  lg: { box: "h-14 px-4 gap-2 rounded-xl border-[3px]", pre: "text-base", last: "text-3xl" },
};

/** Indian commercial number plate: yellow, black bold text, last four digits large. */
export function NumberPlate({
  regNo,
  size = "md",
  className,
}: {
  regNo: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [pre, last] = splitPlate(regNo);
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border-plate-ink bg-plate font-bold leading-none tracking-wide text-plate-ink num",
        s.box,
        className,
      )}
      aria-label={`Trailer ${regNo}`}
    >
      <span className={s.pre} aria-hidden>
        {pre}
      </span>
      {last && (
        <span className={cn(s.last, "tracking-tight")} aria-hidden>
          {last}
        </span>
      )}
    </span>
  );
}
