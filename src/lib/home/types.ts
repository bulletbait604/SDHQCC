export type HomeLanguage = 'en' | 'es' | 'fr' | 'de'

export interface KickUser {
  id: string
  username: string
  display_name: string
  profile_image_url?: string
  role?: string
  kick?: {
    provider?: 'kick'
    lastSyncedAt?: string
    providerUserId?: string
    extras?: Record<string, string>
  }
}

export interface AlgorithmData {
  keyChanges: string
  editingTips: string
  postingTips: string
  titleTips: string
  descriptionTips: string
  summaries?: string[]
}

export interface Platform {
  id: string
  name: string
  image: string
  data: AlgorithmData | null
}

export interface Subscriber {
  id: string
  username: string
  addedAt: string
}

export interface LifetimeMember {
  id: string
  username: string
  addedAt: string
}

export interface Admin {
  id: string
  username: string
  addedAt: string
}

export type ActivityLogAction =
  | 'login'
  | 'logout'
  | 'payment_success'
  | 'payment_failed'
  | 'verification_attempt'
  | 'access_expired'
  | 'algorithm_refresh'
  | 'tag_generation'
  | 'clip_analysis'
  | 'clip_reanalysis'
  | 'content_analysis'
  | 'content_reanalysis'
  | 'subscriber_added'
  | 'subscriber_removed'
  | 'lifetime_added'
  | 'lifetime_removed'
  | 'admin_added'
  | 'admin_removed'
  | 'sync_completed'
  | 'role_updated'
  | 'thumbnail_generation'
  | 'post4me_generation'
  | 'token_grant'
  | 'token_purchase'
  | 'subscription_payment'
  | 'subscription_activated'
  | 'subscription_deactivated'
  | 'subscription_cancelled'
  | 'subscription_suspended'
  | 'subscription_expired'
  | 'lifetime_payment'
  | 'coin_grant'
  | 'coin_remove'
  | 'coin_purchase'
  | 'donation_initiated'
  | 'donation_completed'

export interface ActivityLogEntry {
  id: string
  username: string
  timestamp: string
  action: ActivityLogAction
  details?: string
  estimatedCostUsd?: number
  estimatedCostNote?: string
}

export interface KickClipItem {
  id: string
  title: string
  thumbnailUrl: string | null
  clipUrl: string
  sourceVideoUrl: string | null
  createdAt: string | null
}
