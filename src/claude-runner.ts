import { spawn } from "child_process";

/**
 * Strips markdown code fences from the given text, returning only the inner content.
 *
 * Matches a code fence block (``` ... ```), requiring the closing fence to appear
 * on its own line so that inline backticks within the code (e.g. regex literals)
 * are not mistaken for the closing fence. If no code fence is found, returns the
 * trimmed input as-is.
 *
 * @param text - The raw text that may be wrapped in markdown code fences.
 * @returns The unwrapped code content, or the trimmed original text if no fences are present.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  // Match a code fence, requiring the closing ``` on its own line so that
  // inline backticks within the code (e.g. regex literals) are not mistaken
  // for the closing fence.
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*)\n```/);
  if (match) {
    return match[1].trimEnd();
  }
  return trimmed;
}

/**
 * The result returned from a Claude CLI invocation.
 */
export interface ClaudeResult {
  /** The generated text output from Claude, with any code fences stripped. */
  text: string;
  /** Whether the request was cancelled via the abort signal before completion. */
  cancelled: boolean;
}

/**
 * Invokes the Claude CLI as a child process to generate code based on the given prompt and context.
 *
 * @param prompt - The user's instruction describing what code to generate or modify.
 * @param context - The focused code snippet (selection, block, or line) from the editor.
 * @param language - The programming language of the source file.
 * @param signal - Optional {@link AbortSignal} to cancel the running process.
 * @param fileContent - Optional full content of the source file for additional context.
 * @param contextType - The type of focus region, or `null` if no focus is provided.
 * @returns A promise that resolves with the generated text and a cancellation flag.
 */
export function runClaude(
  prompt: string,
  context: string,
  language: string,
  signal?: AbortSignal,
  fileContent?: string,
  contextType?: "selection" | "block" | "line" | null
): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    let fullPrompt =
      "You are a code generation tool embedded in a text editor. " +
      "Your output will be inserted directly into the source file. " +
      "Return ONLY valid code. No explanations, no markdown fences, no conversation.\n\n" +
      `Language: ${language}\n\n${prompt}`;
    if (fileContent) {
      fullPrompt += `\n\nFile:\n\`\`\`${language}\n${fileContent}\n\`\`\``;
    }
    if (context && contextType) {
      fullPrompt += `\n\nFocus (${contextType}):\n\`\`\`${language}\n${context}\n\`\`\``;
    }

    const proc = spawn("claude", ["-p", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.write(fullPrompt);
    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const onAbort = () => {
      proc.kill("SIGTERM");
      resolve({ text: "", cancelled: true });
    };

    if (signal) {
      if (signal.aborted) {
        proc.kill("SIGTERM");
        resolve({ text: "", cancelled: true });
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    proc.on("error", (err: Error) => {
      signal?.removeEventListener("abort", onAbort);
      if (err.message.includes("ENOENT")) {
        reject(
          new Error(
            "Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code"
          )
        );
      } else {
        reject(err);
      }
    });

    proc.on("close", (code: number | null) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) {
        return; // already resolved
      }
      if (code !== 0) {
        reject(
          new Error(
            `Claude exited with code ${code}${stderr ? ": " + stderr.trim() : ""}`
          )
        );
      } else {
        resolve({ text: stripCodeFences(stdout), cancelled: false });
      }
    });
  });
}
