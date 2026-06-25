'use client'

import { Button } from '@/components/ui/button'
import OwnerBannedUsersPanel from '@/app/components/OwnerBannedUsersPanel'
import {
  Settings,
  Globe,
  Moon,
  Mail,
  Loader2,
  Crown,
  TrendingUp,
  RefreshCw,
  Trash2,
  CheckCircle,
  Plus,
  Minus,
} from 'lucide-react'
import type { ActivityLogEntry, HomeLanguage, KickUser, Platform } from '@/lib/home/types'
import type { Role } from '@/lib/home/roles'
import { ROLE_CONFIG } from '@/lib/home/roles'
import { formatActivityActionLabel, formatEstimatedUsd } from '@/lib/home/activityLogUtils'

export interface SettingsTabProps {
  darkMode: boolean
  cardClasses: string
  language: HomeLanguage
  onLanguageChange: (lang: HomeLanguage) => void
  onDarkModeToggle: () => void
  settingsTitle: string
  languageLabel: string
  darkModeLabel: string
  lightModeLabel: string
  user: KickUser | null
  userRole: Role
  isOwner: boolean
  isAdmin: boolean
  feedbackReplyEmail: string
  setFeedbackReplyEmail: (value: string) => void
  feedbackMessage: string
  setFeedbackMessage: (value: string) => void
  feedbackSending: boolean
  onSubmitStaffFeedback: () => void
  onLifetimePassCheckout: () => void
  activityLog: ActivityLogEntry[]
  refreshActivityLog: () => void
  onRequestClearActivityLog: () => void
  filterAction: string
  setFilterAction: (value: string) => void
  filterUser: string
  setFilterUser: (value: string) => void
  filterDate: string
  setFilterDate: (value: string) => void
  roleSearchUsername: string
  setRoleSearchUsername: (value: string) => void
  selectedRole: Role
  setSelectedRole: (role: Role) => void
  onUpdateRole: (username: string, role: Role) => void
  onRefreshRoles: () => void
  coinGrantUsername: string
  setCoinGrantUsername: (value: string) => void
  coinGrantAmount: number
  setCoinGrantAmount: (value: number) => void
  isGrantingCoins: boolean
  onGrantCoins: (amount: number) => void
  usersWithRoles: Array<{ id: string; username: string; role: Role; coins?: number }>
  onDeleteUser: (username: string) => void
  platforms: Platform[]
  onRefreshAlgorithms: (platformId?: string) => void
  isLoadingAlgorithms: boolean
}

export default function SettingsTab({
  darkMode,
  cardClasses,
  language,
  onLanguageChange,
  onDarkModeToggle,
  settingsTitle,
  languageLabel,
  darkModeLabel,
  lightModeLabel,
  user,
  userRole,
  isOwner,
  isAdmin,
  feedbackReplyEmail,
  setFeedbackReplyEmail,
  feedbackMessage,
  setFeedbackMessage,
  feedbackSending,
  onSubmitStaffFeedback,
  onLifetimePassCheckout,
  activityLog,
  refreshActivityLog,
  onRequestClearActivityLog,
  filterAction,
  setFilterAction,
  filterUser,
  setFilterUser,
  filterDate,
  setFilterDate,
  roleSearchUsername,
  setRoleSearchUsername,
  selectedRole,
  setSelectedRole,
  onUpdateRole,
  onRefreshRoles,
  coinGrantUsername,
  setCoinGrantUsername,
  coinGrantAmount,
  setCoinGrantAmount,
  isGrantingCoins,
  onGrantCoins,
  usersWithRoles,
  onDeleteUser,
  platforms,
  onRefreshAlgorithms,
  isLoadingAlgorithms,
}: SettingsTabProps) {
  return (
<div className={`py-8 ${cardClasses}`}>
  <div className="flex flex-col items-center mb-6">
    <div className="flex items-center space-x-3 mb-3">
      <Settings className="w-8 h-8 text-sdhq-cyan-500" />
      <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{settingsTitle}</h3>
    </div>
  </div>
  
  <div className="max-w-2xl mx-auto space-y-6 px-6">
    {/* Language Setting */}
    <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200 shadow-sm'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Globe className="w-5 h-5 text-sdhq-cyan-500" />
          <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{languageLabel}</span>
        </div>
        <select 
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as HomeLanguage)}
          className={`px-3 py-2 rounded-md border ${
            darkMode 
              ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </div>

    {/* Dark Mode Setting */}
    <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200 shadow-sm'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Moon className="w-5 h-5 text-sdhq-cyan-500" />
          <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{darkMode ? darkModeLabel : lightModeLabel}</span>
        </div>
        <button
          onClick={onDarkModeToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            darkMode ? 'bg-sdhq-cyan-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              darkMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>

    {/* Staff feedback — everyone except owner */}
    {user && userRole !== 'owner' && !isOwner && (
      <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-sdhq-cyan-500 shrink-0" />
          <div>
            <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Contact staff
            </span>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Send a note to our team at bulletbait604@gmail.com. Your Kick username is included automatically.
            </p>
          </div>
        </div>
        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Your email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={feedbackReplyEmail}
          onChange={(e) => setFeedbackReplyEmail(e.target.value)}
          placeholder="you@example.com"
          className={`w-full px-3 py-2 rounded-md border mb-3 text-base ${
            darkMode
              ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          }`}
        />
        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Message
        </label>
        <textarea
          value={feedbackMessage}
          onChange={(e) => setFeedbackMessage(e.target.value)}
          rows={5}
          placeholder="Describe your question, bug report, or suggestion..."
          className={`w-full px-3 py-2 rounded-md border mb-3 text-base resize-y min-h-[120px] ${
            darkMode
              ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          }`}
        />
        <Button
          type="button"
          onClick={onSubmitStaffFeedback}
          disabled={feedbackSending}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
        >
          {feedbackSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Sending…
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 shrink-0" />
              Send to staff
            </>
          )}
        </Button>
      </div>
    )}

    {/* Lifetime Pass - Free users only */}
    {userRole === 'free' && (
      <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-200 shadow-sm'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className="w-5 h-5 text-sdhq-cyan-500" />
            <div>
              <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Lifetime Pass</span>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>One-time payment for lifetime access</p>
            </div>
          </div>
          <Button
            onClick={onLifetimePassCheckout}
            className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
          >
            <Crown className="w-4 h-4 mr-1" />
            Get Lifetime Pass
          </Button>
        </div>
      </div>
    )}

    {(userRole === 'owner' || isOwner) && (
      <OwnerBannedUsersPanel darkMode={darkMode} />
    )}

    {/* Activity Feed - Admin and Owner only */}
    {(userRole === 'admin' || userRole === 'owner') && (
      <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`font-semibold flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <TrendingUp className="w-5 h-5 mr-2 text-sdhq-green-500" />
            Activity Feed
          </h4>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshActivityLog}
              className={darkMode ? 'border-sdhq-dark-600 text-white' : 'border-sdhq-cyan-300 text-gray-900'}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {activityLog.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onRequestClearActivityLog}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <p className={`text-xs mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          API cost hints (USD) are approximate for thumbnails, tags, and clip analysis. Tune with{' '}
          <code className={darkMode ? 'text-gray-400' : 'text-gray-700'}>ESTIMATE_*</code>{' '}
          env vars (see{' '}
          <code className={darkMode ? 'text-gray-400' : 'text-gray-700'}>estimatedInferenceCost.ts</code>
          ).
        </p>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Event Type</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className={`w-full px-2 py-1.5 rounded text-base border ${
                darkMode 
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                  : 'bg-cyan-50 border-cyan-300 text-black'
              }`}
            >
              <option value="all">All Events</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="payment_success">Payment Success</option>
              <option value="payment_failed">Payment Failed</option>
              <option value="verification_attempt">Verification Attempt</option>
              <option value="access_expired">Access Expired</option>
              <option value="algorithm_refresh">Algorithm Refresh</option>
              <option value="tag_generation">Tag Generation</option>
              <option value="thumbnail_generation">Thumbnail Generation</option>
              <option value="clip_analysis">Clip Analysis</option>
              <option value="coin_purchase">Coin Purchase</option>
              <option value="lifetime_payment">Lifetime Purchase</option>
              <option value="subscription_payment">Subscription Payment</option>
              <option value="subscription_activated">Subscription Activated</option>
              <option value="subscription_deactivated">Subscription Deactivated</option>
            </select>
          </div>
          <div>
            <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>User</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className={`w-full px-2 py-1.5 rounded text-base border ${
                darkMode 
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                  : 'bg-cyan-50 border-cyan-300 text-black'
              }`}
            >
              <option value="all">All Users</option>
              {Array.from(new Set(activityLog.map(e => e.username))).map(username => (
                <option key={username} value={username}>{username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-sm font-medium mb-1 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Date</label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={`w-full px-2 py-1.5 rounded text-base border ${
                darkMode 
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                  : 'bg-cyan-50 border-cyan-300 text-black'
              }`}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
        
        <div className={`space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
          {activityLog.length === 0 ? (
            <p className={`text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No activity yet.</p>
          ) : (
            activityLog
              .filter((entry: ActivityLogEntry) => {
                if (filterAction !== 'all' && entry.action !== filterAction) return false
                if (filterUser !== 'all' && entry.username !== filterUser) return false
                if (filterDate !== 'all') {
                  const entryDate = new Date(entry.timestamp)
                  const now = new Date()
                  if (filterDate === 'today') {
                    return entryDate.toDateString() === now.toDateString()
                  } else if (filterDate === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    return entryDate >= weekAgo
                  } else if (filterDate === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                    return entryDate >= monthAgo
                  }
                }
                return true
              })
              .map((entry: ActivityLogEntry) => {
              const getActionColor = () => {
                switch (entry.action) {
                  case 'login': return 'text-blue-500'
                  case 'logout': return 'text-purple-500'
                  case 'payment_success': return 'text-green-500'
                  case 'payment_failed': return 'text-red-500'
                  case 'verification_attempt': return 'text-yellow-500'
                  case 'access_expired': return 'text-orange-500'
                  case 'algorithm_refresh': return 'text-cyan-400'
                  case 'tag_generation': return 'text-pink-400'
                  case 'thumbnail_generation': return 'text-amber-400'
                  case 'clip_analysis': return 'text-violet-400'
                  case 'clip_reanalysis': return 'text-violet-300'
                  default: return 'text-sdhq-cyan-500'
                }
              }
              const getActionIcon = () => {
                switch (entry.action) {
                  case 'login': return ''
                  case 'logout': return ' '
                  case 'payment_success': return ''
                  case 'payment_failed': return ''
                  case 'verification_attempt': return ''
                  case 'access_expired': return ''
                  case 'algorithm_refresh': return 'Refresh'
                  default: return ''
                }
              }
              return (
                <div 
                  key={entry.id}
                  className={`p-2 rounded border ${
                    darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{getActionIcon()}</span>
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{entry.username}</span>
                      <span className={`text-sm font-semibold uppercase ${getActionColor()}`}>
                        {formatActivityActionLabel(entry.action)}
                      </span>
                    </div>
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {entry.details && (
                    <p className={`text-sm mt-1 pl-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {entry.details}
                    </p>
                  )}
                  {entry.estimatedCostUsd !== undefined &&
                    Number.isFinite(entry.estimatedCostUsd) && (
                      <p
                        className={`text-xs mt-1 pl-6 ${darkMode ? 'text-amber-200/90' : 'text-amber-900'}`}
                      >
                        ≈{' '}
                        <span className="font-medium">
                          {formatEstimatedUsd(entry.estimatedCostUsd)} USD
                        </span>{' '}
                        <span className="opacity-80">(estimated API)</span>
                        {entry.estimatedCostNote
                          ? ` — ${entry.estimatedCostNote}`
                          : ''}
                      </p>
                    )}
                </div>
              )
            })
          )}
        </div>
      </div>
    )}

    {/* Role Management - Owner Only (NEW SYSTEM) */}
    {isOwner && (
      <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-yellow-500/30' : 'bg-gray-50 border-yellow-300'}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`font-semibold flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <Crown className="w-5 h-5 mr-2 text-yellow-500" />
            Role Management (New System)
          </h4>
          <Button
            onClick={onRefreshRoles}
            size="sm"
            variant="outline"
            className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
        
        {/* Search and Assign Role */}
        <div className="space-y-3 mb-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={roleSearchUsername}
              onChange={(e) => setRoleSearchUsername(e.target.value)}
              placeholder="Enter username to assign role..."
              className={`flex-1 px-3 py-2 rounded-md border ${
                darkMode 
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              className={`px-3 py-2 rounded-md border ${
                darkMode 
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="free">Free User</option>
              <option value="subscriber">Subscriber</option>
              <option value="subscriber_lifetime">Lifetime Subscriber</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="tester">Tester</option>
              {isOwner ? <option value="owner">Owner (Bulletbait604 only)</option> : null}
            </select>
            <Button 
              onClick={() => roleSearchUsername && onUpdateRole(roleSearchUsername, selectedRole)}
              disabled={!roleSearchUsername}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Assign
            </Button>
          </div>
        </div>

        {/* Manual Coin Grant */}
        <div className="space-y-2 mb-4">
          <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Manual Coin Grant (+/-)
          </p>
          <div className="flex space-x-2">
            <select
              value={coinGrantUsername}
              onChange={(e) => setCoinGrantUsername(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-md border ${
                darkMode
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">Select user...</option>
              {usersWithRoles
                .map((u: any) => String(u.username || '').toLowerCase())
                .filter((u, idx, arr) => u && arr.indexOf(u) === idx)
                .sort((a, b) => a.localeCompare(b))
                .map((username) => (
                  <option key={username} value={username}>
                    {username}
                  </option>
                ))}
            </select>
            <div className={`flex items-center space-x-1 rounded-md border px-2 ${
              darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-white border-gray-300'
            }`}>
              <button
                onClick={() => setCoinGrantAmount(Math.max(-1000, coinGrantAmount - 1))}
                className={`p-1 rounded ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                type="button"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                value={coinGrantAmount}
                onChange={(e) => setCoinGrantAmount(parseInt(e.target.value || '0', 10))}
                className={`w-16 text-center bg-transparent border-none focus:outline-none ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}
              />
              <button
                onClick={() => setCoinGrantAmount(Math.min(1000, coinGrantAmount + 1))}
                className={`p-1 rounded ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                type="button"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <Button
              onClick={() => onGrantCoins(coinGrantAmount)}
              disabled={!coinGrantUsername.trim() || coinGrantAmount === 0 || isGrantingCoins}
              className={`${
                coinGrantAmount >= 0 
                  ? 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black'
                  : 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
              }`}
            >
              {isGrantingCoins ? 'Processing...' : coinGrantAmount >= 0 ? 'Add Coins' : 'Remove Coins'}
            </Button>
          </div>
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Use + to add coins, - to remove. User list is synced from Role Management.
          </p>
        </div>
        
        {/* Users with Roles List */}
        <div className={`space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
          {usersWithRoles.length === 0 ? (
            <p className={`text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No users with roles yet.</p>
          ) : (
            usersWithRoles.map((u: any) => (
              <div 
                key={u.id}
                className={`flex items-center justify-between p-2 rounded border ${
                  darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`text-lg`}>{ROLE_CONFIG[u.role as Role]?.badge || '❓'}</span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{u.username}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    darkMode ? 'bg-sdhq-dark-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {ROLE_CONFIG[u.role as Role]?.label || u.role}
                  </span>
                  <span
                    className={`text-xs tabular-nums px-2 py-1 rounded ${
                      darkMode
                        ? 'bg-amber-900/35 text-amber-100'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                    title="Coin balance (Mongo coinBalances)"
                  >
                    🪙{' '}
                    {typeof u.coins === 'number' ? u.coins : '—'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={u.role}
                    onChange={(e) => onUpdateRole(u.username, e.target.value as Role)}
                    className={`px-2 py-1 rounded text-sm border ${
                      darkMode 
                        ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="free">Free</option>
                    <option value="subscriber">Subscriber</option>
                    <option value="subscriber_lifetime">Lifetime</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="tester">Tester</option>
                    {isOwner ? <option value="owner">Owner</option> : null}
                  </select>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onDeleteUser(u.username)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove from role system"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )}


    {/* Admin Tools — algorithm refresh (same actions as Algorithms Explained tab) */}
    {isAdmin && (
      <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
        <h4 className={`font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          <Settings className="w-5 h-5 mr-2 text-sdhq-cyan-500" />
          Admin Tools
        </h4>
        
        <div className="space-y-4">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefreshAlgorithms()}
              disabled={isLoadingAlgorithms}
              className="w-full"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {isLoadingAlgorithms ? 'Refreshing All...' : 'Refresh All Algorithms'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {platforms.map((platform) => (
              <Button
                key={platform.id}
                variant="outline"
                size="sm"
                onClick={() => onRefreshAlgorithms(platform.id)}
                disabled={isLoadingAlgorithms}
                className="text-sm"
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                {platform.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
</div>
  )
}
