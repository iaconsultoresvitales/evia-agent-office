/** Persona display-name mappings. IDs, folders, task ownership and history never change. */
export const EVIA_AGENT_RENAMES = [
  { id: "direccion-ia-evia", previous: "Fabiana", name: "Zen O Sama" },
  { id: "product-delivery", previous: "Vale", name: "18" },
  { id: "caio-account-manager", previous: "Viri", name: "Vegeta" },
  { id: "tayde", previous: "Tayde", name: "Oolong" },
  { id: "authority-growth", previous: "Cecy", name: "Bulma" },
  { id: "marielis", previous: "Marielis", name: "Goku" },
  { id: "revenue-agent", previous: "Marisol", name: "May" },
  { id: "finance-operations", previous: "Kenia", name: "Videl" },
  { id: "lauren", previous: "Lauren", name: "Bills" },
] as const;

export const eviaAgentDisplayName = (id: string): string =>
  EVIA_AGENT_RENAMES.find((agent) => agent.id === id)?.name ?? id;
