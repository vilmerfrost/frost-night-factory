// lib/pipeline/research.ts
// Research Phase with Full JSON Output
// Outputs structured ResearchPhaseJSON for downstream phases
import { generateContent, performDeepResearch, callAI } from "@/lib/nightFactory/modelClient";
import { convertResearchToJSON } from "./json-converter";
/**
 * Legacy research output (for backward compatibility)
 */
export async function runResearchPhase(idea, ticketType) {
    const isBug = ticketType === "bug";
    const prompt = isBug
        ? `You are a senior debugging engineer and code analyst.

Given this bug report, conduct thorough research:

BUG REPORT: "${idea}"

Focus on:
- Analyzing potential root causes
- Identifying which files are likely affected
- Understanding recent changes that might have introduced the bug
- Stack trace analysis if provided
- Similar bugs in codebase or known issues

Provide a JSON response with this exact structure:
{
  "summary": "High-level summary of the bug and likely cause",
  "key_findings": ["Finding 1", "Finding 2"],
  "file_candidates": ["app/page.tsx", "lib/utils.ts"],
  "api_considerations": ["Endpoint /api/... might be affected"],
  "risks": ["Risk 1", "Risk 2"],
  "recommended_solution_shape": "High-level plan for fix"
}

Return ONLY valid JSON, no markdown.`
        : `You are a senior product researcher and market analyst.

Given this product idea/feature request, conduct comprehensive research:

FEATURE REQUEST: "${idea}"

Focus on:
- Market analysis and competing tools
- Domain-specific requirements
- Technical constraints and recommendations
- MVP scope recommendations
- Edge cases to consider
- User segments who would benefit

Provide a JSON response with this exact structure:
{
  "summary": "High-level summary of what we're building",
  "user_segments": ["Segment 1", "Segment 2"],
  "similar_tools": ["Tool 1", "Tool 2"],
  "key_requirements": ["Requirement 1", "Requirement 2"],
  "tech_recommendations": {
    "frontend": "Recommended frontend framework",
    "backend": "Recommended backend",
    "auth": "Recommended auth solution",
    "db_notes": ["Note 1", "Note 2"]
  },
  "key_insights": ["Insight 1", "Insight 2"],
  "references": [
    { "title": "Reference title", "url": "https://..." }
  ],
  "risks": ["Risk 1", "Risk 2"],
  "recommended_scope_for_mvp": ["Feature 1", "Feature 2"]
}

Return ONLY valid JSON, no markdown.`;
    const response = await generateContent(prompt, isBug ? "You are a Senior Debugging Engineer" : "You are a Senior Product Researcher");
    // Try to extract JSON from response
    let jsonStr = response.trim();
    // Remove markdown code blocks if present
    if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    }
    else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    try {
        const parsed = JSON.parse(jsonStr);
        // Normalize output structure for bugs
        if (isBug && !parsed.key_findings) {
            parsed.key_findings = parsed.key_insights || [];
        }
        return parsed;
    }
    catch (e) {
        console.error("Failed to parse research output:", e);
        // Return fallback structure
        return {
            summary: response.substring(0, 500),
            user_segments: [],
            similar_tools: [],
            key_requirements: [],
            tech_recommendations: {
                frontend: "Next.js 16",
                backend: "Supabase",
                auth: "Supabase Auth",
                db_notes: [],
            },
            key_findings: [],
            file_candidates: [],
            api_considerations: [],
            risks: [],
            recommended_solution_shape: response.substring(0, 200),
        };
    }
}
/**
 * NEW: Research phase with full JSON output for pipeline context
 * Uses Perplexity for deep research + Claude Haiku for JSON conversion
 */
export async function runResearchPhaseJSON(userPrompt, options = {}) {
    const { usePerplexity = true, useKimi = false, ticketType = "feature" } = options;
    const isBug = ticketType === "bug";
    console.log(`\n🔍 [RESEARCH PHASE] Starting research for: "${userPrompt.substring(0, 100)}..."`);
    let rawResearchText = "";
    const sources = [];
    // ============================================================
    // 1. GATHER RAW RESEARCH FROM MULTIPLE SOURCES
    // ============================================================
    // Perplexity: Deep web research (if available)
    if (usePerplexity) {
        try {
            console.log("📡 Perplexity: Running deep research...");
            const perplexityResult = await performDeepResearch(isBug
                ? `Debug analysis for: ${userPrompt}. Find similar bugs, common solutions, and best practices.`
                : `Market research for: ${userPrompt}. Find competitors, best practices, tech stack recommendations.`);
            rawResearchText += `\n=== PERPLEXITY RESEARCH ===\n${perplexityResult}\n`;
            sources.push("perplexity");
        }
        catch (e) {
            console.warn("⚠️ Perplexity research failed, continuing with other sources...");
        }
    }
    // Kimi K2: Alternative research (if enabled)
    if (useKimi) {
        try {
            console.log("🌙 Kimi K2: Running secondary research...");
            const kimiResult = await callAI("RESEARCH", isBug
                ? `Analyze this bug report and provide debugging insights: ${userPrompt}`
                : `Analyze this feature request and provide market insights: ${userPrompt}`, "You are a Senior Technical Researcher.");
            rawResearchText += `\n=== KIMI K2 RESEARCH ===\n${kimiResult}\n`;
            sources.push("kimi_k2");
        }
        catch (e) {
            console.warn("⚠️ Kimi research failed, continuing...");
        }
    }
    // Gemini Flash: Fast analysis (always run as baseline)
    try {
        console.log("⚡ Gemini Flash: Running baseline analysis...");
        const geminiPrompt = isBug
            ? `Analyze this bug report thoroughly:

BUG: ${userPrompt}

Provide:
1. Root cause analysis
2. Affected components
3. Fix strategy
4. Risk assessment`
            : `Analyze this feature request:

FEATURE: ${userPrompt}

Provide:
1. Market analysis & competitors
2. User segments
3. Technical requirements
4. Technology recommendations (frontend, backend, database, UI library)
5. MVP scope
6. Potential challenges
7. Estimated complexity (1-10)`;
        const geminiResult = await generateContent(geminiPrompt, "You are a Senior Technical Analyst");
        rawResearchText += `\n=== GEMINI ANALYSIS ===\n${geminiResult}\n`;
        sources.push("gemini");
    }
    catch (e) {
        console.error("❌ Gemini analysis failed:", e);
    }
    // ============================================================
    // 2. FAIL FAST: Check if we have any research
    // ============================================================
    if (!rawResearchText.trim()) {
        return {
            success: false,
            error: "No research data gathered from any source",
            raw_text_audit: ""
        };
    }
    console.log(`✅ Research gathered from: ${sources.join(", ")}`);
    // ============================================================
    // 3. CONVERT TO STRUCTURED JSON (Claude 4.5 Haiku)
    // ============================================================
    console.log("🔧 Converting research to structured JSON (Claude 4.5 Haiku)...");
    const result = await convertResearchToJSON(rawResearchText, userPrompt);
    if (!result.success) {
        console.error(`❌ JSON conversion failed: ${result.error}`);
        return result;
    }
    // ============================================================
    // 4. VALIDATE & RETURN
    // ============================================================
    if (!result.data) {
        return {
            success: false,
            error: "JSON conversion returned no data",
            raw_text_audit: rawResearchText
        };
    }
    // Ensure phase and timestamp are set
    result.data.phase = "research";
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    console.log(`✅ [RESEARCH PHASE] Complete!`);
    console.log(`   - Requirements: ${result.data.extracted_requirements.must_have.length} must-have, ${result.data.extracted_requirements.should_have.length} should-have`);
    console.log(`   - Challenges: ${result.data.potential_challenges.length} identified`);
    console.log(`   - Complexity: ${result.data.estimated_scope.complexity_score}/10`);
    return {
        success: true,
        data: result.data,
        raw_text_audit: rawResearchText
    };
}
/**
 * Convert legacy ResearchOutput to ResearchPhaseJSON
 */
export function legacyToResearchPhaseJSON(legacy) {
    return {
        phase: "research",
        timestamp: new Date().toISOString(),
        sources: {
            gemini: {
                query: "Legacy conversion",
                results: [],
                summary: legacy.summary
            }
        },
        extracted_requirements: {
            must_have: legacy.key_requirements?.slice(0, 3).map((req, i) => ({
                id: `req-${i + 1}`,
                name: req,
                description: req,
                priority: "critical",
                technical_constraints: [],
                source: ["legacy"]
            })) || [],
            should_have: legacy.key_requirements?.slice(3, 6).map((req, i) => ({
                id: `req-${i + 4}`,
                name: req,
                description: req,
                priority: "high",
                technical_constraints: [],
                source: ["legacy"]
            })) || [],
            nice_to_have: legacy.recommended_scope_for_mvp?.map((scope, i) => ({
                id: `req-${i + 7}`,
                name: scope,
                description: scope,
                priority: "low",
                technical_constraints: [],
                source: ["legacy"]
            })) || []
        },
        technology_recommendations: {
            frontend: {
                choice: legacy.tech_recommendations?.frontend || "Next.js 16",
                reason: "Recommended by research",
                alternatives: [],
                confidence: 0.8
            },
            backend: {
                choice: legacy.tech_recommendations?.backend || "Supabase",
                reason: "Recommended by research",
                alternatives: [],
                confidence: 0.8
            },
            database: {
                choice: "PostgreSQL (Supabase)",
                reason: legacy.tech_recommendations?.db_notes?.join(", ") || "Standard choice",
                alternatives: [],
                confidence: 0.85
            },
            auth: {
                choice: legacy.tech_recommendations?.auth || "Supabase Auth",
                reason: "Built-in with Supabase",
                confidence: 0.9
            }
        },
        potential_challenges: legacy.risks?.map(risk => ({
            challenge: risk,
            solution: "To be determined",
            risk_level: "medium"
        })) || [],
        competitive_analysis: {
            similar_tools: legacy.similar_tools?.map(tool => ({
                name: tool,
                strengths: [],
                weaknesses: []
            })) || []
        },
        best_practices_found: legacy.key_insights || [],
        estimated_scope: {
            total_features: legacy.recommended_scope_for_mvp?.length || 5,
            estimated_dev_hours: 40,
            estimated_timeline_weeks: 2,
            complexity_score: 5
        }
    };
}
