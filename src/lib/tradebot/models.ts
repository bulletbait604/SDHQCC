export type TradeAction = 'BUY' | 'SELL' | 'HOLD'
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LIMIT'

export type TradeOrderProposal = {
  ticker: string
  action: TradeAction
  order_type: OrderType
  quantity: number
  limit_price: number | null
  stop_loss: number
  take_profit: number
  reasoning_summary: string
}

export type RiskAssessment = {
  approved: boolean
  risk_score: number
  max_portfolio_impact_pct: number
  rejection_reasons: string[]
  adjusted_proposal: TradeOrderProposal | null
}

export type AgentDecision = {
  ticker: string
  sentiment_score: number
  confidence: number
  bull_points: string[]
  bear_points: string[]
  consensus_rating: number
  action: TradeAction
  reasoning_summary: string
}

export type CycleDecision = {
  ticker: string
  signal: string
  price: number
  proposal: TradeOrderProposal
  risk: RiskAssessment
  fill: {
    filled: boolean
    side: TradeAction
    quantity: number
    price: number
    notionalCad: number
    note: string
  } | null
}
