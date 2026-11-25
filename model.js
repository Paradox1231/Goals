export const done = m => m.steps.length ? m.steps.every(s => s.done) : m.done;
export const count = g => g.milestones.filter(done).length;
export const ready = g => g.milestones.length > 0 && count(g) === g.milestones.length;
export const ordered = g => [...g.milestones].sort((a,b) => Number(done(a)) - Number(done(b)));
export function move(items, id, target) {
  const from = items.findIndex(i => i.id === id), to = items.findIndex(i => i.id === target);
  if (from < 0 || to < 0 || from === to) return;
  items.splice(to, 0, items.splice(from, 1)[0]);
}
export function toggle(m, stepId) {
  if (stepId) {
    const step = m.steps.find(s => s.id === stepId);
    if (step) step.done = !step.done;
  } else if (!m.steps.length) m.done = !m.done;
}
