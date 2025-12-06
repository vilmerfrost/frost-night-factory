// lib/pipeline/tester.ts
import { execSync } from "child_process";
export async function runTesterPhase(repoPath) {
    let testResults = "";
    let passed = false;
    try {
        // VIKTIGT: Kör tester i CI-mode (kör en gång och avsluta)
        // CI=true tvingar Jest att köra en gång och avsluta (ingen watch mode)
        // stdio: 'pipe' fångar output utan att skriva till konsolen direkt
        console.log("🧪 Running npm test (CI mode)...");
        const output = execSync("npm test", {
            cwd: repoPath,
            encoding: "utf-8",
            stdio: "pipe", // Fångar output utan att skriva till konsolen direkt
            env: { ...process.env, CI: "true" }, // Tvinga CI mode - gör att den inte väntar på input!
        });
        testResults = output;
        passed = true;
        console.log("✅ Tests Passed!");
    }
    catch (error) {
        // Tests failed or no tests exist
        // Fånga både stdout och stderr för bättre debugging
        testResults = error.stdout || error.stderr || error.message || "No tests found or tests failed";
        passed = false;
        console.error("❌ Tests Failed");
        console.log("Test output:", testResults.substring(0, 500)); // Visa första 500 tecknen
    }
    return {
        test_results: testResults,
        passed,
    };
}
