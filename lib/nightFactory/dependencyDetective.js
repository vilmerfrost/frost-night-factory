// =============================================================================
// DEPENDENCY DETECTIVE - Auto-detect and install missing packages
// =============================================================================
// Scans all .tsx/.ts files for imports and automatically installs missing packages
// This prevents 25% of build errors caused by missing dependencies
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
/**
 * Extract all npm package imports from a file
 */
function extractPackageImports(filePath) {
    const packages = new Set();
    if (!fs.existsSync(filePath))
        return packages;
    const content = fs.readFileSync(filePath, 'utf-8');
    // Match: import X from 'package-name'
    // Match: import { X } from 'package-name'
    // Match: import type { X } from 'package-name'
    // Match: require('package-name')
    const importPatterns = [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const importPath = match[1];
            // Skip relative imports and aliases
            if (importPath.startsWith('.') || importPath.startsWith('/') || importPath.startsWith('@/')) {
                continue;
            }
            // Skip scoped packages' internal paths (@scope/package/subpath)
            const scopedMatch = importPath.match(/^(@[^/]+\/[^/]+)/);
            if (scopedMatch) {
                packages.add(scopedMatch[1]);
                continue;
            }
            // Extract base package name (before first /)
            const basePackage = importPath.split('/')[0];
            // Skip Node.js built-ins
            const nodeBuiltins = [
                'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
                'stream', 'events', 'buffer', 'querystring', 'zlib', 'net', 'tls',
                'dgram', 'dns', 'readline', 'repl', 'vm', 'child_process', 'cluster',
                'worker_threads', 'perf_hooks', 'async_hooks', 'assert', 'console',
                'process', 'timers', 'string_decoder', 'punycode', 'v8', 'inspector',
                'module', 'constants', 'domain', 'tty', 'http2', 'https', 'http',
            ];
            if (nodeBuiltins.includes(basePackage)) {
                continue;
            }
            packages.add(basePackage);
        }
    }
    return packages;
}
/**
 * Scan entire project for package imports
 */
function scanProjectForPackages(projectPath) {
    const packages = new Set();
    function scanDirectory(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            // Skip node_modules, .next, build folders
            if (entry.name === 'node_modules' ||
                entry.name === '.next' ||
                entry.name === 'dist' ||
                entry.name === 'build' ||
                entry.name.startsWith('.')) {
                continue;
            }
            if (entry.isDirectory()) {
                scanDirectory(fullPath);
            }
            else if (entry.name.match(/\.(tsx?|jsx?)$/)) {
                const filePackages = extractPackageImports(fullPath);
                filePackages.forEach(pkg => packages.add(pkg));
            }
        }
    }
    // Scan src/ or root
    const srcPath = path.join(projectPath, 'src');
    if (fs.existsSync(srcPath)) {
        scanDirectory(srcPath);
    }
    // Also scan app/ for Next.js projects
    const appPath = path.join(projectPath, 'app');
    if (fs.existsSync(appPath)) {
        scanDirectory(appPath);
    }
    // Scan root level files
    scanDirectory(projectPath);
    return packages;
}
/**
 * Read package.json and get all dependencies
 */
function getInstalledPackages(projectPath) {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return { dependencies: new Set(), devDependencies: new Set() };
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = new Set(Object.keys(pkg.dependencies || {}));
        const devDeps = new Set(Object.keys(pkg.devDependencies || {}));
        return { dependencies: deps, devDependencies: devDeps };
    }
    catch (e) {
        console.warn(`⚠️ Could not parse package.json: ${e}`);
        return { dependencies: new Set(), devDependencies: new Set() };
    }
}
/**
 * Determine if package should be devDependency
 */
function isDevDependency(packageName) {
    const devDeps = [
        'typescript', '@types/', 'eslint', 'prettier', 'jest', 'vitest',
        'tailwindcss', 'postcss', 'autoprefixer', 'webpack', 'vite',
        'rollup', 'babel', '@babel/', 'ts-node', 'tsx', 'nodemon',
    ];
    return devDeps.some(devDep => packageName.includes(devDep));
}
/**
 * Main function: Detect and install missing dependencies
 */
export function runDependencyDetective(projectPath) {
    console.log("\n🔍 DEPENDENCY DETECTIVE: Scanning for missing packages...");
    const result = {
        found: new Set(),
        missing: new Set(),
        installed: [],
        errors: [],
    };
    // 1. Scan all files for imports
    const foundPackages = scanProjectForPackages(projectPath);
    result.found = foundPackages;
    console.log(`   📦 Found ${foundPackages.size} unique package imports`);
    // 2. Check what's installed
    const { dependencies, devDependencies } = getInstalledPackages(projectPath);
    const allInstalled = new Set([...dependencies, ...devDependencies]);
    // 3. Find missing packages
    for (const pkg of foundPackages) {
        if (!allInstalled.has(pkg)) {
            result.missing.add(pkg);
        }
    }
    if (result.missing.size === 0) {
        console.log("   ✅ All packages are installed!");
        return result;
    }
    console.log(`   ⚠️ Found ${result.missing.size} missing packages: ${Array.from(result.missing).join(', ')}`);
    // 4. Install missing packages
    const packagesToInstall = Array.from(result.missing);
    const regularDeps = [];
    const devDeps = [];
    for (const pkg of packagesToInstall) {
        if (isDevDependency(pkg)) {
            devDeps.push(pkg);
        }
        else {
            regularDeps.push(pkg);
        }
    }
    // ✅ PHASE 4.1: Force modern dependency versions (Next.js 16 + React 19)
    const modernDeps = {
        'next': '^16.0.7',
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
        'framer-motion': '^11.0.0',
        'sonner': '^2.0.0',
        'lucide-react': '^0.400.0',
        '@radix-ui/react-dialog': 'latest',
        '@radix-ui/react-dropdown-menu': 'latest',
        '@radix-ui/react-select': 'latest',
        '@radix-ui/react-slot': 'latest',
        '@radix-ui/react-toast': 'latest',
        'tailwindcss': '^3.4.15',
        'tailwindcss-animate': '^1.0.7',
        'autoprefixer': '^10.4.20',
        'postcss': '^8.4.47',
        '@supabase/supabase-js': '^2.47.10',
        '@supabase/ssr': '^0.5.2',
    };
    // ✅ Permanent Guard: Ensure packages are added to package.json before installing
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        // Add missing packages to package.json dependencies/devDependencies
        if (!packageJson.dependencies)
            packageJson.dependencies = {};
        if (!packageJson.devDependencies)
            packageJson.devDependencies = {};
        // ✅ PHASE 4.1: Force modern versions for critical packages
        for (const [pkg, version] of Object.entries(modernDeps)) {
            if (packageJson.dependencies[pkg] || packageJson.devDependencies[pkg]) {
                // Update existing version to modern version
                if (packageJson.dependencies[pkg]) {
                    packageJson.dependencies[pkg] = version;
                    console.log(`   🔄 Updated ${pkg} to ${version}`);
                }
                else if (packageJson.devDependencies[pkg]) {
                    packageJson.devDependencies[pkg] = version;
                    console.log(`   🔄 Updated ${pkg} to ${version}`);
                }
            }
        }
        for (const pkg of regularDeps) {
            if (!packageJson.dependencies[pkg] && !packageJson.devDependencies[pkg]) {
                // Use modern version if available, otherwise 'latest'
                packageJson.dependencies[pkg] = modernDeps[pkg] || 'latest';
                console.log(`   📝 Added ${pkg} to package.json dependencies`);
            }
        }
        for (const pkg of devDeps) {
            if (!packageJson.dependencies[pkg] && !packageJson.devDependencies[pkg]) {
                // Use modern version if available, otherwise 'latest'
                packageJson.devDependencies[pkg] = modernDeps[pkg] || 'latest';
                console.log(`   📝 Added ${pkg} to package.json devDependencies`);
            }
        }
        // Write updated package.json
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`   ✅ Updated package.json with modern versions`);
    }
    try {
        if (regularDeps.length > 0) {
            console.log(`   📥 Installing dependencies: ${regularDeps.join(', ')}`);
            execSync(`npm install ${regularDeps.join(' ')} --legacy-peer-deps`, { cwd: projectPath, stdio: 'pipe', timeout: 120000 });
            result.installed.push(...regularDeps);
        }
        if (devDeps.length > 0) {
            console.log(`   📥 Installing devDependencies: ${devDeps.join(', ')}`);
            execSync(`npm install --save-dev ${devDeps.join(' ')} --legacy-peer-deps`, { cwd: projectPath, stdio: 'pipe', timeout: 120000 });
            result.installed.push(...devDeps);
        }
        console.log(`   ✅ Successfully installed ${result.installed.length} packages`);
    }
    catch (error) {
        const errorMsg = `Failed to install packages: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
    }
    return result;
}
