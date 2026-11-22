// Credit saver profiles. A run can never go past its token budget.
export type Saver = "tiny" | "balanced" | "full";

export const PROFILES: Record<Saver, { files: number; budget: number; workers: number; fileChars: number; fixes: number }> = {
  tiny: { files: 8, budget: 30_000, workers: 4, fileChars: 6_000, fixes: 0 },
  balanced: { files: 15, budget: 80_000, workers: 6, fileChars: 12_000, fixes: 1 },
  full: { files: 60, budget: 400_000, workers: 12, fileChars: 40_000, fixes: 2 },
};

export function profile(s?: Saver) {
  const p = PROFILES[s || "tiny"] || PROFILES.tiny;
  const maxW = Number(process.env.SWARM_MAX_WORKERS || 12);
  const maxF = Number(process.env.SWARM_MAX_FILES || 60);
  const maxB = Number(process.env.TOKEN_BUDGET_MAX || 400_000);
  return { ...p, files: Math.min(p.files, maxF), workers: Math.min(p.workers, maxW), budget: Math.min(p.budget, maxB) };
}
