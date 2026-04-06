import { z } from "zod";
import { appendEntry, validateEntry } from "../log.js";

export const logPromptSchema = {
  name: "log_prompt",
  description:
    "REQUIRED FIRST CALL. Append a prompt + intent record to .denigma/PROMPT_LOG.md before making any edits. " +
    "Returns an entry_id that must be passed to write_dng_entry and suggest_tests.",
  inputSchema: {
    type: "object" as const,
    properties: {
      repo_root: {
        type: "string",
        description: "Absolute path to the root of the target repository being edited.",
      },
      prompt: {
        type: "string",
        description: "The exact prompt or user request being acted upon.",
      },
      intent: {
        type: "string",
        description:
          "The agent's plain-English statement of what it intends to build or change, and why.",
      },
      affected_files: {
        type: "array",
        items: { type: "string" },
        description: "Repo-relative paths of all files that will be created or modified.",
      },
      acceptance_criteria: {
        type: "array",
        items: { type: "string" },
        description:
          "Verifiable statements that, if true at runtime, prove the intent was fulfilled. " +
          "Each criterion should be specific enough to map to a test assertion.",
      },
    },
    required: ["repo_root", "prompt", "intent", "affected_files", "acceptance_criteria"],
  },
} as const;

export const logPromptInputSchema = z.object({
  repo_root: z.string().min(1),
  prompt: z.string().min(1),
  intent: z.string().min(1),
  affected_files: z.array(z.string().min(1)).min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
});

export type LogPromptInput = z.infer<typeof logPromptInputSchema>;

export async function handleLogPrompt(input: LogPromptInput): Promise<{ entry_id: string; message: string }> {
  const errors = validateEntry(input);
  if (errors.length > 0) {
    throw new Error(`Invalid log_prompt input: ${errors.join("; ")}`);
  }

  const entry = await appendEntry(input.repo_root, {
    prompt: input.prompt,
    intent: input.intent,
    affected_files: input.affected_files,
    acceptance_criteria: input.acceptance_criteria,
  });

  return {
    entry_id: entry.entry_id,
    message: `Logged entry ${entry.entry_id} to .denigma/PROMPT_LOG.md. Now proceed with edits, then call write_dng_entry for each modified file.`,
  };
}
