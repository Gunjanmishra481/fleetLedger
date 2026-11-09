// PNG app icons rendered with next/og, so no image files or tools are needed.
//   /icons/icon-192.png, /icons/icon-512.png, /icons/maskable-512.png, /icons/apple-180.png
import { ImageResponse } from "next/og";

const TEAL = "#1f6f73";

function Truck({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^(icon|maskable|apple)-(\d+)\.png$/.exec(file);
  const size = m ? Number(m[2]) : 0;
  if (!m || ![180, 192, 512].includes(size)) return new Response("Not found", { status: 404 });
  const kind = m[1];
  // Maskable icons need the glyph inside the central 80% safe zone and a full-bleed background.
  const glyph = Math.round(size * (kind === "maskable" ? 0.45 : 0.58));
  const radius = kind === "icon" ? Math.round(size * 0.22) : 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: TEAL, borderRadius: radius }}>
        <Truck size={glyph} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
