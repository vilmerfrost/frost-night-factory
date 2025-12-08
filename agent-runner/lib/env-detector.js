/**
 * Environment Variable Detector
 * Scans code and plans to detect required API keys and environment variables
 */
import fs from 'fs';
import path from 'path';
// Known environment variable recipes
const ENV_RECIPES = {
    supabase: {
        label: 'Supabase',
        keys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    },
    anthropic: {
        label: 'Anthropic (Claude)',
        keys: ['ANTHROPIC_API_KEY'],
    },
    moonshot: {
        label: 'Kimi / Moonshot',
        keys: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    },
    openai: {
        label: 'OpenAI',
        keys: ['OPENAI_API_KEY'],
    },
    groq: {
        label: 'Groq',
        keys: ['GROQ_API_KEY'],
    },
    deepseek: {
        label: 'DeepSeek',
        keys: ['DEEPSEEK_API_KEY'],
    },
    stripe: {
        label: 'Stripe',
        keys: ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY'],
    },
    resend: {
        label: 'Resend (Email)',
        keys: ['RESEND_API_KEY'],
    },
    postgres: {
        label: 'PostgreSQL',
        keys: ['DATABASE_URL'],
        optional: true,
    },
    redis: {
        label: 'Redis',
        keys: ['REDIS_URL'],
        optional: true,
    },
};
// Import patterns that indicate a provider is needed
const IMPORT_PATTERNS = {
    supabase: [
        /@supabase\/supabase-js/,
        /@supabase\/ssr/,
        /from ['"]@supabase/,
        /import.*supabase/i,
    ],
    anthropic: [
        /@anthropic-ai\/sdk/,
        /from ['"]@anthropic/,
        /import.*anthropic/i,
    ],
    moonshot: [
        /moonshot/,
        /kimi/i,
        /api\.moonshot/,
    ],
    openai: [
        /openai/,
        /from ['"]openai/,
        /import.*openai/i,
    ],
    groq: [
        /groq-sdk/,
        /from ['"]groq/,
        /import.*groq/i,
    ],
    deepseek: [
        /deepseek/,
        /api\.deepseek/,
    ],
    stripe: [
        /stripe/,
        /@stripe\/stripe-js/,
        /from ['"]stripe/,
        /import.*stripe/i,
    ],
    resend: [
        /resend/,
        /from ['"]resend/,
        /import.*resend/i,
    ],
    postgres: [
        /pg\s*[,\s]|postgres/,
        /from ['"]pg/,
        /import.*postgres/i,
    ],
    redis: [
        /redis/,
        /ioredis/,
        /from ['"]redis/,
        /import.*redis/i,
    ],
};
// Text patterns that indicate a provider is mentioned
const MENTION_PATTERNS = {
    supabase: [/supabase/i, /supabase\.co/i],
    anthropic: [/anthropic/i, /claude/i],
    moonshot: [/moonshot/i, /kimi/i],
    openai: [/openai/i, /gpt/i, /chatgpt/i],
    groq: [/groq/i],
    deepseek: [/deepseek/i],
    stripe: [/stripe/i, /payment/i],
    resend: [/resend/i, /email/i],
    postgres: [/postgres/i, /postgresql/i, /database/i],
    redis: [/redis/i],
};
/**
 * Scan code content for environment variable requirements
 */
export function detectEnvFromCode(codeContent) {
    const detected = [];
    const codeLower = codeContent.toLowerCase();
    for (const [provider, recipe] of Object.entries(ENV_RECIPES)) {
        // Check import patterns
        const importPatterns = IMPORT_PATTERNS[provider] || [];
        const hasImport = importPatterns.some(pattern => pattern.test(codeContent));
        // Check mention patterns
        const mentionPatterns = MENTION_PATTERNS[provider] || [];
        const hasMention = mentionPatterns.some(pattern => pattern.test(codeLower));
        // Check for direct env var usage
        const hasEnvVar = recipe.keys.some(key => {
            const envPattern = new RegExp(`process\\.env\\.${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
            return envPattern.test(codeContent);
        });
        if (hasImport || hasMention || hasEnvVar) {
            let reason = '';
            if (hasImport)
                reason = `Import detected: ${codeContent.match(importPatterns.find(p => p.test(codeContent)) || /.*/)?.[0]?.substring(0, 50)}`;
            else if (hasMention)
                reason = `Provider mentioned in code`;
            else if (hasEnvVar)
                reason = `Environment variable used`;
            detected.push({
                provider,
                label: recipe.label,
                keys: recipe.keys,
                detected: true,
                reason,
            });
        }
    }
    return detected;
}
/**
 * Scan plan/research content for mentions
 */
export function detectEnvFromPlan(planContent) {
    const detected = [];
    const planLower = planContent.toLowerCase();
    for (const [provider, recipe] of Object.entries(ENV_RECIPES)) {
        const mentionPatterns = MENTION_PATTERNS[provider] || [];
        const hasMention = mentionPatterns.some(pattern => pattern.test(planLower));
        if (hasMention) {
            detected.push({
                provider,
                label: recipe.label,
                keys: recipe.keys,
                detected: true,
                reason: `Mentioned in plan/research`,
            });
        }
    }
    return detected;
}
/**
 * Scan a project directory for environment variable requirements
 */
export async function detectEnvFromProject(projectPath) {
    const detectedProviders = new Map();
    // Scan all TypeScript/JavaScript files
    const codeFiles = [
        ...globSync('**/*.{ts,tsx,js,jsx}', { cwd: projectPath, ignore: ['node_modules/**', '.next/**'] }),
    ];
    for (const file of codeFiles) {
        const filePath = path.join(projectPath, file);
        if (!fs.existsSync(filePath))
            continue;
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileDetections = detectEnvFromCode(content);
            for (const detection of fileDetections) {
                if (!detectedProviders.has(detection.provider)) {
                    detectedProviders.set(detection.provider, detection);
                }
            }
        }
        catch (error) {
            // Skip files that can't be read
            continue;
        }
    }
    // Separate required vs optional
    const required = [];
    const optional = [];
    for (const detection of detectedProviders.values()) {
        const recipe = ENV_RECIPES[detection.provider];
        if (recipe?.optional) {
            optional.push(detection);
        }
        else {
            required.push(detection);
        }
    }
    return {
        required,
        optional,
        demoMode: false, // Will be set based on user choice
    };
}
/**
 * Generate .env.local content from user-provided values
 */
export function generateEnvFile(envValues, detectedRequirements, demoMode = false) {
    const lines = [];
    lines.push('# Environment variables for this project');
    lines.push('# Generated by Frost Night Factory');
    lines.push('');
    if (demoMode) {
        lines.push('# DEMO MODE: Using placeholder values');
        lines.push('# API calls will not work until you add real keys');
        lines.push('NEXT_PUBLIC_DEMO_MODE=true');
        lines.push('');
    }
    else {
        lines.push('NEXT_PUBLIC_DEMO_MODE=false');
        lines.push('');
    }
    // Write detected requirements
    for (const req of [...detectedRequirements.required, ...detectedRequirements.optional]) {
        lines.push(`# ${req.label}`);
        for (const key of req.keys) {
            const value = envValues[key] || (demoMode ? getDemoValue(key) : '');
            if (value) {
                lines.push(`${key}=${value}`);
            }
            else {
                lines.push(`# ${key}=`);
            }
        }
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Get safe demo value for an environment variable
 */
function getDemoValue(key) {
    // Return safe, non-functional but build-safe values
    if (key.includes('URL')) {
        return 'https://demo.example.com';
    }
    if (key.includes('KEY') || key.includes('SECRET') || key.includes('API_KEY')) {
        return 'demo_' + 'x'.repeat(32); // Safe placeholder
    }
    return 'demo';
}
/**
 * Check which detected keys are missing from current environment
 */
export function checkMissingKeys(detectedRequirements, currentEnv) {
    return detectedRequirements.filter(req => {
        return req.keys.some(key => !currentEnv[key] || currentEnv[key].startsWith('demo_'));
    });
}
// Helper for glob sync
function globSync(pattern, options) {
    const files = [];
    const ignorePatterns = options.ignore.map(p => new RegExp(p.replace(/\*\*/g, '.*')));
    function walkDir(dir, baseDir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            // Check ignore patterns
            if (ignorePatterns.some(pattern => pattern.test(relativePath))) {
                continue;
            }
            if (entry.isDirectory()) {
                walkDir(fullPath, baseDir);
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                    files.push(relativePath);
                }
            }
        }
    }
    walkDir(options.cwd, options.cwd);
    return files;
}
