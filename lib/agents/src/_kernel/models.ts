export const DEFAULT_AGENT_MODEL = "claude-sonnet-4-6" as const;

export const EXTRACTOR_MODEL = "claude-haiku-4-5" as const;

export const HEALTH_PROBE_MODEL = "claude-haiku-4-5" as const;

export type AgentModelId =
  | typeof DEFAULT_AGENT_MODEL
  | typeof EXTRACTOR_MODEL
  | typeof HEALTH_PROBE_MODEL;
