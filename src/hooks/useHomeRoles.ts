'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ActivityLogEntry, KickUser } from '@/lib/home/types'
import { ROLE_CONFIG, ROLE_HIERARCHY, type Role } from '@/lib/home/roles'
import {
  capOwnerRole,
  hasTabAccessForUser,
  isSiteOwner,
  normalizeKickUsername,
} from '@/lib/home/ownerIdentity'

interface Subscriber {
  id: string
  username: string
  addedAt: string
}

interface LifetimeMember {
  id: string
  username: string
  addedAt: string
}

interface Admin {
  id: string
  username: string
  addedAt: string
}

export interface UseHomeRolesOptions {
  user: KickUser | null
  isVerified: boolean
  isLifetime: boolean
  activeTab: string
  setActiveTab: (tab: string) => void
  setActivityLog: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>
  setIsVerified: (value: boolean) => void
  setIsLifetime: (value: boolean) => void
}

export function useHomeRoles({
  user,
  isVerified,
  isLifetime,
  activeTab,
  setActiveTab,
  setActivityLog,
  setIsVerified,
  setIsLifetime,
}: UseHomeRolesOptions) {
  const [userRole, setUserRole] = useState<Role>('free')
  const [usersWithRoles, setUsersWithRoles] = useState<
    Array<{ id: string; username: string; role: Role; coins?: number }>
  >([])
  const [roleSearchUsername, setRoleSearchUsername] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>('free')
  const [coinGrantUsername, setCoinGrantUsername] = useState('')
  const [coinGrantAmount, setCoinGrantAmount] = useState<number>(10)
  const [isGrantingCoins, setIsGrantingCoins] = useState(false)

  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [lifetimeMembers, setLifetimeMembers] = useState<LifetimeMember[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])

  const [isAdmin, setIsAdmin] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLifetimeMember, setIsLifetimeMember] = useState(false)
  const [isTester, setIsTester] = useState(false)

  const isOwner = isSiteOwner(user?.username)

  const hasTabAccess = useCallback(
    (tabId: string) => hasTabAccessForUser(userRole, tabId, user?.username),
    [userRole, user?.username]
  )

  useEffect(() => {
    if (!isOwner && activeTab === 'clip-editor') {
      setActiveTab('educate')
    }
  }, [activeTab, isOwner, setActiveTab])

  const fetchUsersWithRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/roles', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUsersWithRoles(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users with roles:', error)
    }
  }, [])

  const fetchUserRole = useCallback(async () => {
    if (!user) return
    try {
      const response = await fetch(`/api/roles?username=${user.username}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data.user && data.user.role) {
          setUserRole(capOwnerRole(user.username, data.user.role as Role))
        } else if (isOwner) {
          setUserRole('owner')
          fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username: user.username,
              role: 'owner',
              currentAdminRole: 'owner',
            }),
          }).then(() => fetchUsersWithRoles())
        } else {
          setUserRole('free')
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      setUserRole(isOwner ? 'owner' : 'free')
    }
  }, [user, isOwner, fetchUsersWithRoles])

  useEffect(() => {
    if (user?.username) {
      void fetchUserRole()
      void fetchUsersWithRoles()
    }
  }, [user, fetchUserRole, fetchUsersWithRoles])

  const fetchUserLists = useCallback(async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data.subscribers !== undefined) setSubscribers(data.subscribers || [])
        if (data.admins !== undefined) setAdmins(data.admins || [])
        if (data.lifetimeMembers !== undefined) setLifetimeMembers(data.lifetimeMembers || [])
      } else if (response.status !== 401 && response.status !== 403) {
        console.error('Failed to fetch user lists:', response.status)
      }
    } catch (error) {
      console.error('Error fetching user lists:', error)
    }
  }, [])

  useEffect(() => {
    const normalizedUsername = normalizeKickUsername(user?.username || '')
    const isAdminValue = user
      ? isOwner || admins.some((admin) => normalizeKickUsername(admin.username) === normalizedUsername)
      : false
    const isSubscribedValue = user
      ? isVerified || subscribers.some((sub) => normalizeKickUsername(sub.username) === normalizedUsername)
      : false
    const isLifetimeMemberValue = user
      ? isLifetime ||
        lifetimeMembers.some((member) => normalizeKickUsername(member.username) === normalizedUsername)
      : false
    const userWithRole = usersWithRoles.find(
      (u) =>
        typeof u.username === 'string' && normalizeKickUsername(u.username) === normalizedUsername
    )
    const isTesterValue = userWithRole?.role === 'tester'

    setIsAdmin(isAdminValue)
    setIsSubscribed(isSubscribedValue)
    setIsLifetimeMember(isLifetimeMemberValue)
    setIsTester(isTesterValue)

    const dbRoleRaw = userWithRole?.role as Role | undefined
    const dbRole = dbRoleRaw ? capOwnerRole(normalizedUsername, dbRoleRaw) : undefined
    const sessionRoleRaw = (user?.role as Role | undefined) || undefined
    const sessionRole = sessionRoleRaw ? capOwnerRole(normalizedUsername, sessionRoleRaw) : undefined

    if (isOwner) {
      setUserRole('owner')
    } else if (isAdminValue) {
      setUserRole('admin')
    } else if (
      dbRole === 'subscriber_lifetime' ||
      sessionRole === 'subscriber_lifetime' ||
      isLifetimeMemberValue
    ) {
      setUserRole('subscriber_lifetime')
    } else if (dbRole === 'free' || sessionRole === 'free') {
      setUserRole('free')
    } else if (dbRole === 'subscriber' || sessionRole === 'subscriber' || isSubscribedValue) {
      setUserRole('subscriber')
    } else if (dbRole === 'editor' || sessionRole === 'editor') {
      setUserRole('editor')
    } else if (dbRole === 'tester' || sessionRole === 'tester' || isTesterValue) {
      setUserRole('tester')
    } else if (dbRole) {
      setUserRole(dbRole)
    } else if (sessionRole && sessionRole in ROLE_HIERARCHY) {
      setUserRole(sessionRole)
    } else {
      setUserRole('free')
    }
  }, [user, isOwner, admins, subscribers, lifetimeMembers, isVerified, isLifetime, usersWithRoles])

  useEffect(() => {
    if (!user?.username) return
    const normalized = normalizeKickUsername(user.username)
    const row = usersWithRoles.find(
      (u) => typeof u.username === 'string' && normalizeKickUsername(u.username) === normalized
    )
    const canFetchLists =
      isOwner ||
      userRole === 'admin' ||
      userRole === 'owner' ||
      row?.role === 'admin' ||
      row?.role === 'owner'
    if (!canFetchLists) return
    void fetchUserLists()
  }, [user, isOwner, userRole, usersWithRoles, fetchUserLists])

  const handleUpdateRole = useCallback(
    async (username: string, newRole: Role) => {
      const target = normalizeKickUsername(username)
      if (newRole === 'owner' && !isSiteOwner(target)) {
        alert('Owner role is reserved for Bulletbait604 only.')
        return
      }

      try {
        const response = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: target,
            role: newRole,
            currentAdminRole: userRole,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          await fetchUsersWithRoles()
          if (target === normalizeKickUsername(user?.username || '')) {
            await fetchUserRole()
            const meRes = await fetch('/api/me', { credentials: 'include' })
            if (meRes.ok) {
              const me = await meRes.json()
              setIsVerified(!!me.subscription?.isVerified)
              setIsLifetime(!!me.subscription?.isLifetime)
            }
          }

          const roleEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user?.username || 'Unknown',
            timestamp: new Date().toISOString(),
            action: 'role_updated',
            details: `Changed ${username}'s role to ${ROLE_CONFIG[newRole].label}`,
          }
          setActivityLog((prev) => [roleEntry, ...prev].slice(0, 100))

          fetch('/api/activity-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username: user?.username,
              action: 'role_updated',
              details: `Changed ${username}'s role to ${ROLE_CONFIG[newRole].label}`,
            }),
          }).catch((error) => console.error('Failed to log to backend:', error))

          alert(`Role updated to ${ROLE_CONFIG[newRole].label}`)
        } else {
          alert(data.message || 'Failed to update role')
        }
      } catch (error) {
        console.error('Error updating role:', error)
        alert('Failed to update role')
      }
    },
    [
      user,
      userRole,
      fetchUsersWithRoles,
      fetchUserRole,
      setActivityLog,
      setIsVerified,
      setIsLifetime,
    ]
  )

  const handleDeleteUser = useCallback(
    async (username: string) => {
      if (!confirm(`Are you sure you want to remove ${username} from the role system?`)) {
        return
      }

      try {
        const response = await fetch(`/api/roles?username=${username}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok) {
          await fetchUsersWithRoles()
          if (normalizeKickUsername(username) === normalizeKickUsername(user?.username || '')) {
            await fetchUserRole()
          }
          alert(`${username} removed from role system`)
        } else {
          alert(data.message || 'Failed to delete user')
        }
      } catch (error) {
        console.error('Error deleting user:', error)
        alert('Failed to delete user')
      }
    },
    [user, fetchUsersWithRoles, fetchUserRole]
  )

  const handleGrantCoins = useCallback(
    async (amount: number) => {
      if (!user || !coinGrantUsername.trim() || amount === 0) return

      setIsGrantingCoins(true)
      try {
        const response = await fetch('/api/coins/admin-adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            targetUsername: coinGrantUsername.trim().toLowerCase(),
            coins: amount,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          const base = data.error || 'Failed to adjust coins'
          if (response.status === 401 || String(base).includes('authentication token')) {
            throw new Error(
              `${base} Sign out and sign in with Kick again — your browser needs a fresh session cookie for admin actions.`
            )
          }
          throw new Error(base)
        }

        const entry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: amount >= 0 ? 'coin_grant' : 'coin_remove',
          details: `${amount >= 0 ? 'Granted' : 'Removed'} ${Math.abs(amount)} coins for ${coinGrantUsername.trim().toLowerCase()}`,
        }
        setActivityLog((prev) => [entry, ...prev].slice(0, 100))

        setCoinGrantUsername('')
        setCoinGrantAmount(10)
        void fetchUsersWithRoles()
        const action = amount >= 0 ? 'Added' : 'Removed'
        alert(`${action} ${Math.abs(amount)} coins for ${data.targetUsername}. New balance: ${data.balance}`)
      } catch (error) {
        console.error('Error adjusting coins:', error)
        alert(error instanceof Error ? error.message : 'Failed to adjust coins')
      } finally {
        setIsGrantingCoins(false)
      }
    },
    [user, coinGrantUsername, setActivityLog, fetchUsersWithRoles]
  )

  const refreshRoles = useCallback(() => {
    void fetchUsersWithRoles()
    void fetchUserRole()
    void fetchUserLists()
  }, [fetchUsersWithRoles, fetchUserRole, fetchUserLists])

  const userType = userRole

  const staffCanViewActivity = useMemo(
    () => userRole === 'admin' || userRole === 'owner' || isOwner,
    [userRole, isOwner]
  )

  return {
    userRole,
    userType,
    isOwner,
    isAdmin,
    isSubscribed,
    isLifetimeMember,
    isTester,
    hasTabAccess,
    usersWithRoles,
    roleSearchUsername,
    setRoleSearchUsername,
    selectedRole,
    setSelectedRole,
    coinGrantUsername,
    setCoinGrantUsername,
    coinGrantAmount,
    setCoinGrantAmount,
    isGrantingCoins,
    handleUpdateRole,
    handleDeleteUser,
    handleGrantCoins,
    fetchUserRole,
    fetchUsersWithRoles,
    fetchUserLists,
    refreshRoles,
    staffCanViewActivity,
  }
}
