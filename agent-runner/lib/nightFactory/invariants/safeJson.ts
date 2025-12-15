import { z } from "zod";

type SafeJsonResult<T> = {
  ok: boolean;
  data: T;
  errors: string[];
  raw: string;
  repaired?: string;
};

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

function stripCodeFences(s: string): string {
  // Removes ```json ... ``` or ``` ... ```
  return s
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extractJsonObjectish(s: string): string | null {
  // Try to grab the most likely JSON blob: from first { to last }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return null;
}

async function tryJsonRepair(input: string): Promise<string | null> {
  // Optional dependency: jsonrepair
  try {
    const mod: any = await import("jsonrepair");
    const fn = mod?.jsonrepair ?? mod?.default ?? null;
    if (typeof fn !== "function") return null;
    return fn(input);
  } catch {
    return null;
  }
}

export async function safeParseJsonWithSchema<T>(
  rawText: string,
  schema: z.ZodType<T>,
  fallback: () => T
): Promise<SafeJsonResult<T>> {
  const errors: string[] = [];
  const raw = rawText ?? "";

  // 1) sanitize
  let cleaned = String(rawText ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .trim();

  // 2) strip code fences
  cleaned = stripCodeFences(cleaned);

  // 3) attempt direct parse (common success case)
  const directCandidates = [cleaned, extractJsonObjectish(cleaned)].filter(Boolean) as string[];

  for (const candidate of directCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const validated = schema.safeParse(parsed);
      if (validated.success) {
        return { ok: true, data: validated.data, errors, raw };
      }
      errors.push(`Schema validation failed (direct parse): ${validated.error.message}`);
      // Continue to repair
      break;
    } catch (e: any) {
      errors.push(`Direct JSON.parse failed: ${e?.message ?? String(e)}`);
      break;
    }
  }

  // 4) try repair
  const repairInput = extractJsonObjectish(cleaned) ?? cleaned;
  const repaired = await tryJsonRepair(repairInput);
  if (repaired) {
    try {
      const parsed = JSON.parse(repaired);
      const validated = schema.safeParse(parsed);
      if (validated.success) {
        errors.push("Parsed via jsonrepair()");
        return { ok: true, data: validated.data, errors, raw, repaired: repaired ?? undefined };
      }
      errors.push(`Schema validation failed (repaired): ${validated.error.message}`);
    } catch (e: any) {
      errors.push(`JSON.parse failed after repair: ${e?.message ?? String(e)}`);
    }
  } else {
    errors.push("jsonrepair not available or failed to load");
  }

  // 5) deterministic fallback (never RAW-only)
  const repairedValue: string | undefined = repaired ?? undefined;
  return { ok: false, data: fallback(), errors: [...errors, "Using typed fallback"], raw, repaired: repairedValue };
}
