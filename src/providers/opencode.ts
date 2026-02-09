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
    fullPrompt += `\n\nFull file context:\n\`\`\`${params.language}\n${params.fileContent}\n\`\`\``;
  }
  if (params.context && params.contextType) {
    fullPrompt += `\n\nIMPORTANT: Your output will REPLACE the focused code. Return ONLY the modified version of the focus code — do not include any surrounding code. If no changes are needed, return the original code exactly as-is. Never return explanations or prose — always return valid code.`;
    fullPrompt += `\n\nFocus (${params.contextType}):\n\`\`\`${params.language}\n${params.context}\n\`\`\``;
  }
  return fullPrompt;
}

export const opencodeProvider: Provider = {
  name: "OpenCode",
  id: "opencode",

  run(params: ProviderRunParams): Promise<ProviderResult> {
    return new Promise((resolve, reject) => {
      const prompt = buildPrompt(params);

      const args = ["run"];
      if (params.model) {
        args.push("--model", params.model);
      }

      const proc = spawn("opencode", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Pipe the prompt via stdin so it isn't interpreted as a file path.
      proc.stdin.write(prompt);
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
              "OpenCode CLI not found. Install it with: go install github.com/opencode-ai/opencode@latest"
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
              `OpenCode exited with code ${code}${stderr ? ": " + stderr.trim() : ""}`
            )
          );
        } else if (!stdout.trim()) {
          reject(
            new Error(
              `OpenCode produced no output${stderr ? ". stderr: " + stderr.trim() : ""}`
            )
          );
        } else {
          resolve({ text: stripCodeFences(stdout), cancelled: false });
        }
      });
    });
  },
};
