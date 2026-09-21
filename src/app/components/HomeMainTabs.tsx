'use client'

import { useEffect, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Settings, LayoutGrid, Wand2, GraduationCap, BarChart3, FlaskConical } from 'lucide-react'
import ResourceHubTab from '@/app/components/ResourceHubTab'
import CreateTabHeader, { type CreateSubTab } from '@/app/components/CreateTabHeader'
import RdTabHeader, { ALL_RD_SUBS, type RdSubTab } from '@/app/components/RdTabHeader'
import UserAppsIdeaTab from '@/app/components/UserAppsIdeaTab'
import TagGeneratorTab from '@/app/components/TagGeneratorTab'
import ThumbnailGenerator from '@/app/components/ThumbnailGenerator'
import Post4MeTab from '@/app/components/Post4MeTab'
import BackgroundRemoverTab from '@/app/components/BackgroundRemoverTab'
import AnalyzeTab from '@/app/components/AnalyzeTab'
import TrendingVidsTab from '@/app/components/TrendingVidsTab'
import SettingsTab from '@/app/components/SettingsTab'
import type { ActivityLogEntry, HomeLanguage, KickUser, Platform } from '@/lib/home/types'
import type { Role } from '@/lib/home/roles'
import type { ToolType } from '@/hooks/useCoins'
import type { useClipAnalyzer } from '@/hooks/useClipAnalyzer'

type ClipAnalyzer = ReturnType<typeof useClipAnalyzer>

export interface HomeMainTabsProps {
  activeTab: string
  onTabChange: (value: string) => void
  createSubTab: CreateSubTab
  onCreateSubTabChange: (sub: CreateSubTab) => void
  rndSubTab: RdSubTab
  onRndSubTabChange: (sub: RdSubTab) => void
  canAccessRnd: boolean
  rndTabs: string[]
  isOwner: boolean
  isAdmin: boolean
  user: KickUser
  userRole: Role
  userType: Role
  darkMode: boolean
  cardClasses: string
  tabPanelClasses: string
  textClasses: string
  subtitleClasses: string
  tabListClasses: string
  tabTriggerClasses: string
  createSubTabListClasses: string
  language: HomeLanguage
  t: Record<string, string>
  platforms: Platform[]
  platformsBannerLogosList: ReturnType<typeof import('@/lib/home/defaultPlatforms').platformsBannerLogos>
  lastUpdated: string
  isLoadingAlgorithms: boolean
  algorithmError: string | null
  onRefreshAlgorithms: (platformId?: string) => void
  expandedCard: string | null
  onExpandedCardChange: (id: string | null) => void
  hasTabAccess: (tabId: string) => boolean
  hasEnoughCoins: (tool: ToolType) => boolean
  hasUnlimitedAccess: boolean
  coinLoading: boolean
  refreshBalance: () => void
  onActivityLog: (entry: ActivityLogEntry) => void
  onThumbnailActivityLog: (entry: {
    details: string
    estimatedCostUsd?: number
    estimatedCostNote?: string
  }) => void
  clipAnalyzer: ClipAnalyzer
  onLanguageChange: (lang: HomeLanguage) => void
  onDarkModeToggle: () => void
  feedbackReplyEmail: string
  setFeedbackReplyEmail: (v: string) => void
  feedbackMessage: string
  setFeedbackMessage: (v: string) => void
  feedbackSending: boolean
  onSubmitStaffFeedback: () => void
  onLifetimePassCheckout: () => void
  activityLog: ActivityLogEntry[]
  refreshActivityLog: () => void
  onRequestClearActivityLog: () => void
  filterAction: string
  setFilterAction: (v: string) => void
  filterUser: string
  setFilterUser: (v: string) => void
  filterDate: string
  setFilterDate: (v: string) => void
  roleSearchUsername: string
  setRoleSearchUsername: (v: string) => void
  selectedRole: Role
  setSelectedRole: (v: Role) => void
  onUpdateRole: (username: string, role: Role) => void
  onRefreshRoles: () => void
  coinGrantUsername: string
  setCoinGrantUsername: (v: string) => void
  coinGrantAmount: number
  setCoinGrantAmount: (v: number) => void
  isGrantingCoins: boolean
  onGrantCoins: (amount: number) => void
  usersWithRoles: Array<{ id: string; username: string; role: Role; coins?: number }>
  onDeleteUser: (username: string) => void
}

export default function HomeMainTabs({
  activeTab,
  onTabChange,
  createSubTab,
  onCreateSubTabChange,
  rndSubTab,
  onRndSubTabChange,
  canAccessRnd,
  rndTabs,
  isOwner,
  isAdmin,
  user,
  userRole,
  userType,
  darkMode,
  cardClasses,
  tabPanelClasses,
  textClasses,
  subtitleClasses,
  tabListClasses,
  tabTriggerClasses,
  createSubTabListClasses,
  language,
  t,
  platforms,
  platformsBannerLogosList,
  lastUpdated,
  isLoadingAlgorithms,
  algorithmError,
  onRefreshAlgorithms,
  expandedCard,
  onExpandedCardChange,
  hasTabAccess,
  hasEnoughCoins,
  hasUnlimitedAccess,
  coinLoading,
  refreshBalance,
  onActivityLog,
  onThumbnailActivityLog,
  clipAnalyzer,
  onLanguageChange,
  onDarkModeToggle,
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
}: HomeMainTabsProps) {
  const visibleRdTabs = useMemo<RdSubTab[]>(
    () => (isOwner ? ALL_RD_SUBS : ALL_RD_SUBS.filter((id) => rndTabs.includes(id))),
    [isOwner, rndTabs]
  )
  const effectiveRndSubTab = visibleRdTabs.includes(rndSubTab)
    ? rndSubTab
    : (visibleRdTabs[0] || 'trending-vids')

  useEffect(() => {
    if (rndSubTab === effectiveRndSubTab) return
    onRndSubTabChange(effectiveRndSubTab)
  }, [rndSubTab, effectiveRndSubTab, onRndSubTabChange])

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-3">
      <TabsList
        className={`grid w-full grid-cols-2 ${canAccessRnd ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} ${tabListClasses}`}
      >
        <TabsTrigger value="educate" className={cn('flex items-center space-x-2', tabTriggerClasses)}>
          <GraduationCap className="h-4 w-4" />
          <span className="hidden sm:inline">{t.educate}</span>
        </TabsTrigger>
        <TabsTrigger value="create" className={cn('flex items-center space-x-2', tabTriggerClasses)}>
          <Wand2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t.create}</span>
        </TabsTrigger>
        <TabsTrigger value="analyze" className={cn('flex items-center space-x-2', tabTriggerClasses)}>
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">{t.analyze}</span>
        </TabsTrigger>
        <TabsTrigger value="kick-clips" className={cn('flex items-center space-x-2', tabTriggerClasses)}>
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">{t.kickClips}</span>
        </TabsTrigger>
        <TabsTrigger value="settings" className={cn('flex items-center space-x-2', tabTriggerClasses)}>
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">{t.settings}</span>
        </TabsTrigger>
        {canAccessRnd && (
          <TabsTrigger value="rnd" className={cn('flex items-center space-x-2', tabTriggerClasses)}>
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">{t.rnd}</span>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="educate">
        <ResourceHubTab
          darkMode={darkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          subtitleClasses={subtitleClasses}
          platforms={platforms}
          platformsBannerLogos={platformsBannerLogosList}
          lastUpdated={lastUpdated}
          isLoadingAlgorithms={isLoadingAlgorithms}
          algorithmError={algorithmError}
          isAdmin={isAdmin}
          showAdminControls={isAdmin}
          onRefreshAlgorithms={onRefreshAlgorithms}
          expandedCard={expandedCard}
          onExpandedCardChange={onExpandedCardChange}
        />
      </TabsContent>

      <TabsContent value="create">
        <Tabs
          value={createSubTab}
          onValueChange={(v) => onCreateSubTabChange(v as CreateSubTab)}
          className="space-y-3"
        >
          <div className={cn(cardClasses, tabPanelClasses)}>
            <CreateTabHeader
              activeSubTab={createSubTab}
              labels={{
                thumbnail: t.tagGeneratorPaid,
                tags: t.tagGeneratorFree,
                background: t.backgroundRemover,
                post4me: t.post4me,
              }}
              pickToolLabel={t.createPickTool}
              darkMode={darkMode}
              tabListClasses={createSubTabListClasses}
              tabTriggerClasses={tabTriggerClasses}
            />

            <TabsContent value="tags">
              <TagGeneratorTab
                darkMode={darkMode}
                subtitleClasses={subtitleClasses}
                platforms={platforms}
                user={user}
                hasEnoughCoins={hasEnoughCoins}
                hasUnlimitedAccess={hasUnlimitedAccess}
                coinLoading={coinLoading}
                refreshBalance={refreshBalance}
                onActivityLog={onActivityLog}
              />
            </TabsContent>

            <TabsContent value="thumbnail">
              <ThumbnailGenerator
                userId={user.username}
                userType={userType}
                darkMode={darkMode}
                platforms={platforms}
                user={user}
                isDisabled={!hasTabAccess('thumbnail-generator')}
                onBalanceRefresh={refreshBalance}
                onLogActivity={onThumbnailActivityLog}
              />
            </TabsContent>

            <TabsContent value="post4me">
              <Post4MeTab
                darkMode={darkMode}
                subtitleClasses={subtitleClasses}
                platforms={platforms}
                user={user}
                hasEnoughCoins={hasEnoughCoins}
                hasUnlimitedAccess={hasUnlimitedAccess}
                coinLoading={coinLoading}
                refreshBalance={refreshBalance}
                onActivityLog={onActivityLog}
                isDisabled={!hasTabAccess('post4me')}
                title={t.post4me}
                description={t.post4meDesc}
              />
            </TabsContent>

            {hasTabAccess('background-remover') && (
              <TabsContent value="background">
                <BackgroundRemoverTab
                  darkMode={darkMode}
                  cardClasses={cardClasses}
                  textClasses={textClasses}
                  subtitleClasses={subtitleClasses}
                  title=""
                  description={t.backgroundRemoverDesc}
                  user={user}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </TabsContent>

      <TabsContent value="analyze">
        <AnalyzeTab
          darkMode={darkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          subtitleClasses={subtitleClasses}
          hasTabAccess={hasTabAccess}
          platforms={platforms}
          user={user}
          hasUnlimitedAccess={hasUnlimitedAccess}
          hasEnoughCoins={hasEnoughCoins}
          analyzeTitle={t.analyze}
          clipAnalyzerDesc={t.clipAnalyzerDesc}
          analyzer={clipAnalyzer}
        />
      </TabsContent>

      {canAccessRnd && (
        <TabsContent value="rnd">
          <Tabs
            value={effectiveRndSubTab}
            onValueChange={(v) => onRndSubTabChange(v as RdSubTab)}
            className="space-y-3"
          >
            <div className={cn(cardClasses, tabPanelClasses)}>
              <RdTabHeader
                activeSubTab={effectiveRndSubTab}
                visibleTabs={visibleRdTabs}
                labels={{
                  trendingVids: t.trendingVids || 'Trending Vids',
                }}
                pickToolLabel={t.rndPickTool}
                darkMode={darkMode}
                tabListClasses={createSubTabListClasses}
                tabTriggerClasses={tabTriggerClasses}
              />

              {visibleRdTabs.includes('trending-vids') && (
                <TabsContent value="trending-vids">
                  <TrendingVidsTab
                    darkMode={darkMode}
                    subtitleClasses={subtitleClasses}
                    description={
                      t.trendingVidsDesc ||
                      'Pick a platform. We search the live web via Google and list the top 5 trends — videos and topics for YouTube and other video apps.'
                    }
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </TabsContent>
      )}

      <TabsContent value="kick-clips">
        <div className={cn(cardClasses, tabPanelClasses)}>
          <UserAppsIdeaTab
            darkMode={darkMode}
            title={t.kickClips}
            intro={t.userAppsIntro}
            subjectLabel={t.userAppsSubject}
            bodyLabel={t.userAppsBody}
            subjectPlaceholder={t.userAppsSubjectPlaceholder}
            bodyPlaceholder={t.userAppsBodyPlaceholder}
            submitLabel={t.userAppsSubmit}
            sendingLabel={t.userAppsSending}
            successMessage={t.userAppsSuccess}
          />
        </div>
      </TabsContent>

      <TabsContent value="settings">
        <SettingsTab
          darkMode={darkMode}
          cardClasses={cardClasses}
          language={language}
          onLanguageChange={onLanguageChange}
          onDarkModeToggle={onDarkModeToggle}
          settingsTitle={t.settings}
          languageLabel={t.language}
          darkModeLabel={t.darkMode}
          lightModeLabel={t.lightMode}
          user={user}
          userRole={userRole}
          isOwner={isOwner}
          isAdmin={isAdmin}
          feedbackReplyEmail={feedbackReplyEmail}
          setFeedbackReplyEmail={setFeedbackReplyEmail}
          feedbackMessage={feedbackMessage}
          setFeedbackMessage={setFeedbackMessage}
          feedbackSending={feedbackSending}
          onSubmitStaffFeedback={onSubmitStaffFeedback}
          onLifetimePassCheckout={onLifetimePassCheckout}
          activityLog={activityLog}
          refreshActivityLog={refreshActivityLog}
          onRequestClearActivityLog={onRequestClearActivityLog}
          filterAction={filterAction}
          setFilterAction={setFilterAction}
          filterUser={filterUser}
          setFilterUser={setFilterUser}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          roleSearchUsername={roleSearchUsername}
          setRoleSearchUsername={setRoleSearchUsername}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          onUpdateRole={onUpdateRole}
          onRefreshRoles={onRefreshRoles}
          coinGrantUsername={coinGrantUsername}
          setCoinGrantUsername={setCoinGrantUsername}
          coinGrantAmount={coinGrantAmount}
          setCoinGrantAmount={setCoinGrantAmount}
          isGrantingCoins={isGrantingCoins}
          onGrantCoins={onGrantCoins}
          usersWithRoles={usersWithRoles}
          onDeleteUser={onDeleteUser}
          platforms={platforms}
          onRefreshAlgorithms={onRefreshAlgorithms}
          isLoadingAlgorithms={isLoadingAlgorithms}
        />
      </TabsContent>
    </Tabs>
  )
}
