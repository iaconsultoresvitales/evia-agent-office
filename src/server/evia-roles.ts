import path from "node:path";
import { PKG_ROOT } from "./config.js";
import { parseAgentFile } from "./agents.js";

// Fixed allowlist: never interpolate arbitrary request input into a filesystem path.
export const EVIA_ROLE_IDS = [
  "director-ia",
  "radar-competitivo",
  "growth-comercial",
  "operaciones",
  "revenue-agent",
  "caio-account-manager",
  "finance-operations",
  "authority-growth",
  "product-delivery",
] as const;

export interface EviaRolePreset {
  id: (typeof EVIA_ROLE_IDS)[number];
  name: string;
  role: string;
  color: string;
  permissionMode: "plan";
  prompt: string;
}

// Read canonical versioned templates. Selecting a role does not hire, run or authorize an agent.
export function listEviaRolePresets(): EviaRolePreset[] {
  return EVIA_ROLE_IDS.map((id) => {
    const file = path.join(PKG_ROOT, "evia", "roles", id, "agent.md");
    const { meta, body } = parseAgentFile(file);
    if (!meta.name || !meta.role || !/^#[0-9a-f]{6}$/i.test(meta.color ?? "") ||
        meta.permissionMode !== "plan" || !body || body.length > 20000) {
      throw new Error(`Invalid EVIA agent template: ${id}`);
    }
    return {
      id, name: meta.name, role: meta.role, color: meta.color,
      permissionMode: "plan", prompt: body,
    };
  });
}
