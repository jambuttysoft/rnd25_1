import { readFileSync, writeFileSync } from 'fs';
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

/**
 * Validate a policy data object before saving.
 * @param {object} data - The parsed policy JSON
 * @param {string} expectedName - The expected policy_name (e.g. "clear")
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validatePolicy(data, expectedName) {
  const errors = []
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be a JSON object'] }
  }
  if (data.policy_name !== expectedName) {
    errors.push(`policy_name mismatch: expected "${expectedName}", got "${data.policy_name}"`)
  }
  if (!Array.isArray(data.phases)) {
    errors.push('phases must be an array')
  } else if (data.phases.length !== 3) {
    errors.push('phases must have exactly 3 items')
  } else {
    data.phases.forEach((phase, i) => {
      if (!phase.name || typeof phase.name !== 'string') errors.push(`phase[${i}].name is required`)
      if (!phase.description || typeof phase.description !== 'string') errors.push(`phase[${i}].description is required`)
      if (!Array.isArray(phase.allowed)) errors.push(`phase[${i}].allowed must be an array`)
      if (!Array.isArray(phase.restricted)) errors.push(`phase[${i}].restricted must be an array`)
      if (!Array.isArray(phase.forbidden)) errors.push(`phase[${i}].forbidden must be an array`)
    })
  }
  if (!data.project_name || typeof data.project_name !== 'string') {
    errors.push('project_name is required')
  }
  if (!data.description || typeof data.description !== 'string') {
    errors.push('description is required')
  }
  return errors.length ? { valid: false, errors } : { valid: true }
}

/**
 * Write a validated policy to disk.
 * @param {string} name - policy name ("clear", "vague", "contradictory")
 * @param {object} data - validated policy JSON
 */
export function writePolicy(name, data) {
  const filePath = join(POLICY_DIR, `policy_${name}.json`)
  writeFileSync(filePath, JSON.stringify(data, null, 2))
}

/**
 * Reset a policy to its default content.
 * @param {string} name - policy name
 * @returns {object} default policy content (read from disk)
 */
export function resetPolicy(name) {
  return loadPolicy(name)
}
