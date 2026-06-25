export const OWNER_USERNAMES = ['bulletbait604'] as const

/** @see isSiteOwner in ownerIdentity.ts — only these accounts get owner UI/API access */

export const ROLE_HIERARCHY = {
  free: 1,
  subscriber: 2,
  subscriber_lifetime: 3,
  editor: 4,
  admin: 5,
  owner: 6,
  tester: 7,
} as const

export type Role = keyof typeof ROLE_HIERARCHY

export const ROLE_CONFIG = {
  owner: {
    badge: '👑',
    rank: 6,
    label: 'Owner',
    badgeClass: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  },
  admin: {
    badge: '🛡',
    rank: 5,
    label: 'Admin',
    badgeClass: 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black',
  },
  editor: {
    badge: '🎬',
    rank: 4,
    label: 'Editor',
    badgeClass: 'bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white',
  },
  subscriber_lifetime: {
    badge: '💎',
    rank: 3,
    label: 'Lifetime Subscriber',
    badgeClass: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black',
  },
  subscriber: {
    badge: '⭐',
    rank: 2,
    label: 'Subscriber',
    badgeClass: 'bg-gradient-to-r from-sdhq-green-500 to-sdhq-cyan-500 text-black',
  },
  free: {
    badge: '🙂',
    rank: 1,
    label: 'Free User',
    badgeClass: 'bg-gray-500 text-white',
  },
  tester: {
    badge: '🧪',
    rank: 7,
    label: 'Tester',
    badgeClass: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white',
  },
} as const

export const TAB_PERMISSIONS: Record<Role, Record<string, boolean>> = {
  free: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': false,
    'background-remover': true,
  },
  subscriber: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': false,
    'background-remover': true,
  },
  subscriber_lifetime: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': false,
    'background-remover': true,
  },
  editor: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': false,
    'background-remover': true,
  },
  admin: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': false,
    'background-remover': true,
  },
  owner: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': true,
    'background-remover': true,
  },
  tester: {
    educate: true,
    create: true,
    analyze: true,
    'tag-generator-free': true,
    'thumbnail-generator': true,
    'clip-analyzer': true,
    'clip-editor': false,
    'background-remover': true,
  },
}

export { isSiteOwner, capOwnerRole, hasTabAccessForUser, normalizeKickUsername } from '@/lib/home/ownerIdentity'
