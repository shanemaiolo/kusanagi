export interface ProviderResult {
  text: string;
  cancelled: boolean;
}

export interface ProviderRunParams {
  prompt: string;
  context: string;
  language: string;
  signal?: AbortSignal;
  fileContent?: string;
  contextType?: "selection" | "block" | "line" | null;
}

export interface Provider {
  readonly name: string;
  readonly id: string;
  run(params: ProviderRunParams): Promise<ProviderResult>;
}

import { claudeProvider } from "./providers/claude";
import { opencodeProvider } from "./providers/opencode";

const providers: Record<string, Provider> = {
  claude: claudeProvider,
  opencode: opencodeProvider,
};

export function getProvider(id: string): Provider {
  const provider = providers[id];
  if (!provider) {
    throw new Error(
      `Unknown provider "${id}". Available: ${Object.keys(providers).join(", ")}`
    );
  }
  return provider;
}
