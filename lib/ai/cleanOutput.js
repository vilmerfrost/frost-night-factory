export function cleanModelOutput(output) {
    if (!output)
        return "";
    let cleaned = output;
    // Remove system echoes
    cleaned = cleaned.replace(/^(User:|Assistant:|System:).*/gim, "");
    // Extract content from markdown code blocks
    const codeBlockMatch = cleaned.match(/```(?:tsx|ts|jsx|js|typescript|javascript)?\n?([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        cleaned = codeBlockMatch[1].trim();
    }
    else {
        // Remove markdown fences if no code block found
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (block) => {
            return block.replace(/```.*?\n/, "").replace(/```$/, "");
        });
    }
    // Remove prompt mirrors
    if (cleaned.trim().startsWith("THIS IS A VALIDATION TASK")) {
        cleaned = cleaned.split("\n").slice(1).join("\n");
    }
    // Remove common AI meta-responses
    const metaPhrases = [
        /^Understood.*?\n/gi,
        /^Waiting for instructions.*?\n/gi,
        /^Acknowledged.*?\n/gi,
        /^Here is what I will do.*?\n/gi,
        /^I'll.*?\n/gi,
        /^Let me.*?\n/gi,
    ];
    metaPhrases.forEach((phrase) => {
        cleaned = cleaned.replace(phrase, "");
    });
    // Trim whitespace
    return cleaned.trim();
}
