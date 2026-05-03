import { AgentPanel, type AgentLiveState } from "./AgentPanel";

interface AgentPanelGridProps {
  agents: Record<string, AgentLiveState>;
  rationale: { specialist: string; reason: string }[];
}

const STATUS_ORDER: Record<AgentLiveState["status"], number> = {
  researching: 0,
  drafting: 1,
  validating: 2,
  idle: 3,
  complete: 4,
  failed: 5,
};

export function AgentPanelGrid({ agents, rationale }: AgentPanelGridProps) {
  const rationaleMap = new Map(rationale.map((r) => [r.specialist, r.reason]));
  const agentList = Object.values(agents).slice().sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99;
    const sb = STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  if (agentList.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No specialists dispatched yet.
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="agent-panel-grid"
    >
      {agentList.map((agent) => (
        <AgentPanel
          key={agent.name}
          agent={agent}
          rationale={rationaleMap.get(agent.name)}
        />
      ))}
    </div>
  );
}
