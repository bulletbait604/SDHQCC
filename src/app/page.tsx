'use client'

import { useCallback, useRef, useState } from 'react'
import CoinPurchase from '@/app/components/CoinPurchase'
import BannedUserScreen from '@/app/components/BannedUserScreen'
import { type CreateSubTab } from '@/app/components/CreateTabHeader'
import { useClipAnalyzer } from '@/hooks/useClipAnalyzer'
import { useHomeRoles } from '@/hooks/useHomeRoles'
import { useHomeSession } from '@/hooks/useHomeSession'
import { useHomeActivityLog } from '@/hooks/useHomeActivityLog'
import { useHomeAlgorithms } from '@/hooks/useHomeAlgorithms'
import { useHomeFeedback } from '@/hooks/useHomeFeedback'
import { useCheckoutPricing } from '@/hooks/useCheckoutPricing'
import { useLegacyTabRedirect } from '@/hooks/useLegacyTabRedirect'
import { platformsBannerLogos } from '@/lib/home/defaultPlatforms'
import { getHomeThemeClasses } from '@/lib/home/homeThemeClasses'
import HomeHeader from '@/app/components/HomeHeader'
import HomeFooter from '@/app/components/HomeFooter'
import LoginHero from '@/app/components/LoginHero'
import HomeMainTabs from '@/app/components/HomeMainTabs'
import {
  PrivacyPolicyModal,
  TermsOfServiceModal,
  SettingsQuickModal,
  ClearActivityLogModal,
  VerificationWaitModal,
} from '@/app/components/HomeModals'
import { homeTranslations } from '@/lib/i18n/homeTranslations'
import type { ActivityLogEntry } from '@/lib/home/types'
import { usePayPalPublicConfig } from '@/hooks/usePayPalPublicConfig'
import DonatePopup from '@/app/components/DonatePopup'
import SubscribePopup from '@/app/components/SubscribePopup'
import LifetimePassPopup from '@/app/components/LifetimePassPopup'
import { pollSubscriptionVerification } from '@/lib/paypal/pollSubscriptionVerification'
import { useCoins } from '@/hooks/useCoins'
import { startKickLogin } from '@/lib/kick/startKickLogin'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('educate')
  const [createSubTab, setCreateSubTab] = useState<CreateSubTab>('thumbnail')
  const [showSettings, setShowSettings] = useState(false)
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showSubscribePopup, setShowSubscribePopup] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [showLifetimePopup, setShowLifetimePopup] = useState(false)
  const [showDonatePopup, setShowDonatePopup] = useState(false)
  const [showCoinPurchase, setShowCoinPurchase] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const closeCoinPurchase = useCallback(() => setShowCoinPurchase(false), [])

  const { config: paypalCfg, loading: paypalCfgLoading, error: paypalCfgError } = usePayPalPublicConfig()
  const { checkoutCurrency, subscriptionLocalPrice, lifetimeLocalPrice, currencyQuoteNote } =
    useCheckoutPricing()

  const fetchUserRoleRef = useRef<() => void | Promise<void>>(() => {})
  const algoLoadRef = useRef<() => void>(() => {})
  const setActivityLogRef = useRef<React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>>(() => {})

  const session = useHomeSession({
    onSessionReady: () => algoLoadRef.current(),
    fetchUserRole: () => void fetchUserRoleRef.current(),
  })

  const {
    mounted,
    user,
    language,
    darkMode,
    isBanned,
    bannedMessage,
    isVerified,
    setIsVerified,
    isLifetime,
    setIsLifetime,
    handleLanguageChange,
    toggleDarkMode,
    handleLogout: sessionLogout,
  } = session

  useLegacyTabRedirect(activeTab, setActiveTab, setCreateSubTab)

  const roles = useHomeRoles({
    user,
    isVerified,
    isLifetime,
    activeTab,
    setActiveTab,
    setActivityLog: (action) => setActivityLogRef.current(action),
    setIsVerified,
    setIsLifetime,
  })

  fetchUserRoleRef.current = roles.fetchUserRole

  const activity = useHomeActivityLog({
    user,
    staffCanViewActivity: roles.staffCanViewActivity,
  })

  setActivityLogRef.current = activity.setActivityLog

  const {
    userRole,
    userType,
    isOwner,
    isAdmin,
    isSubscribed,
    isLifetimeMember,
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
    refreshRoles,
  } = roles

  const {
    activityLog,
    appendActivityLog,
    refreshActivityLog,
    handleClearActivityLog,
    logThumbnailGeneration,
    logLogout,
  } = activity

  const algorithms = useHomeAlgorithms({
    user,
    isAdmin,
    onActivityLog: appendActivityLog,
    runOnMount: false,
  })

  algoLoadRef.current = algorithms.loadAlgorithmsAndTags

  const {
    platforms,
    lastUpdated,
    isLoadingAlgorithms,
    algorithmError,
    expandedCard,
    setExpandedCard,
    handleRefreshAlgorithms,
  } = algorithms

  const feedback = useHomeFeedback(user, userRole, isOwner)

  const {
    balance,
    deductCoins,
    hasEnoughCoins,
    hasUnlimitedAccess,
    loading: coinLoading,
    refreshBalance,
  } = useCoins({
    userId: user?.username || '',
    userRole,
  })

  const handleMainTabChange = (value: string) => {
    setActiveTab(value)
    refreshBalance()
  }

  const t = homeTranslations[language] ?? homeTranslations.en

  const clipAnalyzer = useClipAnalyzer({
    user,
    userType,
    platforms,
    hasEnoughCoins,
    hasUnlimitedAccess,
    refreshBalance,
    onActivityLog: appendActivityLog,
  })

  const platformsBannerLogosList = platformsBannerLogos(platforms)

  const {
    themeClasses,
    headerClasses,
    cardClasses,
    tabListClasses,
    tabTriggerClasses,
    createSubTabListClasses,
    textClasses,
    subtitleClasses,
  } = getHomeThemeClasses(darkMode)

  const handleLogin = () => {
    void startKickLogin()
  }

  const handleLogout = () => {
    if (isAdmin) logLogout()
    void sessionLogout()
  }

  const handleVerifySubscription = () => {
    setShowSubscribePopup(true)
  }

  const handleLifetimePassCheckout = () => {
    setShowLifetimePopup(true)
  }

  const handleSubscriptionApproved = (subscriptionId: string) => {
    if (!user) return
    pollSubscriptionVerification({
      subscriptionId,
      username: user.username,
      onVerifyingChange: setIsVerifying,
    })
  }

  const onConfirmClearActivityLog = async () => {
    await handleClearActivityLog()
    setShowClearConfirm(false)
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sdhq-dark-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sdhq-cyan-500"></div>
      </div>
    )
  }

  if (isBanned) {
    return <BannedUserScreen darkMode={darkMode} message={bannedMessage} />
  }

  return (
    <div className={themeClasses}>
      <HomeHeader
        headerClasses={headerClasses}
        darkMode={darkMode}
        user={user}
        userRole={userRole}
        balance={balance}
        language={language}
        verifySubscriptionLabel={t.verifySubscription}
        settingsLabel={t.settings}
        logoutLabel={t.logout}
        loginLabel={t.loginButton}
        onLanguageChange={handleLanguageChange}
        onToggleDarkMode={toggleDarkMode}
        onOpenCoinPurchase={() => setShowCoinPurchase(true)}
        onVerifySubscription={handleVerifySubscription}
        onDonate={() => setShowDonatePopup(true)}
        onOpenSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
        onLogin={handleLogin}
      />

      <main className="container mx-auto px-4 pt-2 pb-8">
        {!user ? (
          <LoginHero
            darkMode={darkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            welcome={t.welcome}
            description={t.description}
            loginButtonLabel={t.loginButton}
            onLogin={handleLogin}
          />
        ) : (
          <HomeMainTabs
            activeTab={activeTab}
            onTabChange={handleMainTabChange}
            createSubTab={createSubTab}
            onCreateSubTabChange={setCreateSubTab}
            isOwner={isOwner}
            isAdmin={isAdmin}
            user={user}
            userRole={userRole}
            userType={userType}
            darkMode={darkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            subtitleClasses={subtitleClasses}
            tabListClasses={tabListClasses}
            tabTriggerClasses={tabTriggerClasses}
            createSubTabListClasses={createSubTabListClasses}
            language={language}
            t={t}
            platforms={platforms}
            platformsBannerLogosList={platformsBannerLogosList}
            lastUpdated={lastUpdated}
            isLoadingAlgorithms={isLoadingAlgorithms}
            algorithmError={algorithmError}
            onRefreshAlgorithms={handleRefreshAlgorithms}
            expandedCard={expandedCard}
            onExpandedCardChange={setExpandedCard}
            hasTabAccess={hasTabAccess}
            hasEnoughCoins={hasEnoughCoins}
            hasUnlimitedAccess={hasUnlimitedAccess}
            coinLoading={coinLoading}
            refreshBalance={refreshBalance}
            onActivityLog={appendActivityLog}
            onThumbnailActivityLog={logThumbnailGeneration}
            clipAnalyzer={clipAnalyzer}
            deductCoins={deductCoins}
            onDonate={() => setShowDonatePopup(true)}
            onLanguageChange={handleLanguageChange}
            onDarkModeToggle={toggleDarkMode}
            feedbackReplyEmail={feedback.feedbackReplyEmail}
            setFeedbackReplyEmail={feedback.setFeedbackReplyEmail}
            feedbackMessage={feedback.feedbackMessage}
            setFeedbackMessage={feedback.setFeedbackMessage}
            feedbackSending={feedback.feedbackSending}
            onSubmitStaffFeedback={feedback.handleSubmitStaffFeedback}
            onLifetimePassCheckout={handleLifetimePassCheckout}
            activityLog={activityLog}
            refreshActivityLog={refreshActivityLog}
            onRequestClearActivityLog={() => setShowClearConfirm(true)}
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
            onUpdateRole={handleUpdateRole}
            onRefreshRoles={refreshRoles}
            coinGrantUsername={coinGrantUsername}
            setCoinGrantUsername={setCoinGrantUsername}
            coinGrantAmount={coinGrantAmount}
            setCoinGrantAmount={setCoinGrantAmount}
            isGrantingCoins={isGrantingCoins}
            onGrantCoins={handleGrantCoins}
            usersWithRoles={usersWithRoles}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </main>

      {user && (
        <CoinPurchase
          isOpen={showCoinPurchase}
          onClose={closeCoinPurchase}
          userId={user.username}
          darkMode={darkMode}
        />
      )}

      <HomeFooter
        darkMode={darkMode}
        footerCopyright={t.footerCopyright}
        footerTagline={t.footerTagline}
        privacyPolicyLabel={t.privacyPolicy}
        termsLabel={t.termsOfService}
        onOpenPrivacy={() => setShowPrivacyPolicy(true)}
        onOpenTerms={() => setShowTerms(true)}
      />

      {showSettings && (
        <SettingsQuickModal
          darkMode={darkMode}
          settingsTitle={t.settings}
          languageLabel={t.language}
          darkModeLabel={t.darkMode}
          lightModeLabel={t.lightMode}
          language={language}
          onLanguageChange={handleLanguageChange}
          onToggleDarkMode={toggleDarkMode}
          onClose={() => setShowSettings(false)}
          showLifetimePass={!isOwner && !isAdmin && !isSubscribed && !isLifetimeMember}
          lifetimeLocalPrice={lifetimeLocalPrice}
          checkoutCurrency={checkoutCurrency}
          onLifetimePassCheckout={handleLifetimePassCheckout}
        />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicyModal darkMode={darkMode} title={t.privacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
      )}

      {showTerms && (
        <TermsOfServiceModal darkMode={darkMode} title={t.termsOfService} onClose={() => setShowTerms(false)} />
      )}

      {showSubscribePopup && user && (
        <SubscribePopup
          darkMode={darkMode}
          user={user}
          paypalCfg={paypalCfg}
          paypalCfgLoading={paypalCfgLoading}
          paypalCfgError={paypalCfgError}
          subscriptionLocalPrice={subscriptionLocalPrice}
          checkoutCurrency={checkoutCurrency}
          lifetimeLocalPrice={lifetimeLocalPrice}
          onClose={() => setShowSubscribePopup(false)}
          onSubscriptionApproved={handleSubscriptionApproved}
          onSwitchToLifetime={() => {
            setShowSubscribePopup(false)
            setShowLifetimePopup(true)
          }}
          onLifetimeCheckout={handleLifetimePassCheckout}
        />
      )}

      {showLifetimePopup && user && (
        <LifetimePassPopup
          darkMode={darkMode}
          user={user}
          paypalCfg={paypalCfg}
          lifetimeLocalPrice={lifetimeLocalPrice}
          checkoutCurrency={checkoutCurrency}
          currencyQuoteNote={currencyQuoteNote}
          onClose={() => setShowLifetimePopup(false)}
        />
      )}

      {showClearConfirm && (
        <ClearActivityLogModal
          darkMode={darkMode}
          onConfirm={onConfirmClearActivityLog}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {showDonatePopup && user && (
        <DonatePopup
          darkMode={darkMode}
          user={user}
          paypalCfg={paypalCfg}
          paypalCfgLoading={paypalCfgLoading}
          paypalCfgError={paypalCfgError}
          onClose={() => setShowDonatePopup(false)}
        />
      )}

      {isVerifying && <VerificationWaitModal darkMode={darkMode} />}
    </div>
  )
}
