/** Server-defined coin costs for AI tools (client cannot override). */
export const TOOL_COIN_COSTS = {
  'tag-generator': 1,
  'thumbnail-generator': 2,
  'clip-analyzer': 2,
  post4me: 2,
  'background-remover': 0,
  'content-analyzer': 2,
  'viral-clip-gen': 4,
} as const

export type ToolCoinName = keyof typeof TOOL_COIN_COSTS

export function toolCoinCost(tool: string): number | undefined {
  if (tool in TOOL_COIN_COSTS) {
    return TOOL_COIN_COSTS[tool as ToolCoinName]
  }
  return undefined
}
