/** Server-defined coin costs for AI tools (client cannot override). */
export const TOOL_COIN_COSTS = {
  'tag-generator': 1,
  'thumbnail-generator': 2,
  'clip-analyzer': 2,
  post4me: 2,
  'background-remover': 0,
  'content-analyzer': 2,
  'clip-editor-plan': 2,
  'clip-editor-runway': 3,
  'clip-editor-cut': 1,
  'clip-editor-finish': 1,
  'clip-editor-effects': 1,
  'clip-editor-text': 1,
} as const

export type ToolCoinName = keyof typeof TOOL_COIN_COSTS

export function toolCoinCost(tool: string): number | undefined {
  if (tool in TOOL_COIN_COSTS) {
    return TOOL_COIN_COSTS[tool as ToolCoinName]
  }
  return undefined
}
