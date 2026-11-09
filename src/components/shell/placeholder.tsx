import { formatMonthKey } from "@/lib/format";
import { parseMonth } from "@/lib/month";

/** Temporary page body until the module is built in a later milestone. */
export async function Placeholder({
  title,
  searchParams,
  comingIn,
}: {
  title: string;
  searchParams: Promise<{ m?: string }>;
  comingIn: string;
}) {
  const month = parseMonth((await searchParams).m);
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {formatMonthKey(month)} · coming in {comingIn}
      </p>
    </div>
  );
}
