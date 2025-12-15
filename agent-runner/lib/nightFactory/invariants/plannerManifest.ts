import { z } from "zod";
import { safeParseJsonWithSchema } from "./safeJson";

export const PlannerManifestSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string(),
        description: z.string().optional().default(""),
        dependencies: z.array(z.string()).optional().default([]),
      })
    )
    .default([]),

  architecture: z
    .object({
      frontend: z.array(z.string()).default([]),
      backend: z.array(z.string()).default([]),
      shared: z.array(z.string()).default([]),
    })
    .default({ frontend: [], backend: [], shared: [] }),

  apiRoutes: z.array(z.string()).default([]),

  // Always keep raw for audit/debug, but NEVER let it be the only “usable” form
  _raw: z.string().optional(),
  _errors: z.array(z.string()).optional().default([]),
});

export type PlannerManifest = z.infer<typeof PlannerManifestSchema>;

function extractFilePathsFromText(raw: string): string[] {
  // Heuristic: pick up paths like src/.../file.ts(x) or app/... or components/...
  const text = raw ?? "";
  const matches = text.match(
    /\b(?:src\/|app\/|components\/|lib\/|pages\/|templates\/)[\w\-./]+\.(?:ts|tsx|js|jsx|json|css|md)\b/gi
  );
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.replace(/\\/g, "/"))));
}

export async function convertPlannerToManifestStable(plannerRawText: string): Promise<PlannerManifest> {
  const fallback = (): PlannerManifest => {
    const files = extractFilePathsFromText(plannerRawText).map((p) => ({
      path: p.startsWith("src/") ? p : p, // keep as-is; your pipeline can normalize
      description: "",
      dependencies: [],
    }));

    return PlannerManifestSchema.parse({
      files,
      architecture: { frontend: [], backend: [], shared: [] },
      apiRoutes: [],
      _raw: plannerRawText ?? "",
      _errors: ["Planner JSON conversion failed; used deterministic typed fallback"],
    });
  };

  const res = await safeParseJsonWithSchema(plannerRawText, PlannerManifestSchema, fallback);

  // Always attach raw & errors for traceability
  const out = PlannerManifestSchema.parse({
    ...res.data,
    _raw: plannerRawText ?? "",
    _errors: res.errors,
  });

  return out;
}
