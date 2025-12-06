export function buildOutputMarkdown(artifacts) {
    const lines = [];
    lines.push(`# Night Factory Run – Task ${artifacts.taskId}`);
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("## Initial Prompt");
    lines.push("");
    lines.push("```");
    lines.push(artifacts.initialPrompt.trim());
    lines.push("```");
    lines.push("");
    if (artifacts.plannerOutput) {
        lines.push("## Planner Output");
        lines.push("");
        lines.push("```");
        lines.push(artifacts.plannerOutput.trim());
        lines.push("```");
        lines.push("");
    }
    if (artifacts.coderOutput) {
        lines.push("## Coder Output");
        lines.push("");
        lines.push("```tsx");
        lines.push(artifacts.coderOutput.trim());
        lines.push("```");
        lines.push("");
    }
    if (artifacts.reviewerOutput) {
        lines.push("## Reviewer Output");
        lines.push("");
        lines.push("```tsx");
        lines.push(artifacts.reviewerOutput.trim());
        lines.push("```");
        lines.push("");
    }
    return lines.join("\n");
}
export function buildConversationMarkdown(taskId, convo) {
    const lines = [];
    lines.push(`# Night Factory Conversation – Task ${taskId}`);
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");
    for (const turn of convo) {
        const label = turn.role === "user"
            ? "User"
            : turn.role === "assistant"
                ? "Assistant"
                : turn.role.toUpperCase();
        lines.push(`### ${label} – ${new Date(turn.timestamp).toLocaleString()}`);
        lines.push("");
        lines.push(turn.content.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
    }
    return lines.join("\n");
}
