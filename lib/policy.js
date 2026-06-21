import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICY_DIR = join(__dirname, '..', 'data', 'policy');

export function loadPolicy(name) {
  const valid = ['clear', 'vague', 'contradictory'];
  if (!valid.includes(name)) throw new Error(`Unknown policy: ${name}`);
  return JSON.parse(readFileSync(join(POLICY_DIR, `policy_${name}.json`), 'utf8'));
}

export function policyAsText(policy, phaseIndex) {
  const phase = policy.phases[phaseIndex];
  return [
    `Project: ${policy.project_name}`,
    `Description: ${policy.description}`,
    `Current Phase: ${phase.name}`,
    `Phase Description: ${phase.description}`,
    `Allowed expenses: ${phase.allowed.join(', ')}`,
    `Restricted (need justification): ${phase.restricted.join(', ')}`,
    `Forbidden: ${phase.forbidden.join(', ')}`,
  ].join('\n');
}

export function listPolicies() {
  return ['clear', 'vague', 'contradictory'];
}

export function listPhases(policyName) {
  return loadPolicy(policyName).phases.map((p, i) => ({ index: i, name: p.name }));
}
