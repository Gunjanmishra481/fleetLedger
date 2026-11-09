import { ImportForm } from "./import-form";

export default function ImportPage() {
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import loading sheet</h1>
        <p className="text-sm text-muted-foreground">
          Upload a monthly .xlsx laid out like SEP-26. Names are cleaned up and merged, the rate card is built from the
          most common values per route, and every issue is listed before anything is saved.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
