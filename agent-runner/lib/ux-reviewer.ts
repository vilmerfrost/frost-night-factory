// =============================================================================
// UX REVIEWER - Scores visual hierarchy, CTA clarity, clutter, consistency
// =============================================================================

import { callAI } from '../ai-client';
import { selectModel } from './model-routing-policies';
import * as fs from 'fs';
import * as path from 'path';

export interface UXScore {
  overall: number; // 0-10
  visualHierarchy: number; // 0-10
  ctaClarity: number; // 0-10
  clutter: number; // 0-10 (higher = less clutter, better)
  consistency: number; // 0-10
  issues: UXIssue[];
}

export interface UXIssue {
  severity: 'low' | 'medium' | 'high';
  component: string;
  issue: string;
  suggestion: string;
}

// ✅ V8.0: Use adaptive thresholds instead of hardcoded value
// const UX_THRESHOLD = 7.0; // Minimum score to pass

/**
 * Review UX of a page component
 */
export async function reviewUX(
  pipelineId: string,
  componentPath: string,
  projectRoot: string
): Promise<UXScore> {
  console.log(`🎨 [UX Reviewer] Analyzing ${componentPath}...`);

  // Read component code
  const fullPath = path.join(projectRoot, componentPath);
  if (!fs.existsSync(fullPath)) {
    return {
      overall: 0,
      visualHierarchy: 0,
      ctaClarity: 0,
      clutter: 0,
      consistency: 0,
      issues: [
        {
          severity: 'high',
          component: componentPath,
          issue: 'Component file not found',
          suggestion: 'Create the component file',
        },
      ],
    };
  }

  const componentCode = fs.readFileSync(fullPath, 'utf-8');

  // Also check for related layout/components
  const relatedFiles: string[] = [];
  const componentDir = path.dirname(fullPath);
  if (fs.existsSync(componentDir)) {
    const files = fs.readdirSync(componentDir);
    files.forEach((file) => {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        relatedFiles.push(path.join(componentDir, file));
      }
    });
  }

  // Build context
  const context = {
    componentPath,
    componentCode: componentCode.substring(0, 5000), // Limit size
    relatedFiles: relatedFiles.slice(0, 5).map((f) => {
      try {
        return {
          path: f,
          preview: fs.readFileSync(f, 'utf-8').substring(0, 500),
        };
      } catch {
        return { path: f, preview: '' };
      }
    }),
  };

  // Call UX Reviewer (use Groq for cost efficiency)
  const routing = await selectModel('ux_reviewer', 'ux_review', 1, [], pipelineId);
  const prompt = `You are a UX expert reviewing a React/Next.js component.

COMPONENT TO REVIEW:
Path: ${componentPath}
Code:
\`\`\`tsx
${context.componentCode}
\`\`\`

RELATED FILES:
${context.relatedFiles.map((f) => `- ${f.path}\n\`\`\`tsx\n${f.preview}\n\`\`\``).join('\n\n')}

EVALUATE THE FOLLOWING:

1. **Visual Hierarchy** (0-10):
   - Is there a clear primary heading?
   - Are secondary elements properly de-emphasized?
   - Is the information architecture logical?

2. **CTA Clarity** (0-10):
   - Is there a clear primary action button?
   - Is the primary CTA visually distinct?
   - Are secondary actions appropriately de-emphasized?

3. **Clutter** (0-10, higher = less clutter):
   - Is the layout clean and uncluttered?
   - Is whitespace used effectively?
   - Are there too many competing elements?

4. **Consistency** (0-10):
   - Does it use the design system consistently?
   - Are spacing/typography/colors consistent?
   - Does it match other pages in the app?

RETURN ONLY VALID JSON:
{
  "overall": 7.5,
  "visualHierarchy": 8,
  "ctaClarity": 7,
  "clutter": 8,
  "consistency": 7,
  "issues": [
    {
      "severity": "medium",
      "component": "HeroSection",
      "issue": "Primary CTA button is not visually distinct enough",
      "suggestion": "Increase button size and use primary color variant"
    }
  ]
}

Be strict but fair. Only flag real UX issues.`;

  try {
    const response = await callAI({
      pipelineId,
      step: 'ux_reviewer',
      role: 'CODER', // Use CODER role (UX_REVIEWER not in union yet, but this works)
      model: routing.model,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse JSON response
    let score: UXScore;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        score = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse UX review JSON, using defaults');
      score = {
        overall: 5,
        visualHierarchy: 5,
        ctaClarity: 5,
        clutter: 5,
        consistency: 5,
        issues: [
          {
            severity: 'medium',
            component: componentPath,
            issue: 'Could not parse UX review',
            suggestion: 'Manual review recommended',
          },
        ],
      };
    }

    console.log(`   📊 UX Score: ${score.overall.toFixed(1)}/10`);
    console.log(`      Visual Hierarchy: ${score.visualHierarchy}/10`);
    console.log(`      CTA Clarity: ${score.ctaClarity}/10`);
    console.log(`      Clutter: ${score.clutter}/10`);
    console.log(`      Consistency: ${score.consistency}/10`);

    if (score.issues.length > 0) {
      console.log(`   ⚠️ Found ${score.issues.length} UX issues:`);
      score.issues.forEach((issue, idx) => {
        console.log(`      ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}`);
        console.log(`         → ${issue.suggestion}`);
      });
    }

    return score;
  } catch (error: any) {
    console.error(`❌ UX Review failed: ${error.message}`);
    return {
      overall: 5,
      visualHierarchy: 5,
      ctaClarity: 5,
      clutter: 5,
      consistency: 5,
      issues: [
        {
          severity: 'medium',
          component: componentPath,
          issue: 'UX review failed',
          suggestion: 'Manual review recommended',
        },
      ],
    };
  }
}

/**
 * Check if UX score passes threshold (uses adaptive thresholds)
 */
export async function passesUXThreshold(score: UXScore): Promise<boolean> {
  const { getUXThreshold } = await import('./adaptive-ux-thresholds');
  const threshold = await getUXThreshold();
  return score.overall >= threshold;
}

/**
 * Generate micro-fixes for UX issues
 */
export async function generateUXFixes(
  pipelineId: string,
  componentPath: string,
  issues: UXIssue[],
  projectRoot: string
): Promise<string> {
  console.log(`🔧 [UX Reviewer] Generating fixes for ${issues.length} issues...`);

  const fullPath = path.join(projectRoot, componentPath);
  const componentCode = fs.readFileSync(fullPath, 'utf-8');

  const routing = await selectModel('ux_fixer', 'coder', 1, [], pipelineId);
  const prompt = `You are a UX fixer. Apply micro-changes to fix UX issues.

COMPONENT:
\`\`\`tsx
${componentCode}
\`\`\`

ISSUES TO FIX:
${issues.map((issue, idx) => `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}\n   Suggestion: ${issue.suggestion}`).join('\n')}

RULES:
- Make MINIMAL changes (micro-fixes, not rewrites)
- Keep existing functionality intact
- Only fix the specific issues listed
- Use Tailwind classes for styling
- Ensure the component still exports correctly

RETURN ONLY THE FIXED COMPONENT CODE (no markdown, no explanations):
`;

  const fixedCode = await callAI({
    pipelineId,
    step: 'ux_fixer',
    role: 'CODER',
    model: routing.model,
    messages: [{ role: 'user', content: prompt }],
  });

  return fixedCode;
}

