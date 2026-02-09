import { spawn } from "child_process";
import type { Provider, ProviderResult, ProviderRunParams } from "../provider";
import { stripCodeFences } from "../utils";

export function buildPrompt(params: ProviderRunParams): string {
  let fullPrompt =
    "You are a code generation tool embedded in a text editor. " +
    "Your output will be inserted directly into the source file. " +
    "Return ONLY valid code. No explanations, no markdown fences, no conversation.\n\n" +
    `Language: ${params.language}\n\n${params.prompt}`;
  if (params.fileContent) {
    fullPrompt += `\n\nFile:\n\`\`\`${params.language}\n${params.fileContent}\n\`\`\``;
  }
  if (params.context && params.contextType) {
    fullPrompt += `\n\nFocus (${params.contextType}):\n\`\`\`${params.language}\n${params.context}\n\`\`\``;
  }
  return fullPrompt;
}

export const claudeProvider: Provider = {
  name: "Claude",
  id: "claude",

  run(params: ProviderRunParams): Promise<ProviderResult> {
    return new Promise((resolve, reject) => {
      const fullPrompt = buildPrompt(params);

      const args = ["-p", "--output-format", "text"];
      if (params.model) {
        args.push("--model", params.model);
      }
      const proc = spawn("claude", args, {
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

      if (params.signal) {
        if (params.signal.aborted) {
          proc.kill("SIGTERM");
          resolve({ text: "", cancelled: true });
          return;
        }
        params.signal.addEventListener("abort", onAbort, { once: true });
      }

      proc.on("error", (err: Error) => {
        params.signal?.removeEventListener("abort", onAbort);
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
        params.signal?.removeEventListener("abort", onAbort);
        if (params.signal?.aborted) {
          return;
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
  },
};
