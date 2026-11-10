// The invoice as a document: same rows, columns, bands and borders as the Excel reference
// (src/server/invoice/layout.json), sized relative to its own width so it scales on any screen
// and prints on A4 portrait. Presentational only; totals come from computeInvoice().
import Image from "next/image";
import signature from "@/config/signature";
import { amountInWords } from "@/server/invoice/maths";
import type { InvoiceTotals } from "@/server/invoice/maths";
import type { BuyerDetails, InvoiceLine } from "@/server/invoice/reference";
import type { SellerSnapshot } from "@/server/invoice/xlsx";
import { cn } from "@/lib/utils";

export type PaperDoc = {
  seller: SellerSnapshot;
  buyer: BuyerDetails;
  number: string;
  invoiceDate: Date;
  period: string;
  placeOfSupply: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
};

// Excel column widths A..K from the reference.
const COLS = [1.75, 7.8, 11.57, 7.26, 5.78, 10.22, 16.54, 24.75, 12.51, 10.49, 12.51];
const SUM = COLS.reduce((a, b) => a + b, 0);
const MIN_ROWS = 18; // line rows before the closing row, as in the reference

const inr = (paise: number, decimals = false) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(paise / 100);
const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = (d: Date) =>
  `${d.getUTCDate()}-${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}-${String(d.getUTCFullYear()).slice(2)}`;

export function InvoicePaper({ doc, watermark, className }: { doc: PaperDoc; watermark?: string; className?: string }) {
  const { seller: s, buyer: b, totals: t } = doc;
  const lines = doc.lines;
  const blank = Math.max(0, MIN_ROWS - lines.length);
  const vins = lines.reduce((n, l) => n + l.vins, 0);
  // Cell helpers. Borders: m = medium (2px), t = thin (1px).
  const B = "border-black";
  return (
    <div className={cn("invoice-paper @container relative bg-white text-black", className)}>
      {watermark && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-24deg] text-[11cqw] font-black tracking-widest text-black/[0.07] uppercase">{watermark}</span>
        </div>
      )}
      <table className="w-full table-fixed border-collapse font-[Calibri,Carlito,'Segoe_UI',sans-serif] text-[1.3cqw] leading-[1.35]" role="presentation">
        <colgroup>
          {COLS.map((w, i) => (
            <col key={i} style={{ width: `${(w / SUM) * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td />
            <td colSpan={10} className={cn("border-x-2 border-t-2 py-[0.3cqw] text-center text-[2.6cqw] font-bold", B)}>
              INVOICE
            </td>
          </tr>
          <tr>
            <td />
            <td colSpan={5} className={cn("border-l-2 bg-[#44546a] px-[0.4cqw] font-bold text-white", B)}>
              BILL FROM
            </td>
            <td className="bg-[#44546a] px-[0.4cqw] font-bold text-white">Bill To:</td>
            <td colSpan={3} />
            <td className={cn("border-r-2", B)} />
          </tr>
          {/* Seller / buyer / meta block, rows 3–11 */}
          {[
            [s.name, b.billingName, "Date:", longDate(doc.invoiceDate)],
            [s.addressLines[0], b.addressLines[0], "Invoice No :", doc.number],
            [s.addressLines[1], b.addressLines.slice(1).join(", "), "Contact  No", s.contactNo],
            [s.addressLines[2], b.gstin ? `GSTNN: ${b.gstin}` : "", "Period", doc.period],
            [`Phone: ${s.phone}`, b.pan ? `PAN: ${b.pan}` : "", "", ""],
            [`STATE CODE- ${s.stateCode}`, b.state ? `STATE: ${b.state}` : "", "", ""],
            [`PAN NO: ${s.pan}`, b.stateCode ? `STATE CODE: ${b.stateCode}` : "", "", ""],
            [`GST NO-${s.gstin}`, "", "Place of Supply: ", doc.placeOfSupply],
          ].map(([left, mid, label, value], i) => (
            <tr key={i} className={i === 0 ? "h-[2.4cqw]" : ""}>
              <td />
              <td colSpan={5} className={cn("border-l-2 px-[0.4cqw] align-top font-bold", B)}>
                {left}
              </td>
              <td colSpan={2} className="px-[0.4cqw] align-top font-bold">
                {mid}
              </td>
              <td className="px-[0.4cqw] align-top">{label}</td>
              <td colSpan={2} className={cn("border-r-2 px-[0.4cqw] align-top", B, label === "Place of Supply: " && "text-right")}>
                {value}
              </td>
            </tr>
          ))}
          <tr>
            <td />
            <td className={cn("border-b-2 border-l-2 px-[0.4cqw] font-bold", B)}>SAC Code</td>
            <td className={cn("border-b-2 px-[0.4cqw] font-bold", B)}>{s.sacCode}</td>
            <td colSpan={8} className={cn("border-r-2", B)} />
          </tr>
          <tr className="h-[1.4cqw]">
            <td />
            <td colSpan={10} className={cn("border-x-2", B)} />
          </tr>

          {/* Lines */}
          <tr className="text-[1.08cqw] font-bold">
            <td />
            {["Sno", "Car Carrier No", "Model/Type", "LR No.", "NO OF VINS CARRIED", "Place of Handling of goods(state code)", "Place of Delviery( state code)", "TPTR", "Disp Date", "Amount"].map((h, i) => (
              <td key={h} className={cn("border-t-2 border-l-2 px-[0.2cqw] py-[0.3cqw] text-center align-middle", B, i === 9 && "border-r-2")}>
                {h}
              </td>
            ))}
          </tr>
          {lines.map((l, i) => (
            <tr key={`${l.lrNo}-${i}`} className="text-[0.98cqw] italic">
              <td />
              {[i + 1, l.carrierNo, l.model ?? "", l.lrNo, l.vins, l.handling ?? "", l.delivery, l.tptr ?? "", shortDate(l.dispDate), inr(l.amount)].map((v, j) => (
                <td key={j} className={cn("border px-[0.2cqw] text-center", B, j === 0 && "border-l-2", j === 9 && "border-r-2")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: blank }, (_, i) => (
            <tr key={`blank-${i}`} className="h-[1.6cqw]">
              <td />
              {COLS.slice(1).map((_, j) => (
                <td key={j} className={cn("border", B, j === 0 && "border-l-2", j === 9 && "border-r-2")} />
              ))}
            </tr>
          ))}
          <tr className="h-[1.6cqw]">
            <td />
            <td colSpan={10} className={cn("border-x-2", B)} />
          </tr>

          {/* Totals */}
          <tr className="text-[1.08cqw]">
            <td />
            <td colSpan={3} className={cn("border-l-2", B)} />
            <td className={cn("border-y-2 border-x text-center font-bold", B)}>Total</td>
            <td className={cn("border-y-2 border-x text-center font-bold", B)}>{vins}</td>
            <td colSpan={3} />
            <td className={cn("border-y-2 border-r px-[0.3cqw] font-bold", B)}>Sub Total</td>
            <td className={cn("border-y-2 border-r-2 border-l px-[0.3cqw] text-right text-[1.19cqw]", B)}>{inr(t.subtotal)}</td>
          </tr>
          {[
            ["IGST 18%", t.intraState ? null : t.igst],
            ["CGST 9%", t.intraState ? t.cgst : null],
            ["SGST 9%", t.intraState ? t.sgst : null],
          ].map(([label, v]) => (
            <tr key={label as string} className="text-[1.08cqw]">
              <td />
              <td colSpan={8} className={cn("border-l-2", B)} />
              <td className={cn("border-y border-r px-[0.3cqw] font-bold text-[#ff0000]", B)}>{label}</td>
              <td className={cn("border-y border-r-2 border-l px-[0.3cqw] text-right text-[1.19cqw]", B)}>{v === null ? "" : inr(v as number, true)}</td>
            </tr>
          ))}
          <tr className="text-[0.98cqw]">
            <td />
            <td className={cn("border-y-2 border-l-2 px-[0.3cqw] text-[0.87cqw]", B)}>Amount in words</td>
            <td colSpan={7} className={cn("border-y-2 border-r-2 px-[0.3cqw] text-center", B)}>
              {amountInWords(t.total / 100)}
            </td>
            <td className={cn("border-t border-b-2 border-r px-[0.3cqw] text-[1.08cqw] font-bold text-[#ff0000]", B)}>Round off</td>
            <td className={cn("border-t border-b-2 border-r-2 border-l px-[0.3cqw] text-right text-[1.19cqw]", B)}>{t.roundOff === 0 ? "" : inr(t.roundOff, true)}</td>
          </tr>
          <tr className="text-[1.08cqw]">
            <td />
            <td colSpan={8} className={cn("border-l-2 px-[0.3cqw] font-bold", B)}>
              <span className="inline-block bg-[#44546a] px-[0.4cqw] text-white">Declaration:</span>
            </td>
            <td className={cn("border-x px-[0.3cqw] font-bold text-[#ff0000]", B)}>Total</td>
            <td className={cn("border-r-2 border-l px-[0.3cqw] text-right text-[1.19cqw] font-bold", B)}>{inr(t.total)}</td>
          </tr>

          {/* Bank + signature */}
          <tr className="text-[1.08cqw]">
            <td />
            <td colSpan={8} className={cn("border-t-2 border-l-2 px-[0.4cqw] font-['Calibri_Light',Calibri,sans-serif] font-bold underline", B)}>
              Please wire transfer in INR to :
            </td>
            <td colSpan={2} className={cn("border-t-2 border-r-2", B)} />
          </tr>
          {[
            ["Beneficiary Name", s.bank.beneficiary],
            ["Account Number", s.bank.accountNo],
            ["IFSC Code", s.bank.ifsc],
            ["Bank", s.bank.bankName],
          ].map(([k, v], i) => (
            <tr key={k} className="text-[1.19cqw] font-bold">
              <td />
              <td colSpan={4} className={cn("border-l-2 px-[0.4cqw]", B)}>
                {k}
              </td>
              <td colSpan={4} className="px-[0.4cqw]">
                {v}
              </td>
              <td colSpan={2} className={cn("relative border-r-2 px-[0.4cqw] text-[1.08cqw]", B)}>
                {i === 0 && s.name}
                {i === 1 && (
                  <span className="absolute top-[0.2cqw] left-[0.1cqw] block w-[12.5cqw]">
                    <Image src={signature} alt="Signature" className="h-auto w-full" />
                  </span>
                )}
              </td>
            </tr>
          ))}
          <tr className="text-[1.08cqw] font-bold">
            <td />
            <td colSpan={8} className={cn("border-b-2 border-l-2", B)} />
            <td colSpan={2} className={cn("border-t border-r-2 border-b-2 px-[0.4cqw]", B)}>
              Authorized Signatory
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
