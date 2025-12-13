// templates/fortress/invoice-extractor.ts
// FILE: src/lib/invoice-extractor.ts

export type Currency = "SEK" | "EUR" | "USD" | "GBP" | string;

export type Money = {
  amount: number;
  currency: Currency;
};

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
};

export type InvoiceExtraction = {
  invoiceNumber?: string;
  invoiceDate?: string; // ISO-like string if detected
  dueDate?: string;
  vendorName?: string;
  total?: Money;
  subtotal?: Money;
  tax?: Money;
  lineItems: InvoiceLineItem[];
  rawText?: string;
  warnings: string[];
};

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function detectCurrency(text: string): Currency {
  const t = text.toUpperCase();
  if (t.includes(" SEK") || t.includes("KR") || t.includes("KSEK")) return "SEK";
  if (t.includes(" EUR") || t.includes("€")) return "EUR";
  if (t.includes(" USD") || t.includes("$")) return "USD";
  if (t.includes(" GBP") || t.includes("£")) return "GBP";
  return "SEK";
}

function parseAmount(raw: string): number {
  // Handles: "1 234,56" "1234.56" "1,234.56" "1234"
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  // If both comma and dot exist, assume dot is decimal if last dot is after last comma
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastDot > lastComma
        ? cleaned.replace(/,/g, "")           // "1,234.56" -> "1234.56"
        : cleaned.replace(/\./g, "").replace(",", "."); // "1.234,56" -> "1234.56"
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function money(amount: number, currency: Currency): Money {
  return { amount: clamp(amount), currency };
}

function findFirstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function extractTotal(text: string, currency: Currency): Money | undefined {
  // Try common "Total" patterns
  const patterns = [
    /TOTAL(?:T)?\s*(?:AMOUNT|SUMMA)?\s*[:\-]?\s*([0-9][0-9\s.,-]*)/i,
    /ATT\s*BETALA\s*[:\-]?\s*([0-9][0-9\s.,-]*)/i,
    /AMOUNT\s*DUE\s*[:\-]?\s*([0-9][0-9\s.,-]*)/i,
  ];

  const raw = findFirstMatch(text, patterns);
  if (!raw) return undefined;

  const amt = parseAmount(raw);
  if (amt <= 0) return undefined;
  return money(amt, currency);
}

function extractDates(text: string): { invoiceDate?: string; dueDate?: string } {
  // Basic date detection (YYYY-MM-DD or DD/MM/YYYY)
  const iso = /(\d{4}-\d{2}-\d{2})/;
  const dmy = /(\d{2}\/\d{2}\/\d{4})/;

  const invoiceDate =
    findFirstMatch(text, [/INVOICE\s*DATE\s*[:\-]?\s*([^\n\r]+)/i, /FAKTURADATUM\s*[:\-]?\s*([^\n\r]+)/i]) ||
    (text.match(iso)?.[1] ?? text.match(dmy)?.[1]);

  const dueDate =
    findFirstMatch(text, [/DUE\s*DATE\s*[:\-]?\s*([^\n\r]+)/i, /FÖRFALLODAG\s*[:\-]?\s*([^\n\r]+)/i]) ||
    undefined;

  return { invoiceDate: invoiceDate?.trim(), dueDate: dueDate?.trim() };
}

function extractInvoiceNumber(text: string): string | undefined {
  return findFirstMatch(text, [
    /INVOICE\s*(?:NO|NUMBER|#)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    /FAKTURA\s*(?:NR|NUMMER)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  ]);
}

function extractVendorName(text: string): string | undefined {
  // Heuristic: first non-empty line that is not "INVOICE/FAKTURA"
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const l of lines.slice(0, 10)) {
    const u = l.toUpperCase();
    if (u.includes("INVOICE") || u.includes("FAKTURA")) continue;
    if (u.includes("ORG") || u.includes("VAT") || u.includes("MOMS")) continue;
    if (l.length >= 3 && l.length <= 64) return l;
  }
  return undefined;
}

function extractLineItems(text: string, currency: Currency): InvoiceLineItem[] {
  // Very conservative: look for lines like "desc 2 199,00 398,00"
  const lines = text.split(/\r?\n/);
  const items: InvoiceLineItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 8) continue;

    // Capture: description + qty + unit + total
    // Example: "Skruv M8  2  199,00  398,00"
    const m = line.match(/^(.+?)\s{2,}(\d+(?:[.,]\d+)?)\s+([0-9][0-9\s.,-]*)\s+([0-9][0-9\s.,-]*)$/);
    if (!m) continue;

    const description = m[1].trim();
    const qty = parseAmount(m[2]);
    const unit = parseAmount(m[3]);
    const tot = parseAmount(m[4]);

    if (!description || qty <= 0 || (unit <= 0 && tot <= 0)) continue;

    items.push({
      description,
      quantity: clamp(qty),
      unitPrice: money(unit, currency),
      total: money(tot > 0 ? tot : unit * qty, currency),
    });
  }

  return items;
}

/**
 * Extract structured invoice data from raw OCR/text.
 * Deterministic implementation (no JSX, no LLM).
 */
export function extractInvoiceFromText(text: string): InvoiceExtraction {
  const currency = detectCurrency(text);
  const warnings: string[] = [];

  const invoiceNumber = extractInvoiceNumber(text);
  if (!invoiceNumber) warnings.push("invoice_number_not_found");

  const vendorName = extractVendorName(text);
  if (!vendorName) warnings.push("vendor_name_not_found");

  const dates = extractDates(text);
  if (!dates.invoiceDate) warnings.push("invoice_date_not_found");

  const total = extractTotal(text, currency);
  if (!total) warnings.push("total_not_found");

  const lineItems = extractLineItems(text, currency);
  if (lineItems.length === 0) warnings.push("line_items_not_detected");

  return {
    invoiceNumber,
    vendorName,
    invoiceDate: dates.invoiceDate,
    dueDate: dates.dueDate,
    total,
    lineItems,
    rawText: text,
    warnings,
  };
}

