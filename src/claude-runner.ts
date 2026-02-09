import { spawn } from "child_process";

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  // Match the first code fence, ignoring any trailing prose
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)```/);
  if (match) {
    return match[1].trimEnd();
  }
  return trimmed;
}

export interface ClaudeResult {
  text: string;
  cancelled: boolean;
}

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
