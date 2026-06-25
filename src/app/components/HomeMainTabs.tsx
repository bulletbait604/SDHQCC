'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Video, Wand2, GraduationCap, BarChart3, Film } from 'lucide-react'
import ResourceHubTab from '@/app/components/ResourceHubTab'
import CreateTabHeader, { type CreateSubTab } from '@/app/components/CreateTabHeader'
import TagGeneratorTab from '@/app/components/TagGeneratorTab'
import ThumbnailGenerator from '@/app/components/ThumbnailGenerator'
import BackgroundRemoverTab from '@/app/components/BackgroundRemoverTab'
import AnalyzeTab from '@/app/components/AnalyzeTab'
import ClipEditorTab from '@/app/components/ClipEditorTab'
import KickClipsComingSoon from '@/app/components/KickClipsComingSoon'
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
  isOwner: boolean
  isAdmin: boolean
  user: KickUser
  userRole: Role
  userType: Role
  darkMode: boolean
  cardClasses: string
  textClasses: string
  subtitleClasses: string
  tabListClasses: string
  tabTriggerActiveClasses: string
  tabTriggerInactiveClasses: string
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
  deductCoins: (tool: ToolType) => Promise<boolean>
  onDonate: () => void
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
  isOwner,
  isAdmin,
  user,
  userRole,
  userType,
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  tabListClasses,
  tabTriggerActiveClasses,
  tabTriggerInactiveClasses,
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
  deductCoins,
  onDonate,
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
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <TabsList
        className={`grid w-full grid-cols-2 ${isOwner ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} ${tabListClasses}`}
      >
        <TabsTrigger
          value="educate"
          className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
        >
          <GraduationCap className="w-4 h-4" />
          <span className="hidden sm:inline">{t.educate}</span>
        </TabsTrigger>
        <TabsTrigger
          value="create"
          className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
        >
          <Wand2 className="w-4 h-4" />
          <span className="hidden sm:inline">{t.create}</span>
        </TabsTrigger>
        <TabsTrigger
          value="analyze"
          className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">{t.analyze}</span>
        </TabsTrigger>
        <TabsTrigger
          value="kick-clips"
          className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
        >
          <Video className="w-4 h-4" />
          <span className="hidden sm:inline">{t.kickClips}</span>
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">{t.settings}</span>
        </TabsTrigger>
        {isOwner && (
          <TabsTrigger
            value="clip-editor"
            className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
          >
            <Film className="w-4 h-4" />
            <span className="hidden sm:inline">{t.clipEditor}</span>
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
          className="space-y-4"
        >
          <div className={`${cardClasses} p-4 sm:p-6`}>
            <CreateTabHeader
              activeSubTab={createSubTab}
              labels={{
                thumbnail: t.tagGeneratorPaid,
                tags: t.tagGeneratorFree,
                background: t.backgroundRemover,
              }}
              pickToolLabel={t.createPickTool}
              darkMode={darkMode}
              tabTriggerActiveClasses={tabTriggerActiveClasses}
              tabTriggerInactiveClasses={tabTriggerInactiveClasses}
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

      {isOwner && (
        <TabsContent value="clip-editor">
          <ClipEditorTab
            darkMode={darkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            subtitleClasses={subtitleClasses}
            title={t.clipEditor}
            tagline={t.clipEditorDesc}
            user={user}
            hasEnoughCoins={hasEnoughCoins}
            deductCoins={deductCoins}
            hasUnlimitedAccess={hasUnlimitedAccess || isOwner}
            refreshBalance={refreshBalance}
          />
        </TabsContent>
      )}

      <TabsContent value="kick-clips">
        <KickClipsComingSoon
          darkMode={darkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          subtitleClasses={subtitleClasses}
          title={t.kickClips}
          comingSoonLabel={t.appComingSoon}
          donateLabel={t.donate}
          onDonate={onDonate}
        />
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
