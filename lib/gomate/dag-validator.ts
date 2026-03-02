/**
 * Validates that the task dependency graph is a DAG (no cycles).
 * Returns true if valid (safe to insert), false if a cycle is detected.
 * Uses DFS with three-color marking: white (unvisited), grey (in-progress), black (done).
 */
export function isValidDAG(tasks: { id: string; depends_on: string[] }[]): boolean {
  const state = new Map<string, 'white' | 'grey' | 'black'>()
  for (const t of tasks) state.set(t.id, 'white')

  const adjacency = new Map<string, string[]>()
  for (const t of tasks) adjacency.set(t.id, t.depends_on ?? [])

  function dfs(id: string): boolean {
    const s = state.get(id)
    if (s === 'black') return true   // already fully visited — safe
    if (s === 'grey') return false   // back edge — cycle detected

    state.set(id, 'grey')
    for (const dep of adjacency.get(id) ?? []) {
      if (!dfs(dep)) return false
    }
    state.set(id, 'black')
    return true
  }

  for (const t of tasks) {
    if (state.get(t.id) === 'white') {
      if (!dfs(t.id)) return false
    }
  }
  return true
}
