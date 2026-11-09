import { Truck } from "lucide-react";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const field =
    "h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20";
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Truck className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">FleetLedger</h1>
            <p className="text-sm text-muted-foreground">Trips, costs and profit for your fleet</p>
          </div>
        </div>
        <form action={login} className="card-surface space-y-4 p-6">
          <input type="hidden" name="next" value={next ?? ""} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">User</span>
            <input name="user" autoComplete="username" autoCapitalize="none" autoFocus required className={field} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <input name="password" type="password" autoComplete="current-password" required className={field} />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-loss-soft px-3 py-2 text-sm text-loss">
              Wrong user or password.
            </p>
          )}
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.99]"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
