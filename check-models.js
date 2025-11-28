import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ Ingen nyckel hittades i .env.local eller .env");
  console.error("Kontrollerar .env...");
  process.exit(1);
}

console.log("✅ API-nyckel hittad (starts with):", apiKey.substring(0, 4) + "...\n");

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  const modelsToTest = [
    "gemini-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp"
  ];

  console.log("🔍 Testar modeller...\n");

  for (const modelName of modelsToTest) {
    try {
      console.log(`Testing '${modelName}'...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Say hello");
      const text = result.response.text();
      console.log(`✅ '${modelName}' fungerar! (Response: "${text.substring(0, 30)}...")`);
      console.log("");
    } catch (error) {
      console.error(`❌ '${modelName}' misslyckades: ${error.message}`);
      console.log("");
    }
  }

  console.log("\n🎯 Rekommendation: Använd den modell som fungerade ovan!");
}

listModels().catch(console.error);

