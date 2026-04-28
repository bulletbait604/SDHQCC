'use client'

import { useState, useEffect } from 'react'

// TypeScript declaration for PayPal
declare global {
  interface Window {
    paypal?: any
  }
}

// Deployment trigger for owner role fix
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User,
  LogOut,
  Settings,
  Shield,
  Hash,
  Video,
  Brain,
  TrendingUp,
  Crown,
  Moon,
  Sun,
  Globe,
  X,
  Plus,
  Trash2,
  CheckCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  Copy,
  Database,
  RefreshCw
} from 'lucide-react'
import { createKickAuthURL } from '@/lib/kick-oauth'

interface KickUser {
  id: string
  username: string
  display_name: string
  profile_image_url?: string
}

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

interface ActivityLogEntry {
  id: string
  username: string
  timestamp: string
  action: 'login' | 'logout' | 'payment_success' | 'payment_failed' | 'verification_attempt' | 'access_expired' | 'algorithm_refresh' | 'tag_generation' | 'clip_analysis' | 'clip_reanalysis' | 'content_analysis' | 'content_reanalysis' | 'subscriber_added' | 'subscriber_removed' | 'lifetime_added' | 'lifetime_removed' | 'admin_added' | 'admin_removed' | 'sync_completed' | 'role_updated'
  details?: string
}

type Language = 'en' | 'es' | 'fr' | 'de';

interface AlgorithmData {
  keyChanges: string
  editingTips: string
  postingTips: string
  titleTips: string
  descriptionTips: string
  summaries?: string[]
}

interface Platform {
  id: string
  name: string
  image: string
  data: AlgorithmData | null
}

interface AppSettings {
  language: Language;
  darkMode: boolean;
}

const translations = {
  en: {
    welcome: 'Welcome to SDHQ Creator Corner',
    description: 'Optimize long and short form content for ANY platform with AI-powered insights and tools.',
    loginButton: 'Login with Kick to Get Started',
    algorithmsExplained: 'Algorithms Explained',
    tagGeneratorFree: 'Tag Generator (Free)',
    tagGeneratorPaid: 'Tag Generator (Paid)',
    clipAnalyzer: 'Content Analyzer (Paid)',
    contentAnalyzer: 'Clip Analyzer (Paid)',
    settings: 'Settings',
    logout: 'Logout',
    verifySubscription: 'Verify Subscription',
    admin: 'Admin',
    subscribers: 'Subscribers',
    addSubscriber: 'Add Subscriber',
    remove: 'Remove',
    language: 'Language',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    comingSoon: 'Coming soon...',
    premiumFeature: 'Premium feature',
    algorithmsDesc: 'Get detailed insights into how different platform algorithms work and how to optimize your content for maximum reach and engagement.',
    tagFreeDesc: 'Generate basic tags for your content to improve discoverability across platforms.',
    tagPaidDesc: 'Advanced AI-powered tag generation with trending keywords, optimization suggestions, and platform-specific recommendations.',
    clipAnalyzerDesc: 'Analyze your video clips with AI to get insights on performance, engagement potential, and optimization recommendations.',
    contentAnalyzerDesc: 'Comprehensive content analysis with AI insights, trend detection, and optimization strategies for any platform.',
    footerCopyright: '© 2026 SDHQ Creator Corner. All rights reserved.',
    footerTagline: 'AI-powered content optimization for creators.',
  },
  es: {
    welcome: 'Bienvenido a SDHQ Creator Corner',
    description: 'Optimiza contenido largo y corto para CUALQUIER plataforma con herramientas e ideas impulsadas por IA.',
    loginButton: 'Iniciar sesión con Kick',
    algorithmsExplained: 'Algoritmos Explicados',
    tagGeneratorFree: 'Generador de Etiquetas (Gratis)',
    tagGeneratorPaid: 'Generador de Etiquetas (Pago)',
    clipAnalyzer: 'Analizador de Contenido (Pago)',
    contentAnalyzer: 'Analizador de Clips (Pago)',
    settings: 'Configuración',
    logout: 'Cerrar sesión',
    verifySubscription: 'Verificar Suscripción',
    admin: 'Admin',
    subscribers: 'Suscriptores',
    addSubscriber: 'Agregar Suscriptor',
    remove: 'Eliminar',
    language: 'Idioma',
    darkMode: 'Modo Oscuro',
    lightMode: 'Modo Claro',
    privacyPolicy: 'Política de Privacidad',
    termsOfService: 'Términos de Servicio',
    comingSoon: 'Próximamente...',
    premiumFeature: 'Función premium',
    algorithmsDesc: 'Obtén información detallada sobre cómo funcionan los algoritmos de diferentes plataformas y cómo optimizar tu contenido.',
    tagFreeDesc: 'Genera etiquetas básicas para tu contenido para mejorar la visibilidad en todas las plataformas.',
    tagPaidDesc: 'Generación avanzada de etiquetas con IA, palabras clave populares y recomendaciones específicas.',
    clipAnalyzerDesc: 'Analiza tus clips de video con IA para obtener información sobre rendimiento y recomendaciones.',
    contentAnalyzerDesc: 'Análisis integral de contenido con información de IA, detección de tendencias y estrategias de optimización.',
    footerCopyright: '© 2026 SDHQ Creator Corner. Todos los derechos reservados.',
    footerTagline: 'Optimización de contenido impulsada por IA para creadores.',
  },
  fr: {
    welcome: 'Bienvenue à SDHQ Creator Corner',
    description: 'Optimisez le contenu long et court pour TOUTE plateforme avec des outils et insights IA.',
    loginButton: 'Connexion avec Kick',
    algorithmsExplained: 'Algorithmes Expliqués',
    tagGeneratorFree: 'Générateur de Tags (Gratuit)',
    tagGeneratorPaid: 'Générateur de Tags (Payant)',
    clipAnalyzer: 'Analyseur de Contenu (Payant)',
    contentAnalyzer: 'Analyseur de Clips (Payant)',
    settings: 'Paramètres',
    logout: 'Déconnexion',
    verifySubscription: 'Vérifier Abonnement',
    admin: 'Admin',
    subscribers: 'Abonnés',
    addSubscriber: 'Ajouter Abonné',
    remove: 'Supprimer',
    language: 'Langue',
    darkMode: 'Mode Sombre',
    lightMode: 'Mode Clair',
    privacyPolicy: 'Politique de Confidentialité',
    termsOfService: 'Conditions d\'Utilisation',
    comingSoon: 'Bientôt disponible...',
    premiumFeature: 'Fonction premium',
    algorithmsDesc: 'Obtenez des insights détaillés sur le fonctionnement des algorithmes et optimisez votre contenu.',
    tagFreeDesc: 'Générez des tags de base pour améliorer la découvrabilité de votre contenu.',
    tagPaidDesc: 'Génération avancée de tags avec IA, mots-clés tendance et recommandations spécifiques.',
    clipAnalyzerDesc: 'Analysez vos clips vidéo avec IA pour des insights sur les performances.',
    contentAnalyzerDesc: 'Analyse complète du contenu avec insights IA, détection de tendances et stratégies.',
    footerCopyright: '© 2026 SDHQ Creator Corner. Tous droits réservés.',
    footerTagline: 'Optimisation de contenu IA pour créateurs.',
  },
  de: {
    welcome: 'Willkommen bei SDHQ Creator Corner',
    description: 'Optimieren Sie langen und kurzen Content für JEDE Plattform mit KI-gestützten Tools.',
    loginButton: 'Mit Kick anmelden',
    algorithmsExplained: 'Algorithmen Erklärt',
    tagGeneratorFree: 'Tag Generator (Kostenlos)',
    tagGeneratorPaid: 'Tag Generator (Bezahlt)',
    clipAnalyzer: 'Content Analyzer (Bezahlt)',
    contentAnalyzer: 'Clip Analyzer (Bezahlt)',
    settings: 'Einstellungen',
    logout: 'Abmelden',
    verifySubscription: 'Abonnement Verifizieren',
    admin: 'Admin',
    subscribers: 'Abonnenten',
    addSubscriber: 'Abonnent Hinzufügen',
    remove: 'Entfernen',
    language: 'Sprache',
    darkMode: 'Dunkelmodus',
    lightMode: 'Hellmodus',
    privacyPolicy: 'Datenschutzrichtlinie',
    termsOfService: 'Nutzungsbedingungen',
    comingSoon: 'Demnächst verfügbar...',
    premiumFeature: 'Premium-Funktion',
    algorithmsDesc: 'Erhalten Sie detaillierte Einblicke in Algorithmen und optimieren Sie Ihren Content.',
    tagFreeDesc: 'Generieren Sie grundlegende Tags für bessere Auffindbarkeit auf allen Plattformen.',
    tagPaidDesc: 'KI-gestützte Tag-Generierung mit Trends und plattformspezifischen Empfehlungen.',
    clipAnalyzerDesc: 'Analysieren Sie Clips mit KI für Performance-Einblicke und Optimierungen.',
    contentAnalyzerDesc: 'Umfassende Content-Analyse mit KI-Einblicken, Trend-Erkennung und Strategien.',
    footerCopyright: '© 2026 SDHQ Creator Corner. Alle Rechte vorbehalten.',
    footerTagline: 'KI-gestützte Content-Optimierung für Creator.',
  }
};

const OWNER_USERNAMES = ['bulletbait604', 'Bulletbait604'];

const ROLE_HIERARCHY = {
  free: 1,
  subscriber: 2,
  subscriber_lifetime: 3,
  admin: 4,
  owner: 5
} as const;

type Role = keyof typeof ROLE_HIERARCHY;

const ROLE_CONFIG = {
  owner: { badge: '👑 Owner', rank: 5, label: 'Owner', badgeClass: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' },
  admin: { badge: '🛡 Admin', rank: 4, label: 'Admin', badgeClass: 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black' },
  subscriber_lifetime: { badge: '💎 Lifetime', rank: 3, label: 'Lifetime Subscriber', badgeClass: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black' },
  subscriber: { badge: '⭐ Subscriber', rank: 2, label: 'Subscriber', badgeClass: 'bg-gradient-to-r from-sdhq-green-500 to-sdhq-cyan-500 text-black' },
  free: { badge: '🙂 Free User', rank: 1, label: 'Free User', badgeClass: 'bg-gray-500 text-white' }
} as const;

export default function HomePage() {
  const [user, setUser] = useState<KickUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('algorithms-explained')
  const [language, setLanguage] = useState<Language>('en')
  const [darkMode, setDarkMode] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  
  // Role-based state
  const [userRole, setUserRole] = useState<Role>('free')
  const [usersWithRoles, setUsersWithRoles] = useState<any[]>([])
  const [roleSearchUsername, setRoleSearchUsername] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>('free')
  
  // Legacy state (will be removed after migration)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [newSubscriberUsername, setNewSubscriberUsername] = useState('')
  const [lifetimeMembers, setLifetimeMembers] = useState<LifetimeMember[]>([])
  const [newLifetimeUsername, setNewLifetimeUsername] = useState('')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [newAdminUsername, setNewAdminUsername] = useState('')
  
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [showSubscribePopup, setShowSubscribePopup] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  // Activity log filter states
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  
  // Payment states
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [showLifetimePopup, setShowLifetimePopup] = useState(false)
  
  // Verification states
  const [isVerified, setIsVerified] = useState<boolean>(false)
  const [isLifetime, setIsLifetime] = useState<boolean>(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('Loading...')
  const [isLoadingAlgorithms, setIsLoadingAlgorithms] = useState<boolean>(false)
  const [algorithmError, setAlgorithmError] = useState<string | null>(null)
  
  // Tag Generator states
  const [tagPlatform, setTagPlatform] = useState<string>('tiktok')
  const [tagDescription, setTagDescription] = useState<string>('')
  const [tagCount, setTagCount] = useState<number>(10)
  const [generatedTags, setGeneratedTags] = useState<Record<string, string[]>>({})
  const [isGeneratingTags, setIsGeneratingTags] = useState<boolean>(false)
  const [tagDatabaseStatus, setTagDatabaseStatus] = useState<{lastUpdated: string | null, totalTags: number}>({lastUpdated: null, totalTags: 0})
  const [tagRateLimit, setTagRateLimit] = useState<{remaining: number, resetTime: number | null}>({remaining: 5, resetTime: null})
  const [timeUntilReset, setTimeUntilReset] = useState<string>('')

  // Clip Analyzer states
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipPlatform, setClipPlatform] = useState<string>('tiktok')
  const [isAnalyzingClip, setIsAnalyzingClip] = useState<boolean>(false)
  const [clipAnalysisResult, setClipAnalysisResult] = useState<any>(null)
  const [clipError, setClipError] = useState<string>('')
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [clipRateLimit, setClipRateLimit] = useState<{remaining: number, resetTime: number | null}>({remaining: 5, resetTime: null})
  const [extractedData, setExtractedData] = useState<any>(null)
  const [showReanalysis, setShowReanalysis] = useState<boolean>(false)

  // Content Analyzer states
  const [contentUrl, setContentUrl] = useState<string>('')
  const [contentPlatform, setContentPlatform] = useState<string>('')
  const [isAnalyzingContent, setIsAnalyzingContent] = useState<boolean>(false)
  const [contentAnalysisResult, setContentAnalysisResult] = useState<any>(null)
  const [contentError, setContentError] = useState<string>('')
  const [contentLoadingStep, setContentLoadingStep] = useState<string>('')
  const [contentRateLimit, setContentRateLimit] = useState<{remaining: number, resetTime: number | null}>({remaining: 5, resetTime: null})
  const [contentExtractedData, setContentExtractedData] = useState<any>(null)
  const [showContentReanalysis, setShowContentReanalysis] = useState<boolean>(false)
  const [platforms, setPlatforms] = useState<Platform[]>([
    {
      id: 'tiktok',
      name: 'TikTok',
      image: 'https://iili.io/Bep916P.webp',
      data: null
    },
    {
      id: 'instagram',
      name: 'Instagram',
      image: 'https://iili.io/BepIskv.png',
      data: null
    },
    {
      id: 'youtube-shorts',
      name: 'YouTube Shorts',
      image: 'https://iili.io/Bep23il.webp',
      data: null
    },
    {
      id: 'youtube-long',
      name: 'YouTube Long',
      image: 'https://iili.io/Bep23il.webp',
      data: null
    },
    {
      id: 'facebook-reels',
      name: 'Facebook Reels',
      image: 'https://iili.io/Bepazil.png',
      data: null
    }
  ])

  const t = translations[language]
  const isOwner = user ? OWNER_USERNAMES.includes(user.username.replace(/^@/, '')) : false

  // Fetch user's role from MongoDB
  const fetchUserRole = async () => {
    if (!user) return
    try {
      const response = await fetch(`/api/roles?username=${user.username}`)
      if (response.ok) {
        const data = await response.json()
        console.log('User role response:', data)
        if (data.user && data.user.role) {
          setUserRole(data.user.role)
          console.log('Set user role to:', data.user.role)
        } else {
          // Default to 'free' if no role found, unless owner
          if (isOwner) {
            console.log('Owner detected, setting role to owner')
            setUserRole('owner')
            // Auto-create owner in database - use 'owner' directly since state hasn't updated yet
            fetch('/api/roles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                username: user.username, 
                role: 'owner', 
                currentAdminRole: 'owner'
              })
            }).then(() => fetchUsersWithRoles())
          } else {
            setUserRole('free')
            console.log('No role found, defaulting to free')
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      // Default to 'free' on error, unless owner
      if (isOwner) {
        setUserRole('owner')
      } else {
        setUserRole('free')
      }
    }
  }

  // Fetch user role when user changes
  useEffect(() => {
    if (user && user.username) {
      console.log('Fetching role for user:', user.username)
      fetchUserRole()
    }
  }, [user])

  // Fetch all users with roles
  const fetchUsersWithRoles = async () => {
    try {
      const response = await fetch('/api/roles')
      if (response.ok) {
        const data = await response.json()
        setUsersWithRoles(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users with roles:', error)
    }
  }

  // Update user role
  const handleUpdateRole = async (username: string, newRole: Role) => {
    console.log('handleUpdateRole called:', { username, newRole, currentUserRole: userRole })
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          role: newRole, 
          currentAdminRole: userRole 
        })
      })

      console.log('API response status:', response.status)
      const data = await response.json()
      console.log('API response data:', data)
      console.log('Verified user role in DB:', data.verified?.role)

      if (response.ok) {
        // Refresh users list
        await fetchUsersWithRoles()
        // If updating self, refresh own role
        if (username.toLowerCase() === user?.username.toLowerCase()) {
          console.log('Updating self, refreshing own role')
          await fetchUserRole()
        }
        
        // Log role change to activity
        const roleEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
          action: 'role_updated',
          details: `Changed ${username}'s role to ${ROLE_CONFIG[newRole].label}`
        }
        setActivityLog(prev => [roleEntry, ...prev].slice(0, 100))
        
        // Log to backend
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user?.username,
            action: 'role_updated',
            details: `Changed ${username}'s role to ${ROLE_CONFIG[newRole].label}`
          })
        }).catch(error => console.error('Failed to log to backend:', error))
        
        alert(`Role updated to ${ROLE_CONFIG[newRole].label}`)
      } else {
        const error = data
        console.error('API error:', error)
        alert(error.message || 'Failed to update role')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role')
    }
  }

  // Delete user from roles
  const handleDeleteUser = async (username: string) => {
    if (!confirm(`Are you sure you want to remove ${username} from the role system?`)) {
      return
    }

    console.log('handleDeleteUser called:', { username })
    try {
      const response = await fetch(`/api/roles?username=${username}`, {
        method: 'DELETE'
      })

      console.log('Delete API response status:', response.status)
      const data = await response.json()
      console.log('Delete API response data:', data)

      if (response.ok) {
        // Refresh users list
        await fetchUsersWithRoles()
        // If deleting self, refresh own role
        if (username.toLowerCase() === user?.username.toLowerCase()) {
          console.log('Deleting self, refreshing own role')
          await fetchUserRole()
        }
        alert(`${username} removed from role system`)
      } else {
        const error = data
        console.error('Delete API error:', error)
        alert(error.message || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  // Legacy role calculation (will be removed)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLifetimeMember, setIsLifetimeMember] = useState(false)

  // Recalculate roles when user or lists change (legacy)
  useEffect(() => {
    const normalizedUsername = user?.username?.replace(/^@/, '').toLowerCase() || ''
    const isAdminValue = user ? (isOwner || admins.some(admin => admin.username.toLowerCase() === normalizedUsername)) : false
    const isSubscribedValue = user ? (isVerified || subscribers.some(sub => sub.username.toLowerCase() === normalizedUsername)) : false
    const isLifetimeMemberValue = user ? (isLifetime || lifetimeMembers.some(member => member.username.toLowerCase() === normalizedUsername)) : false
    
    setIsAdmin(isAdminValue)
    setIsSubscribed(isSubscribedValue)
    setIsLifetimeMember(isLifetimeMemberValue)
  }, [user, isOwner, admins, subscribers, lifetimeMembers, isVerified, isLifetime])

  const fetchUserLists = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched user lists from backend:', data)
        // Update state with backend data (even if empty) - MongoDB only
        if (data.subscribers !== undefined) {
          setSubscribers(data.subscribers || [])
        }
        if (data.admins !== undefined) {
          setAdmins(data.admins || [])
        }
        if (data.lifetimeMembers !== undefined) {
          setLifetimeMembers(data.lifetimeMembers || [])
        }
      } else {
        console.error('Failed to fetch user lists:', response.status)
      }
    } catch (error) {
      console.error('Error fetching user lists:', error)
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // Check for existing user session
    if (typeof window !== 'undefined') {
      // Check if this is a post-verification reload
      const urlParams = new URLSearchParams(window.location.search)
      const isPostVerification = urlParams.has('verified')
      
      const storedUser = localStorage.getItem('kickUser')
      const storedLanguage = localStorage.getItem('sdhq-language') as Language
      const storedDarkMode = localStorage.getItem('sdhq-darkmode')
      const storedVerified = localStorage.getItem('isVerified')
      const storedLifetime = localStorage.getItem('isLifetime')
      
      if (storedVerified) {
        setIsVerified(storedVerified === 'true')
      }
      
      if (storedLifetime) {
        setIsLifetime(storedLifetime === 'true')
      }
      
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)
          
          // If post-verification, refresh user data to get updated role
          if (isPostVerification) {
            console.log('Post-verification reload detected, refreshing user data...')
            // Clear URL param
            urlParams.delete('verified')
            window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`)
            // Fetch fresh user data
            setTimeout(() => {
              fetchUserRole()
            }, 100)
          }
        } catch (error) {
          console.error('Error loading stored user:', error)
        }
      }
      
      if (storedLanguage && translations[storedLanguage]) {
        setLanguage(storedLanguage)
      }
      
      if (storedDarkMode !== null) {
        setDarkMode(storedDarkMode === 'true')
      }
      
      // Fetch role-based data
      fetchUsersWithRoles()
      
      // Legacy: Sync with backend (MongoDB) to get latest data
      fetchUserLists()

      // Load algorithm data from API on every page load
      setIsLoadingAlgorithms(true)
      setAlgorithmError(null)
      
      // First, try to load cached data for immediate display
      const storedAlgorithmData = localStorage.getItem('sdhq-algorithm-data')
      const storedLastUpdated = localStorage.getItem('sdhq-algorithm-updated')
      
      if (storedLastUpdated) {
        setLastUpdated(storedLastUpdated)
      }
      
      if (storedAlgorithmData) {
        try {
          const algorithmData = JSON.parse(storedAlgorithmData)
          // Show cached data immediately while fetching fresh data
          setPlatforms(prevPlatforms => prevPlatforms.map(p => ({
            ...p,
            data: algorithmData[p.id] || null
          })))
        } catch (error) {
          console.error('Error loading cached algorithm data:', error)
        }
      }
      
      // Check if it's Sunday and data hasn't been updated this week
      const shouldAutoRefresh = () => {
        const now = new Date()
        const dayOfWeek = now.getDay()
        
        if (dayOfWeek !== 0) return false // Not Sunday
        
        if (!storedLastUpdated) return true
        
        const lastUpdated = new Date(storedLastUpdated)
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
        
        // If it's been more than 6 days since last update, trigger refresh
        return daysSinceUpdate >= 6
      }

      // Function to log algorithm refresh
      const logAlgorithmRefresh = (provider?: string, isAuto: boolean = false) => {
        if (user && isAdmin) {
          const refreshEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user.username,
            timestamp: new Date().toISOString(),
            action: 'algorithm_refresh',
            details: `${isAuto ? 'Auto' : 'Manual'} algorithm refresh${provider ? ` via ${provider}` : ''}`
          }
          setActivityLog(prev => [refreshEntry, ...prev].slice(0, 100))
        }
      }

      // Always fetch fresh data from API (or trigger auto-refresh on Sundays)
      if (shouldAutoRefresh()) {
        // Trigger server-side refresh first
        fetch('/api/algorithms', { method: 'POST' })
          .then(res => {
            if (!res.ok) throw new Error(`API error: ${res.status}`)
            return res.json()
          })
          .then(data => {
            if (data.data) {
              localStorage.setItem('sdhq-algorithm-data', JSON.stringify(data.data))
              localStorage.setItem('sdhq-algorithm-updated', data.lastUpdated)
              setLastUpdated(data.lastUpdated)
              setPlatforms(prevPlatforms => prevPlatforms.map(p => ({
                ...p,
                data: data.data[p.id] || null
              })))
              // Log the auto-refresh
              logAlgorithmRefresh(data.provider, true)
            }
          })
          .catch(error => {
            console.error('Error auto-refreshing algorithm data:', error)
          })
          .finally(() => setIsLoadingAlgorithms(false))
      } else {
        fetch('/api/algorithms')
          .then(res => {
            if (!res.ok) throw new Error(`API error: ${res.status}`)
            return res.json()
          })
          .then(data => {
            if (data.data) {
              localStorage.setItem('sdhq-algorithm-data', JSON.stringify(data.data))
              localStorage.setItem('sdhq-algorithm-updated', data.lastUpdated)
              setLastUpdated(data.lastUpdated)
              setPlatforms(prevPlatforms => prevPlatforms.map(p => ({
                ...p,
                data: data.data[p.id] || null
              })))
            }
          })
          .catch(error => {
            console.error('Error fetching algorithm data:', error)
            if (!storedAlgorithmData) {
              setAlgorithmError('Failed to load algorithm data.')
            }
          })
          .finally(() => setIsLoadingAlgorithms(false))
      }
    }

    // Fetch tag database status
    fetch('/api/tags')
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (data.lastUpdated) {
          const totalTags = Object.keys(data.data || {}).reduce((acc: number, key: string) => {
            const tags = data.data[key]
            return acc + (Array.isArray(tags) ? tags.length : 0)
          }, 0)
          setTagDatabaseStatus({
            lastUpdated: data.lastUpdated,
            totalTags
          })
        }
      })
      .catch(error => {
        console.error('Error fetching tag database status:', error)
      })
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-language', language)
    }
  }, [language])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-darkmode', darkMode.toString())
    }
  }, [darkMode])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-subscribers', JSON.stringify(subscribers))
    }
  }, [subscribers])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-lifetime-members', JSON.stringify(lifetimeMembers))
    }
  }, [lifetimeMembers])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-admins', JSON.stringify(admins))
    }
  }, [admins])

  // Activity logs are now persisted server-side via backend API, no localStorage needed

  // Fetch activity logs from backend for admins
  useEffect(() => {
    if (isAdmin && user) {
      fetch('/api/activity-log')
        .then(res => res.json())
        .then(data => {
          if (data.logs) {
            setActivityLog(data.logs)
          }
        })
        .catch(error => {
          console.error('Error fetching activity logs from backend:', error)
        })
    }
  }, [isAdmin, user])

  // Refresh activity logs
  const refreshActivityLog = () => {
    if (isAdmin && user) {
      fetch('/api/activity-log')
        .then(res => res.json())
        .then(data => {
          if (data.logs) {
            setActivityLog(data.logs)
          }
        })
        .catch(error => {
          console.error('Error refreshing activity logs:', error)
        })
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isLifetime', isLifetime.toString())
    }
  }, [isLifetime])

  // Track user login
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      const newEntry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'login'
      }
      setActivityLog(prev => [newEntry, ...prev].slice(0, 100))
      
      // Also log to backend
      fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          action: 'login'
        })
      }).catch(error => console.error('Failed to log to backend:', error))
    }
  }, [user?.id]) // Only run when user ID changes (login)

  // Update tag rate limit when role changes
  useEffect(() => {
    const hasUnlimited = userRole === 'owner' || userRole === 'admin'
    const isPaidUser = userRole === 'subscriber' || userRole === 'subscriber_lifetime'
    
    if (hasUnlimited) {
      setTagRateLimit({ remaining: -1, resetTime: null })
    } else if (isPaidUser) {
      // Subscribers and lifetime get 20 uses
      if (tagRateLimit.remaining !== 20 && tagRateLimit.remaining !== -1) {
        setTagRateLimit({ remaining: 20, resetTime: null })
      }
    } else {
      // Free users get 3 uses
      if (tagRateLimit.remaining !== 3 && tagRateLimit.remaining !== -1) {
        setTagRateLimit({ remaining: 3, resetTime: null })
      }
    }
  }, [userRole])

  // Update clip analyzer rate limit when role changes
  useEffect(() => {
    const hasUnlimited = userRole === 'owner' || userRole === 'admin'
    const isPaidUser = userRole === 'subscriber' || userRole === 'subscriber_lifetime'
    
    if (hasUnlimited) {
      setClipRateLimit({ remaining: -1, resetTime: null })
    } else if (isPaidUser) {
      // Subscribers and lifetime get 3 uses
      if (clipRateLimit.remaining !== 3 && clipRateLimit.remaining !== -1) {
        setClipRateLimit({ remaining: 3, resetTime: null })
      }
    } else {
      // Free users get no access (0 uses)
      if (clipRateLimit.remaining !== 0 && clipRateLimit.remaining !== -1) {
        setClipRateLimit({ remaining: 0, resetTime: null })
      }
    }
  }, [userRole])

  // Update countdown timer for rate limit reset
  useEffect(() => {
    if (tagRateLimit.resetTime) {
      const updateCountdown = () => {
        const now = Date.now()
        const resetTime = tagRateLimit.resetTime
        if (!resetTime) return
        
        const diff = resetTime - now

        if (diff <= 0) {
          setTimeUntilReset('Reseting now...')
          return
        }

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        if (hours > 0) {
          setTimeUntilReset(`${hours}h ${minutes}m ${seconds}s`)
        } else if (minutes > 0) {
          setTimeUntilReset(`${minutes}m ${seconds}s`)
        } else {
          setTimeUntilReset(`${seconds}s`)
        }
      }

      updateCountdown()
      const interval = setInterval(updateCountdown, 1000)

      return () => clearInterval(interval)
    } else {
      setTimeUntilReset('')
    }
  }, [tagRateLimit.resetTime])

  // Clip Analyzer functions
  const detectPlatform = (url: string): string => {
    if (url.includes('tiktok.com')) return 'tiktok'
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return url.includes('/shorts/') ? 'youtube-shorts' : 'youtube-long'
    }
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook-reels'
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
    return 'unknown'
  }

  const handleAnalyzeClip = async () => {
    if (!clipFile) {
      setClipError('Please select a video file to analyze.')
      return
    }

    if (!clipPlatform) {
      setClipError('Please select a target platform.')
      return
    }

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    if (!validTypes.includes(clipFile.type)) {
      setClipError('Please select a valid video file (MP4, WebM, MOV, or AVI).')
      return
    }

    // Validate file size (max 500MB for R2 uploads)
    const maxSize = 500 * 1024 * 1024
    if (clipFile.size > maxSize) {
      setClipError('File size must be less than 500MB.')
      return
    }

    setClipError('')
    setIsAnalyzingClip(true)
    setClipAnalysisResult(null)
    setExtractedData(null)
    setShowReanalysis(false)

    const loadingSteps = [
      'Requesting upload URL...',
      'Uploading video to cloud storage...',
      'Analyzing video content with Gemini 2.5 Pro...',
      'Processing visual and audio elements...',
      'Generating platform-specific recommendations...',
      'Creating optimization report...',
    ]

    let step = 0
    const stepInterval = setInterval(() => {
      if (step < loadingSteps.length) {
        setLoadingStep(loadingSteps[step])
        step++
      }
    }, 800)

    try {
      const userType = isOwner ? 'owner' : isAdmin ? 'admin' : isLifetimeMember ? 'lifetime' : isSubscribed ? 'subscribed' : 'free'
      
      // Step 1: Get presigned upload URL from our API
      console.log('Clip Upload: Step 1 - Requesting presigned URL...')
      console.log('Clip Upload: File details:', { name: clipFile.name, type: clipFile.type, size: clipFile.size })
      
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: clipFile.name,
          contentType: clipFile.type
        })
      })

      console.log('Clip Upload: URL response status:', urlRes.status, urlRes.statusText)
      
      if (!urlRes.ok) {
        const errorText = await urlRes.text()
        console.error('Clip Upload: Failed to get upload URL. Status:', urlRes.status, 'Response:', errorText)
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || 'Failed to get upload URL' }
        }
        throw new Error(`Upload URL Error (${urlRes.status}): ${errorData.error || errorText || 'Unknown error'}`)
      }

      const { uploadUrl, fileKey } = await urlRes.json()
      console.log('Clip Upload: Got presigned URL and fileKey:', fileKey)

      // Step 2: Upload file directly to R2 (bypasses Vercel limits)
      console.log('Clip Upload: Step 2 - Uploading to R2...')
      console.log('Clip Upload: Upload URL:', uploadUrl.substring(0, 50) + '...')
      
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: clipFile,
        headers: {
          'Content-Type': clipFile.type
        }
      })

      console.log('Clip Upload: R2 upload response status:', uploadRes.status, uploadRes.statusText)
      
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text()
        console.error('Clip Upload: R2 upload failed. Status:', uploadRes.status, 'Response:', errorText)
        throw new Error(`R2 Upload Error (${uploadRes.status}): ${errorText || uploadRes.statusText || 'Failed to upload file to cloud storage'}`)
      }
      
      console.log('Clip Upload: File uploaded to R2 successfully')

      // Step 3: Call clip-analyzer with fileKey (R2 mode)
      console.log('Clip Upload: Step 3 - Calling clip-analyzer...')
      console.log('Clip Upload: Sending fileKey:', fileKey, 'Platform:', clipPlatform, 'UserType:', userType)
      
      const formData = new FormData()
      formData.append('fileKey', fileKey)
      formData.append('uploadMode', 'r2')
      formData.append('platform', clipPlatform)
      formData.append('userId', user?.id || '')
      formData.append('userType', userType)
      
      const res = await fetch('/api/clip-analyzer', {
        method: 'POST',
        body: formData
      })
      
      console.log('Clip Upload: Analyzer response status:', res.status, res.statusText)

      clearInterval(stepInterval)

      if (!res.ok) {
        const errorData = await res.json()
        if (res.status === 429) {
          const resetDate = new Date(errorData.resetTime)
          const maxUses = isSubscribed ? 5 : 0
          const diff = resetDate.getTime() - Date.now()
          const hours = Math.floor(diff / (1000 * 60 * 60))
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          const timeString = hours > 0 
            ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`
            : `${minutes} minute${minutes > 1 ? 's' : ''}`
          setClipRateLimit({ remaining: 0, resetTime: errorData.resetTime })
          throw new Error(`Rate limit exceeded. You have used your ${maxUses} clip analyses for the day.\n\nYou can analyze more clips in ${timeString}.\n\nResets at: ${resetDate.toLocaleString()}`)
        }
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await res.json()
      setClipAnalysisResult(data)
      setExtractedData(data.extractedData || null)
      setShowReanalysis(true)
      
      // Log clip analysis activity
      if (user) {
        const clipEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'clip_analysis',
          details: `Analyzed video for ${platforms.find(p => p.id === clipPlatform)?.name} (score: ${data.score})`
        }
        setActivityLog(prev => [clipEntry, ...prev].slice(0, 100))
        
        // Log to backend
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            action: 'clip_analysis',
            details: `Analyzed video for ${platforms.find(p => p.id === clipPlatform)?.name} (score: ${data.score})`
          })
        }).catch(error => console.error('Failed to log to backend:', error))
      }
      
      // Decrement rate limit after successful analysis (only if not unlimited)
      if (clipRateLimit.remaining !== -1) {
        setClipRateLimit(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }))
      }
    } catch (error) {
      clearInterval(stepInterval)
      setClipError(error instanceof Error ? error.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzingClip(false)
      setLoadingStep('')
    }
  }

  const handleReanalyzeClip = async (newPlatform: string) => {
    if (!extractedData) {
      setClipError('No extracted data available for re-analysis.')
      return
    }

    setClipError('')
    setIsAnalyzingClip(true)
    setClipAnalysisResult(null)

    const loadingSteps = [
      'Loading extracted data...',
      'Researching new platform algorithm...',
      'Cross-referencing with algorithm...',
      'Generating optimization report...',
    ]

    let step = 0
    const stepInterval = setInterval(() => {
      if (step < loadingSteps.length) {
        setLoadingStep(loadingSteps[step])
        step++
      }
    }, 900)

    try {
      const userType = isOwner ? 'owner' : isAdmin ? 'admin' : isLifetimeMember ? 'lifetime' : isSubscribed ? 'subscribed' : 'free'
      
      const res = await fetch('/api/clip-analyzer/reanalyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          extractedData: extractedData,
          originalPlatform: clipPlatform,
          newPlatform: newPlatform,
          userId: user?.id || '',
          userType: userType
        })
      })

      clearInterval(stepInterval)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Re-analysis failed')
      }

      const data = await res.json()
      setClipAnalysisResult(data)
      setClipPlatform(newPlatform)
      
      // Log re-analysis activity
      if (user) {
        const reanalysisEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'clip_reanalysis',
          details: `Re-analyzed for ${platforms.find(p => p.id === newPlatform)?.name}`
        }
        setActivityLog(prev => [reanalysisEntry, ...prev].slice(0, 100))
        
        // Log to backend
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            action: 'clip_reanalysis',
            details: `Re-analyzed for ${platforms.find(p => p.id === newPlatform)?.name}`
          })
        }).catch(error => console.error('Failed to log to backend:', error))
      }
    } catch (error) {
      clearInterval(stepInterval)
      setClipError(error instanceof Error ? error.message : 'Re-analysis failed. Please try again.')
    } finally {
      setIsAnalyzingClip(false)
      setLoadingStep('')
    }
  }

  const handleResetClip = () => {
    setClipFile(null)
    setClipPlatform('tiktok')
    setClipAnalysisResult(null)
    setClipError('')
    setExtractedData(null)
    setShowReanalysis(false)
  }

  // Content Analyzer functions
  const handleAnalyzeContent = async () => {
    if (!contentUrl) {
      setContentError('Please enter a video URL to analyze.')
      return
    }

    const detectedPlatform = detectPlatform(contentUrl)
    if (detectedPlatform === 'unknown') {
      setContentError('Could not detect platform. Please enter a valid video URL from TikTok, Instagram, YouTube, Facebook, or Twitter.')
      return
    }

    setContentError('')
    setIsAnalyzingContent(true)
    setContentAnalysisResult(null)
    setContentExtractedData(null)
    setShowContentReanalysis(false)

    const loadingSteps = [
      'Extracting video information...',
      'Analyzing content with Supadata...',
      'Researching platform algorithm...',
      'Cross-referencing with algorithm...',
      'Generating optimization report...',
    ]

    let step = 0
    const stepInterval = setInterval(() => {
      if (step < loadingSteps.length) {
        setContentLoadingStep(loadingSteps[step])
        step++
      }
    }, 900)

    try {
      const userType = isOwner ? 'owner' : isAdmin ? 'admin' : isLifetimeMember ? 'lifetime' : isSubscribed ? 'subscribed' : 'free'
      
      const res = await fetch('/api/content-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: contentUrl,
          platform: detectedPlatform,
          userId: user?.id || '',
          userType: userType
        })
      })

      clearInterval(stepInterval)

      if (!res.ok) {
        const errorData = await res.json()
        if (res.status === 429) {
          const resetDate = new Date(errorData.resetTime)
          const maxUses = isSubscribed ? 5 : 0
          const diff = resetDate.getTime() - Date.now()
          const hours = Math.floor(diff / (1000 * 60 * 60))
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          const timeString = hours > 0 
            ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`
            : `${minutes} minute${minutes > 1 ? 's' : ''}`
          setContentRateLimit({ remaining: 0, resetTime: errorData.resetTime })
          throw new Error(`Rate limit exceeded. You have used your ${maxUses} content analyses for the day.\n\nYou can analyze more content in ${timeString}.\n\nResets at: ${resetDate.toLocaleString()}`)
        }
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await res.json()
      setContentAnalysisResult(data)
      setContentPlatform(detectedPlatform)
      setContentExtractedData(data.extractedData || null)
      setShowContentReanalysis(true)
      
      // Log content analysis activity
      if (user) {
        const contentEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'content_analysis',
          details: `Analyzed video for ${platforms.find(p => p.id === detectedPlatform)?.name} (score: ${data.score})`
        }
        setActivityLog(prev => [contentEntry, ...prev].slice(0, 100))
        
        // Log to backend
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            action: 'content_analysis',
            details: `Analyzed video for ${platforms.find(p => p.id === detectedPlatform)?.name} (score: ${data.score})`
          })
        }).catch(error => console.error('Failed to log to backend:', error))
      }
      
      // Decrement rate limit after successful analysis (only if not unlimited)
      if (contentRateLimit.remaining !== -1) {
        setContentRateLimit(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }))
      }
    } catch (error) {
      clearInterval(stepInterval)
      setContentError(error instanceof Error ? error.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzingContent(false)
      setContentLoadingStep('')
    }
  }

  const handleReanalyzeContent = async (newPlatform: string) => {
    if (!contentExtractedData) {
      setContentError('No extracted data available for re-analysis.')
      return
    }

    setContentError('')
    setIsAnalyzingContent(true)
    setContentAnalysisResult(null)

    const loadingSteps = [
      'Loading extracted data...',
      'Researching new platform algorithm...',
      'Cross-referencing with algorithm...',
      'Generating optimization report...',
    ]

    let step = 0
    const stepInterval = setInterval(() => {
      if (step < loadingSteps.length) {
        setContentLoadingStep(loadingSteps[step])
        step++
      }
    }, 900)

    try {
      const userType = isOwner ? 'owner' : isAdmin ? 'admin' : isLifetimeMember ? 'lifetime' : isSubscribed ? 'subscribed' : 'free'
      
      const res = await fetch('/api/content-analyzer/reanalyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          extractedData: contentExtractedData,
          originalPlatform: contentPlatform,
          newPlatform: newPlatform,
          userId: user?.id || '',
          userType: userType
        })
      })

      clearInterval(stepInterval)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Re-analysis failed')
      }

      const data = await res.json()
      setContentAnalysisResult(data)
      setContentPlatform(newPlatform)
      
      // Log re-analysis activity
      if (user) {
        const reanalysisEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'content_reanalysis',
          details: `Re-analyzed for ${platforms.find(p => p.id === newPlatform)?.name}`
        }
        setActivityLog(prev => [reanalysisEntry, ...prev].slice(0, 100))
        
        // Log to backend
        fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            action: 'content_reanalysis',
            details: `Re-analyzed for ${platforms.find(p => p.id === newPlatform)?.name}`
          })
        }).catch(error => console.error('Failed to log to backend:', error))
      }
    } catch (error) {
      clearInterval(stepInterval)
      setContentError(error instanceof Error ? error.message : 'Re-analysis failed. Please try again.')
    } finally {
      setIsAnalyzingContent(false)
      setContentLoadingStep('')
    }
  }

  const handleResetContent = () => {
    setContentUrl('')
    setContentPlatform('')
    setContentAnalysisResult(null)
    setContentError('')
    setContentExtractedData(null)
    setShowContentReanalysis(false)
  }

  const handleLogin = async () => {
    try {
      const { url, codeVerifier } = await createKickAuthURL()
      // Use cookie for better persistence across redirects
      document.cookie = `kickCodeVerifier=${codeVerifier}; path=/; max-age=300; SameSite=Lax`
      document.cookie = `kickAuthReturn=${window.location.pathname}; path=/; max-age=300; SameSite=Lax`
      window.location.href = url
    } catch (error) {
      console.error('Failed to create KICK auth URL:', error)
    }
  }

  const handleLogout = () => {
    // Log logout activity
    if (user && isAdmin) {
      const logoutEntry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'logout'
      }
      setActivityLog(prev => [logoutEntry, ...prev].slice(0, 100))
      
      // Log to backend
      fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          action: 'logout'
        })
      }).catch(error => console.error('Failed to log to backend:', error))
    }
    
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kickUser')
      localStorage.removeItem('kickAccessToken')
      window.location.href = '/'
    }
  }

  const handleVerifySubscription = () => {
    setShowSubscribePopup(true)
    setPaypalLoaded(false)
  }

  const handleLifetimeSubscription = () => {
    setShowLifetimePopup(true)
    setPaypalLoaded(false)
  }

  // Load PayPal SDK and render subscription button
  useEffect(() => {
    if (showSubscribePopup && !paypalLoaded) {
      // Remove existing PayPal button if any
      const container = document.getElementById('paypal-button-container')
      if (container) {
        container.innerHTML = ''
      }

      // Load PayPal SDK
      const isSandbox = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'
      const paypalClientId = isSandbox 
        ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX 
        : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
      
      if (!paypalClientId) {
        console.error('PayPal Client ID not configured', { isSandbox })
        return
      }
      
      console.log(`PayPal: Loading SDK in ${isSandbox ? 'SANDBOX' : 'LIVE'} mode`)
      
      const script = document.createElement('script')
      script.src = `https://www.${isSandbox ? 'sandbox.' : ''}paypal.com/sdk/js?client-id=${paypalClientId}&vault=true&intent=subscription`
      script.setAttribute('data-sdk-integration-source', 'button-factory')
      script.onload = () => {
        console.log('PayPal SDK loaded successfully')
        // Render PayPal button after SDK loads
        if (window.paypal && user) {
          console.log('PayPal: Rendering subscription button...')
          const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID
          console.log('PayPal: Plan ID present:', !!planId)
          
          if (!planId) {
            console.error('PayPal: Plan ID not configured!')
            alert('PayPal configuration error: Plan ID not set. Please contact support.')
            return
          }
          
          try {
            const buttons = window.paypal.Buttons({
              style: {
                shape: 'pill',
                color: 'blue',
                layout: 'horizontal',
                label: 'subscribe'
              },
              createSubscription: function(data: any, actions: any) {
                console.log('PayPal: Creating subscription with plan:', planId)
                return actions.subscription.create({
                  plan_id: planId,
                  custom_id: `${user.username}|${paypalEmail}`
                }).catch((err: any) => {
                  console.error('PayPal: Subscription creation failed:', err)
                  alert('Failed to create subscription. Please try again.')
                  throw err
                })
              },
              onApprove: function(data: any, actions: any) {
                console.log('Subscription approved:', data.subscriptionID)
                setSubscriptionId(data.subscriptionID)
                
                // Close our subscribe popup
                setShowSubscribePopup(false)
                
                // Force close any PayPal popup windows
                try {
                  // Try to find and close PayPal windows by name
                  const paypalWindows = window.open('', 'paypal')
                  if (paypalWindows && !paypalWindows.closed) {
                    paypalWindows.close()
                  }
                  const sdkWindows = window.open('', '__paypalSDK__')
                  if (sdkWindows && !sdkWindows.closed) {
                    sdkWindows.close()
                  }
                } catch (e) {
                  console.log('Could not auto-close PayPal window:', e)
                }
                
                // Start polling for verification status immediately (silently in background)
                pollVerificationStatus(data.subscriptionID)
              },
              onError: function(err: any) {
                console.error('PayPal button error:', err)
                alert('PayPal button error: ' + (err.message || 'Unknown error'))
              },
              onCancel: function() {
                console.log('PayPal subscription cancelled by user')
              }
            })
            
            if (buttons.isEligible()) {
              buttons.render('#paypal-button-container')
              console.log('PayPal: Button rendered successfully')
              setPaypalLoaded(true)
            } else {
              console.error('PayPal: Button not eligible for rendering')
              alert('PayPal button is not eligible. Please check your PayPal configuration.')
            }
          } catch (err) {
            console.error('PayPal: Error creating buttons:', err)
            alert('Failed to initialize PayPal. Please try again.')
          }
        } else {
          console.error('PayPal: window.paypal or user not available')
        }
      }
      script.onerror = (err) => {
        console.error('PayPal: Failed to load SDK:', err)
        alert('Failed to load PayPal. Please check your internet connection and try again.')
      }
      document.body.appendChild(script)

      return () => {
        document.body.removeChild(script)
      }
    }
  }, [showSubscribePopup, user, paypalLoaded, paypalEmail])

  // Load PayPal SDK for lifetime membership - WORKS LIKE SUBSCRIPTION BUTTON
  useEffect(() => {
    if (showLifetimePopup && !paypalLoaded && user) {
      const isSandbox = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'
      const paypalClientId = isSandbox 
        ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX 
        : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
      
      if (!paypalClientId) {
        console.error('PayPal Client ID not configured', { isSandbox })
        return
      }
      
      console.log(`PayPal Lifetime: Loading SDK in ${isSandbox ? 'SANDBOX' : 'LIVE'} mode`)
      
      const script = document.createElement('script')
      script.src = `https://www.${isSandbox ? 'sandbox.' : ''}paypal.com/sdk/js?client-id=${paypalClientId}&currency=CAD`
      script.setAttribute('data-sdk-integration-source', 'button-factory')
      script.onload = () => {
        if (window.paypal && user) {
          window.paypal.Buttons({
            style: {
              shape: 'pill',
              color: 'blue',
              layout: 'horizontal',
              label: 'pay'
            },
            createOrder: function(data: any, actions: any) {
              return actions.order.create({
                purchase_units: [{
                  amount: {
                    value: '54.99',
                    currency_code: 'CAD'
                  },
                  description: 'SDHQ Creator Corner Lifetime Membership',
                  custom_id: `${user.username}|lifetime`
                }]
              })
            },
            onApprove: function(data: any, actions: any) {
              console.log('Lifetime payment approved:', data.orderID)
              
              // Close popup and start polling - webhook will handle verification
              setShowLifetimePopup(false)
              pollVerificationStatus(data.orderID)
            }
          }).render('#paypal-lifetime-button-container')
          setPaypalLoaded(true)
        }
      }
      document.body.appendChild(script)

      return () => {
        document.body.removeChild(script)
      }
    }
  }, [showLifetimePopup, user, paypalLoaded])

  const handleClearActivityLog = async () => {
    setActivityLog([])
    setShowClearConfirm(false)
    
    // Clear from backend
    try {
      await fetch('/api/activity-log', { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to clear activity logs from backend:', error)
    }
  }

  const handleAddSubscriber = async () => {
    if (newSubscriberUsername.trim()) {
      // Strip @ prefix if present
      const username = newSubscriberUsername.trim().replace(/^@/, '')
      
      // Optimistic update - add to local state immediately
      const newSubscriber: Subscriber = {
        id: Date.now().toString(),
        username: username,
        addedAt: new Date().toISOString()
      }
      setSubscribers(prev => [...prev, newSubscriber])
      setNewSubscriberUsername('')
      
      try {
        const response = await fetch('/api/subscribers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, action: 'add' })
        })
        
        if (response.ok) {
          // Log to activity
          const logEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user?.username || 'Unknown',
            timestamp: new Date().toISOString(),
            action: 'subscriber_added',
            details: `Added ${username} to subscribers list`
          }
          setActivityLog(prev => [logEntry, ...prev].slice(0, 100))
        } else {
          console.error('Failed to add subscriber:', response.status)
          alert('Failed to add subscriber. Server returned error.')
          // Revert optimistic update on error
          setSubscribers(prev => prev.filter(s => s.id !== newSubscriber.id))
        }
      } catch (error) {
        console.error('Failed to add subscriber:', error)
        alert('Failed to add subscriber. Please try again.')
        // Revert optimistic update on error
        setSubscribers(prev => prev.filter(s => s.id !== newSubscriber.id))
      }
    }
  }

  const handleRemoveSubscriber = async (id: string) => {
    const subscriber = subscribers.find(sub => sub.id === id)
    if (!subscriber) return
    
    // Optimistic update - remove from local state immediately
    setSubscribers(prev => prev.filter(s => s.id !== id))
    
    try {
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: subscriber.username, action: 'remove' })
      })
      
      if (response.ok) {
        // Log to activity
        const logEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
          action: 'subscriber_removed',
          details: `Removed ${subscriber.username} from subscribers list`
        }
        setActivityLog(prev => [logEntry, ...prev].slice(0, 100))
      } else {
        console.error('Failed to remove subscriber:', response.status)
        alert('Failed to remove subscriber. Server returned error.')
        // Revert optimistic update on error
        setSubscribers(prev => [...prev, subscriber])
      }
    } catch (error) {
      console.error('Failed to remove subscriber:', error)
      alert('Failed to remove subscriber. Please try again.')
      // Revert optimistic update on error
      setSubscribers(prev => [...prev, subscriber])
    }
  }

  const handleAddLifetime = async () => {
    if (newLifetimeUsername.trim()) {
      // Strip @ prefix if present
      const username = newLifetimeUsername.trim().replace(/^@/, '')
      
      // Optimistic update - add to local state immediately
      const newLifetimeMember: LifetimeMember = {
        id: Date.now().toString(),
        username: username,
        addedAt: new Date().toISOString()
      }
      setLifetimeMembers(prev => [...prev, newLifetimeMember])
      setNewLifetimeUsername('')
      
      try {
        const response = await fetch('/api/lifetime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, action: 'add' })
        })
        
        if (response.ok) {
          // Log to activity
          const logEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user?.username || 'Unknown',
            timestamp: new Date().toISOString(),
            action: 'lifetime_added',
            details: `Added ${username} to lifetime members list`
          }
          setActivityLog(prev => [logEntry, ...prev].slice(0, 100))
        } else {
          console.error('Failed to add lifetime member:', response.status)
          alert('Failed to add lifetime member. Server returned error.')
          // Revert optimistic update on error
          setLifetimeMembers(prev => prev.filter(m => m.id !== newLifetimeMember.id))
        }
      } catch (error) {
        console.error('Failed to add lifetime member:', error)
        alert('Failed to add lifetime member. Please try again.')
        // Revert optimistic update on error
        setLifetimeMembers(prev => prev.filter(m => m.id !== newLifetimeMember.id))
      }
    }
  }

  const handleRemoveLifetime = async (id: string) => {
    const member = lifetimeMembers.find(m => m.id === id)
    if (!member) return
    
    // Optimistic update - remove from local state immediately
    setLifetimeMembers(prev => prev.filter(m => m.id !== id))
    
    try {
      const response = await fetch('/api/lifetime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: member.username, action: 'remove' })
      })
      
      if (response.ok) {
        // Log to activity
        const logEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
          action: 'lifetime_removed',
          details: `Removed ${member.username} from lifetime members list`
        }
        setActivityLog(prev => [logEntry, ...prev].slice(0, 100))
      } else {
        console.error('Failed to remove lifetime member:', response.status)
        alert('Failed to remove lifetime member. Server returned error.')
        // Revert optimistic update on error
        setLifetimeMembers(prev => [...prev, member])
      }
    } catch (error) {
      console.error('Failed to remove lifetime member:', error)
      alert('Failed to remove lifetime member. Please try again.')
      // Revert optimistic update on error
      setLifetimeMembers(prev => [...prev, member])
    }
  }

  const handleAddAdmin = async () => {
    if (newAdminUsername.trim()) {
      // Strip @ prefix if present
      const username = newAdminUsername.trim().replace(/^@/, '')
      
      // Optimistic update - add to local state immediately
      const newAdmin: Admin = {
        id: Date.now().toString(),
        username: username,
        addedAt: new Date().toISOString()
      }
      setAdmins(prev => [...prev, newAdmin])
      setNewAdminUsername('')
      
      try {
        const response = await fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, action: 'add' })
        })
        
        if (response.ok) {
          // Log to activity
          const logEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user?.username || 'Unknown',
            timestamp: new Date().toISOString(),
            action: 'admin_added',
            details: `Added ${username} to admins list`
          }
          setActivityLog(prev => [logEntry, ...prev].slice(0, 100))
        } else {
          console.error('Failed to add admin:', response.status)
          alert('Failed to add admin. Server returned error.')
          // Revert optimistic update on error
          setAdmins(prev => prev.filter(a => a.id !== newAdmin.id))
        }
      } catch (error) {
        console.error('Failed to add admin:', error)
        alert('Failed to add admin. Please try again.')
        // Revert optimistic update on error
        setAdmins(prev => prev.filter(a => a.id !== newAdmin.id))
      }
    }
  }

  const handleRemoveAdmin = async (id: string) => {
    const admin = admins.find(a => a.id === id)
    if (!admin) return
    
    // Optimistic update - remove from local state immediately
    setAdmins(prev => prev.filter(a => a.id !== id))
    
    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: admin.username, action: 'remove' })
      })
      
      if (response.ok) {
        // Log to activity
        const logEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
          action: 'admin_removed',
          details: `Removed ${admin.username} from admins list`
        }
        setActivityLog(prev => [logEntry, ...prev].slice(0, 100))
      } else {
        console.error('Failed to remove admin:', response.status)
        alert('Failed to remove admin. Server returned error.')
        // Revert optimistic update on error
        setAdmins(prev => [...prev, admin])
      }
    } catch (error) {
      console.error('Failed to remove admin:', error)
      alert('Failed to remove admin. Please try again.')
      // Revert optimistic update on error
      setAdmins(prev => [...prev, admin])
    }
  }

  const handleResetTagUsages = async () => {
    if (!isAdmin) return

    if (!confirm('Are you sure you want to reset all tag generator usages? This will allow all users to generate tags again.')) {
      return
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.username })
      })

      if (response.ok) {
        alert('Tag generator usages reset successfully!')
      } else {
        alert('Failed to reset tag generator usages.')
      }
    } catch (error) {
      console.error('Error resetting tag usages:', error)
      alert('Error resetting tag generator usages.')
    }
  }

  const pollVerificationStatus = (subscriptionId: string) => {
    if (!user) return
    
    console.log('Starting verification polling for:', subscriptionId)
    setIsVerifying(true)
    
    let pollCount = 0
    const maxPolls = 60
    
    const poll = setInterval(async () => {
      pollCount++
      console.log(`Polling attempt ${pollCount}...`)
      
      try {
        const response = await fetch(`/api/paypal-webhook?username=${user.username.toLowerCase()}`)
        const data = await response.json()
        console.log('Poll response:', data)
        
        if (data.verified) {
          console.log('✅ VERIFIED! Stopping poll and reloading...')
          clearInterval(poll)
          
          // Store data in localStorage
          if (data.isLifetime) {
            localStorage.setItem('isLifetime', 'true')
          } else {
            localStorage.setItem('isVerified', 'true')
            localStorage.setItem('verificationExpiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString())
          }
          localStorage.setItem('verifiedUsername', user.username)
          localStorage.setItem('subscriptionId', data.subscriptionId)
          
          // Close modal and force fresh reload
          setIsVerifying(false)
          console.log('Reloading page now...')
          
          // Clear any cached user data
          sessionStorage.removeItem('userData')
          
          // Force reload with cache-busting parameter
          const url = new URL(window.location.href)
          url.searchParams.set('verified', Date.now().toString())
          window.location.replace(url.toString())
        }
        
        if (pollCount >= maxPolls) {
          console.log('Max polls reached, stopping')
          clearInterval(poll)
          setIsVerifying(false)
          alert('Verification is taking longer than expected. Please refresh the page to check your status.')
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000)
  }
  
  const checkPaymentStatus = async () => {
    if (!paypalEmail || !user) {
      alert('Please enter your PayPal email address to verify your subscription.')
      return
    }
    
    // Log verification attempt
    const attemptEntry: ActivityLogEntry = {
      id: Date.now().toString(),
      username: user.username,
      timestamp: new Date().toISOString(),
      action: 'verification_attempt',
      details: `Subscription verification attempt - PayPal Email: ${paypalEmail}, Subscription ID: ${subscriptionId || 'Not provided'}`
    }
    setActivityLog(prev => [attemptEntry, ...prev].slice(0, 100))
    
    try {
      const response = await fetch('/api/check-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: user.username,
          paypalEmail,
          subscriptionId,
        }),
      })
      
      const data = await response.json()
      
      if (data.verified) {
        // Check if this is a lifetime purchase
        const isLifetimePurchase = data.customId && data.customId.includes('lifetime')
        
        if (isLifetimePurchase) {
          // Lifetime membership - no expiry
          setIsLifetime(true)
          localStorage.setItem('isLifetime', 'true')
          localStorage.setItem('verifiedUsername', user.username)
          localStorage.setItem('subscriptionId', data.subscriptionId)
        } else {
          // Regular subscription - unlock premium features
          setIsVerified(true)
          localStorage.setItem('isVerified', 'true')
          localStorage.setItem('verifiedUsername', user.username)
          localStorage.setItem('verificationExpiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString()) // 30 days
          localStorage.setItem('subscriptionId', data.subscriptionId)
        }
        
        // Add to subscribers list for admin visibility
        const verifiedUser = {
          id: Date.now().toString(),
          username: user.username,
          addedAt: new Date().toISOString()
        }
        setSubscribers(prev => [...prev, verifiedUser])
        
        // Refresh users with roles for owner settings view
        await fetchUsersWithRoles()
        
        // Log successful subscription
        const successEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'payment_success',
          details: `Subscription verified - Subscription ID: ${data.subscriptionId}, Status: ${data.status}`
        }
        setActivityLog(prev => [successEntry, ...prev].slice(0, 100))
        
        alert(`Subscription verified! Subscription ID: ${data.subscriptionId}\nStatus: ${data.status}\n\nPremium features unlocked for 30 days!`)
        setShowSubscribePopup(false)
        
        // Refresh the page to show updated role
        window.location.reload()
      } else {
        // Log failed verification
        const failedEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'payment_failed',
          details: `Subscription verification failed - PayPal Email: ${paypalEmail}`
        }
        setActivityLog(prev => [failedEntry, ...prev].slice(0, 100))
        
        alert(data.message || 'Subscription not found. Make sure you:\n1. Completed the PayPal subscription\n2. The subscription is active\n3. The PayPal email matches the one you entered')
      }
    } catch (error) {
      console.error('Subscription check failed:', error)
      alert('Failed to verify subscription. Please try again in a moment.')
    }
  }


  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  function generateRandomString(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  // Theme classes based on dark mode
  const themeClasses = darkMode 
    ? 'min-h-screen bg-black text-white' 
    : 'min-h-screen bg-gradient-to-br from-cyan-50 to-green-50'
  
  const headerClasses = darkMode
    ? 'bg-gradient-to-r from-sdhq-dark-800 via-sdhq-dark-800 to-sdhq-dark-700/90 backdrop-blur-xl border-b border-sdhq-cyan-500/30 shadow-2xl'
    : 'bg-gradient-to-r from-white via-white to-cyan-50/80 backdrop-blur-xl border-b border-sdhq-cyan-300 shadow-2xl'
  
  const cardClasses = darkMode
    ? 'bg-sdhq-dark-800/90 border border-sdhq-dark-700 rounded-xl shadow-lg'
    : 'bg-white/80 backdrop-blur-sm border border-sdhq-cyan-200 rounded-xl shadow-lg'
  
  const tabListClasses = darkMode
    ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-700 border-2 border-sdhq-cyan-500/30 shadow-xl'
    : 'bg-gradient-to-br from-white to-cyan-50 border-2 border-sdhq-cyan-300 shadow-xl'
  
  const tabTriggerActiveClasses = darkMode
    ? 'bg-gradient-to-r from-sdhq-cyan-500/20 to-sdhq-green-500/20 text-sdhq-cyan-400 border-b-2 border-sdhq-cyan-500 shadow-lg'
    : 'bg-gradient-to-r from-sdhq-cyan-100 to-sdhq-green-100 text-sdhq-cyan-700 border-b-2 border-sdhq-cyan-500 shadow-lg'

  const tabTriggerInactiveClasses = darkMode
    ? 'text-gray-400 hover:text-sdhq-cyan-300 hover:bg-sdhq-dark-700/50 border-r border-sdhq-cyan-500/20 shadow-sm'
    : 'text-gray-600 hover:text-sdhq-cyan-600 hover:bg-cyan-50/50 border-r border-sdhq-cyan-300 shadow-sm'

  const textClasses = darkMode
    ? 'text-gray-300'
    : 'text-gray-600'

  const subtitleClasses = darkMode
    ? 'text-gray-400'
    : 'text-gray-500'

  if (!mounted) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-black' : ''}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sdhq-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className={themeClasses}>
      {/* Header */}
      <header className={headerClasses}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - User info */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  {user.profile_image_url ? (
                    <img 
                      src={user.profile_image_url} 
                      alt={user.display_name}
                      className={`w-12 h-12 rounded-full border-2 ${darkMode ? 'border-sdhq-cyan-500' : 'border-sdhq-cyan-300'}`}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-green-400 flex items-center justify-center">
                      <User className="w-6 h-6 text-black" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        {user.display_name}
                      </p>
                      <span className={`px-2 py-0.5 text-sm font-bold rounded-full ${ROLE_CONFIG[userRole]?.badgeClass || 'bg-gray-500 text-white'}`}>
                        {ROLE_CONFIG[userRole]?.badge || '🙂 Free User'}
                      </span>
                    </div>
                    <p className={`text-base ${subtitleClasses}`}>@{user.username}</p>
                  </div>
                  {userRole === 'free' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleVerifySubscription}
                      className="ml-2"
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Upgrade
                    </Button>
                  )}
                </div>
              ) : (
                <div />
              )}
            </div>
            
            {/* Center - Logo */}
            <div className="flex-1 flex justify-center">
              {user && (
                <div className="flex items-center space-x-3 group">
                  <div className={`relative p-2 rounded-xl transition-all duration-300 group-hover:scale-110 ${
                    darkMode ? 'bg-sdhq-dark-700 shadow-lg shadow-sdhq-cyan-500/20' : 'bg-white shadow-lg shadow-cyan-500/20'
                  }`}>
                    <img 
                      src="https://iili.io/BebhdFf.png" 
                      alt="SDHQ Logo"
                      className="w-12 h-12"
                    />
                  </div>
                  <span className={`font-bold text-3xl bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 bg-clip-text text-transparent transition-all duration-300 group-hover:scale-105`}>
                    SDHQ Creator Corner
                  </span>
                </div>
              )}
            </div>
            
            {/* Right side - Actions */}
            <div className="flex items-center space-x-3">
              {/* Dark Mode Toggle */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleDarkMode}
                className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              
              {/* Language Selector */}
              <select 
                value={language}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLanguageChange(e.target.value as Language)}
                className={`px-3 py-1.5 rounded-md text-base border ${
                  darkMode 
                    ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                    : 'bg-white border-sdhq-cyan-200 text-gray-900'
                }`}
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
              </select>
              
              {user ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowSettings(true)}
                    className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    {t.settings}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-1" />
                    {t.logout}
                  </Button>
                </>
              ) : (
                <Button onClick={handleLogin} className="sdhq-button">
                  {t.loginButton}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-2 pb-8">
        {!user ? (
          <div className={`flex items-center justify-center min-h-[400px] ${cardClasses} mt-4`}>
            <div className="text-center max-w-md p-8">
              <img 
                src="https://iili.io/BeYpM5F.md.png" 
                alt="SDHQ Creator Corner" 
                className="h-40 mx-auto mb-4"
              />
              <h2 className={`text-3xl font-bold gradient-text mb-4 ${darkMode ? 'from-sdhq-cyan-400 to-sdhq-green-400' : ''}`}>
                {t.welcome}
              </h2>
              <p className={`${textClasses} mb-8`}>
                {t.description}
              </p>
              <Button onClick={handleLogin} className="sdhq-button text-xl px-8 py-3">
                {t.loginButton}
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`grid w-full grid-cols-6 ${tabListClasses}`}>
              <TabsTrigger 
                value="algorithms-explained" 
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">{t.algorithmsExplained}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tag-generator-free"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
              >
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">{t.tagGeneratorFree}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tag-generator-paid"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
              >
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">{t.tagGeneratorPaid}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="clip-analyzer"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">{t.clipAnalyzer}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="content-analyzer"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">{t.contentAnalyzer}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses} data-[state=inactive]:${tabTriggerInactiveClasses}`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">{t.settings}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="algorithms-explained">
              <div className="space-y-6">
                <div className={`flex flex-col items-center mb-6`}>
                  <div className="flex items-center space-x-3 mb-3">
                    <TrendingUp className="w-8 h-8 text-sdhq-cyan-500" />
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {t.algorithmsExplained}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {isLoadingAlgorithms && (
                      <span className={`${subtitleClasses} text-base`}>Loading...</span>
                    )}
                    {algorithmError && (
                      <span className="text-red-500 text-base">{algorithmError}</span>
                    )}
                    <p className={`${subtitleClasses} text-base`}>
                      Last updated: {lastUpdated}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {platforms.map((platform) => (
                    <div
                      key={platform.id}
                      className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                        darkMode 
                          ? 'bg-gradient-to-br from-sdhq-dark-700 to-sdhq-dark-800 border-sdhq-cyan-500/30 hover:border-sdhq-cyan-500/60' 
                          : 'bg-gradient-to-br from-white to-gray-50 border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                      }`}
                    >
                      {/* Platform-specific gradient accent */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
                        platform.id === 'tiktok' ? 'from-pink-500 via-purple-500 to-cyan-500' :
                        platform.id === 'instagram' ? 'from-purple-500 via-pink-500 to-orange-500' :
                        platform.id === 'youtube-shorts' ? 'from-red-500 via-red-600 to-red-700' :
                        platform.id === 'youtube-long' ? 'from-red-600 via-red-700 to-red-800' :
                        'from-blue-500 via-blue-600 to-blue-700'
                      }`}></div>
                      
                      <div className="p-5">
                        <div className="flex items-center space-x-4 mb-5">
                          <div className={`relative p-2 rounded-xl ${
                            darkMode ? 'bg-sdhq-dark-600' : 'bg-white'
                          } shadow-lg`}>
                            <img
                              src={platform.image}
                              alt={platform.name}
                              className="w-14 h-14 rounded-lg object-cover"
                            />
                          </div>
                          <div>
                            <h4 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {platform.name}
                            </h4>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Algorithm Insights
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {platform.data ? (
                            <>
                              {platform.data.summaries ? (
                                // Use AI-generated platform-specific summaries
                                <>
                                  {platform.data.summaries.slice(0, 4).map((summary, index) => (
                                    <div key={index} className="flex items-start space-x-3 group">
                                      <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 transition-all duration-300 ${
                                        index === 0 ? 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-cyan-400 group-hover:scale-125' :
                                        index === 1 ? 'bg-gradient-to-r from-sdhq-green-500 to-sdhq-green-400 group-hover:scale-125' :
                                        index === 2 ? 'bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-cyan-300 group-hover:scale-125' :
                                        'bg-gradient-to-r from-sdhq-green-400 to-sdhq-green-300 group-hover:scale-125'
                                      }`}></div>
                                      <p className={`${textClasses} text-base leading-relaxed group-hover:translate-x-1 transition-transform duration-300`}>{summary}</p>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                // Fallback to generic bullets if summaries not available
                                <>
                                  <div className="flex items-start space-x-3 group">
                                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-cyan-400 group-hover:scale-125"></div>
                                    <p className={`${textClasses} text-base`}>Key algorithm changes</p>
                                  </div>
                                  <div className="flex items-start space-x-3 group">
                                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-gradient-to-r from-sdhq-green-500 to-sdhq-green-400 group-hover:scale-125"></div>
                                    <p className={`${textClasses} text-base`}>Editing optimization tips</p>
                                  </div>
                                  <div className="flex items-start space-x-3 group">
                                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-cyan-300 group-hover:scale-125"></div>
                                    <p className={`${textClasses} text-base`}>Best posting strategies</p>
                                  </div>
                                  <div className="flex items-start space-x-3 group">
                                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-gradient-to-r from-sdhq-green-400 to-sdhq-green-300 group-hover:scale-125"></div>
                                    <p className={`${textClasses} text-base`}>Title & description guides</p>
                                  </div>
                                </>
                              )}
                              <div className="pt-4 mt-3 border-t border-gray-200 dark:border-sdhq-dark-600">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedCard(platform.id)}
                                  className="w-full bg-gradient-to-r from-sdhq-cyan-500/10 to-sdhq-green-500/10 hover:from-sdhq-cyan-500/20 hover:to-sdhq-green-500/20 border-sdhq-cyan-500/50 hover:border-sdhq-cyan-500 transition-all duration-300"
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Read More
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                              <div className="w-8 h-8 border-2 border-sdhq-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className={`${subtitleClasses} text-base`}>Loading algorithm data...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Algorithm Detail Popup */}
            {expandedCard && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                {(() => {
                  const platform = platforms.find(p => p.id === expandedCard)
                  if (!platform) return null
                  return (
                    <div className={`relative overflow-hidden rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 ${
                      darkMode 
                        ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/30' 
                        : 'bg-gradient-to-br from-white to-gray-50 border border-sdhq-cyan-200'
                    }`}>
                      {/* Platform-specific gradient header */}
                      <div className={`h-2 bg-gradient-to-r ${
                        platform.id === 'tiktok' ? 'from-pink-500 via-purple-500 to-cyan-500' :
                        platform.id === 'instagram' ? 'from-purple-500 via-pink-500 to-orange-500' :
                        platform.id === 'youtube-shorts' ? 'from-red-500 via-red-600 to-red-700' :
                        platform.id === 'youtube-long' ? 'from-red-600 via-red-700 to-red-800' :
                        'from-blue-500 via-blue-600 to-blue-700'
                      }`}></div>
                      
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center space-x-4">
                            <div className={`relative p-2 rounded-xl ${
                              darkMode ? 'bg-sdhq-dark-700' : 'bg-white'
                            } shadow-lg`}>
                              <img
                                src={platform.image}
                                alt={platform.name}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            </div>
                            <div>
                              <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {platform.name}
                              </h3>
                              <p className={`text-base ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Algorithm Insights
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setExpandedCard(null)}
                            className={`p-3 rounded-full transition-all duration-300 hover:scale-110 ${
                              darkMode 
                                ? 'bg-sdhq-dark-700 hover:bg-sdhq-dark-600 text-white' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                        
                        <div className="space-y-5">
                          {platform.data ? (
                            <>
                              <div className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <h4 className={`font-semibold mb-3 flex items-center ${
                                  darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
                                }`}>
                                  <TrendingUp className="w-5 h-5 mr-2" />
                                  Key Changes
                                </h4>
                                <p className={`${textClasses} text-base leading-relaxed`}>{platform.data.keyChanges}</p>
                              </div>
                              
                              <div className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-green-500/20 hover:border-sdhq-green-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-green-50 to-white border-sdhq-green-200 hover:border-sdhq-green-400'
                              }`}>
                                <h4 className={`font-semibold mb-3 flex items-center ${
                                  darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'
                                }`}>
                                  <Video className="w-5 h-5 mr-2" />
                                  Editing Tips
                                </h4>
                                <p className={`${textClasses} text-base leading-relaxed`}>{platform.data.editingTips}</p>
                              </div>
                              
                              <div className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <h4 className={`font-semibold mb-3 flex items-center ${
                                  darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
                                }`}>
                                  <Globe className="w-5 h-5 mr-2" />
                                  Posting Tips
                                </h4>
                                <p className={`${textClasses} text-base leading-relaxed`}>{platform.data.postingTips}</p>
                              </div>
                              
                              <div className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-green-500/20 hover:border-sdhq-green-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-green-50 to-white border-sdhq-green-200 hover:border-sdhq-green-400'
                              }`}>
                                <h4 className={`font-semibold mb-3 flex items-center ${
                                  darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'
                                }`}>
                                  <Hash className="w-5 h-5 mr-2" />
                                  Title Tips
                                </h4>
                                <p className={`${textClasses} text-base leading-relaxed`}>{platform.data.titleTips}</p>
                              </div>
                              
                              <div className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <h4 className={`font-semibold mb-3 flex items-center ${
                                  darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
                                }`}>
                                  <Brain className="w-5 h-5 mr-2" />
                                  Description Tips
                                </h4>
                                <p className={`${textClasses} text-base leading-relaxed`}>{platform.data.descriptionTips}</p>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                              <div className="w-10 h-10 border-3 border-sdhq-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className={`${subtitleClasses} text-base`}>Loading algorithm data...</p>
                            </div>
                          )}
                          
                          <div className="pt-6 border-t border-gray-200 dark:border-sdhq-dark-700">
                            <Button
                              variant="outline"
                              size="lg"
                              onClick={() => setExpandedCard(null)}
                              className="w-full bg-gradient-to-r from-sdhq-cyan-500/10 to-sdhq-green-500/10 hover:from-sdhq-cyan-500/20 hover:to-sdhq-green-500/20 border-sdhq-cyan-500/50 hover:border-sdhq-cyan-500 transition-all duration-300"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <TabsContent value="tag-generator-free">
              <div className={`${cardClasses} p-6`}>
                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center space-x-4 mb-3">
                    <Hash className="w-10 h-10 text-sdhq-cyan-500" />
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.tagGeneratorFree}</h3>
                  </div>
                  <p className={`${textClasses} text-base text-center max-w-2xl`}>
                    Select a platform, describe your content, and generate optimized tags based on platform-specific algorithm insights.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Section */}
                  <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-300 shadow-md'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Content Details
                      </h4>
                      <div className={`text-base font-medium ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                        Uses: {tagRateLimit.remaining === -1 ? 'Unlimited' : tagRateLimit.remaining}
                      </div>
                    </div>
                    
                    {/* Platform Selection */}
                    <div className="mb-4">
                      <label className={`block text-base font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Select Platform
                      </label>
                      <select
                        value={tagPlatform}
                        onChange={(e) => setTagPlatform(e.target.value)}
                        className={`w-full px-3 py-2 rounded-md border ${
                          darkMode 
                            ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        {platforms.map((platform) => (
                          <option key={platform.id} value={platform.id}>
                            {platform.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Description Input */}
                    <div className="mb-4">
                      <label className={`block text-base font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Video/Clip Description
                      </label>
                      <textarea
                        value={tagDescription}
                        onChange={(e) => setTagDescription(e.target.value)}
                        placeholder="Describe your video or clip content... (e.g., 'Epic Fortnite victory royale with insane build battles')"
                        rows={4}
                        className={`w-full px-3 py-2 rounded-md border resize-none ${
                          darkMode 
                            ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>

                    {/* Tag Count */}
                    <div className="mb-4">
                      <label className={`block text-base font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Number of Tags: {tagCount}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        value={tagCount}
                        onChange={(e) => setTagCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-sdhq-cyan-500 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-sm mt-1 text-gray-500">
                        <span>5</span>
                        <span>30</span>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <Button
                      onClick={async () => {
                        if (!tagDescription.trim()) {
                          alert('Please enter a description of your content')
                          return
                        }
                        
                        setIsGeneratingTags(true)
                        try {
                          const res = await fetch('/api/tags', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              description: tagDescription,
                              platform: tagPlatform,
                              count: tagCount,
                              userId: user?.username,
                              isVerified: isVerified
                            })
                          })
                          
                          if (!res.ok) {
                            const errorData = await res.json()
                            if (res.status === 429) {
                              // Rate limit exceeded
                              setTagRateLimit({ remaining: 0, resetTime: errorData.resetTime })
                              const resetDate = new Date(errorData.resetTime)
                              const maxUses = isVerified ? 20 : 5
                              const diff = resetDate.getTime() - Date.now()
                              const hours = Math.floor(diff / (1000 * 60 * 60))
                              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                              const timeString = hours > 0 
                                ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`
                                : `${minutes} minute${minutes > 1 ? 's' : ''}`
                              alert(`Rate limit exceeded. You have used your ${maxUses} tag generations for the day.\n\nYou can generate more tags in ${timeString}.\n\nResets at: ${resetDate.toLocaleString()}`)
                            } else {
                              const errorMsg = errorData.details || errorData.error || `API error: ${res.status}`
                              throw new Error(errorMsg)
                            }
                            return
                          }
                          
                          const data = await res.json()
                          setGeneratedTags(prev => ({ ...prev, [tagPlatform]: data.tags }))
                          if (data.rateLimit) {
                            setTagRateLimit({ remaining: data.rateLimit.remaining, resetTime: data.rateLimit.resetTime })
                          }
                          // Log tag generation activity
                          if (user) {
                            const tagEntry: ActivityLogEntry = {
                              id: Date.now().toString(),
                              username: user.username,
                              timestamp: new Date().toISOString(),
                              action: 'tag_generation',
                              details: `Generated ${data.tags.length} tags for ${platforms.find(p => p.id === tagPlatform)?.name}`
                            }
                            setActivityLog(prev => [tagEntry, ...prev].slice(0, 100))
                            
                            // Log to backend
                            fetch('/api/activity-log', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                username: user.username,
                                action: 'tag_generation',
                                details: `Generated ${data.tags.length} tags for ${platforms.find(p => p.id === tagPlatform)?.name}`
                              })
                            }).catch(error => console.error('Failed to log to backend:', error))
                          }
                        } catch (error) {
                          console.error('Error generating tags:', error)
                          const errorMessage = (error as Error).message || 'Failed to generate tags. Please try again.'
                          alert(errorMessage)
                        } finally {
                          setIsGeneratingTags(false)
                        }
                      }}
                      disabled={isGeneratingTags || !tagDescription.trim() || tagRateLimit.remaining === 0}
                      className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                    >
                      {isGeneratingTags ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Tags...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Tags
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Results Section */}
                  <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-300 shadow-md'}`}>
                    <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Generated Tags for {platforms.find(p => p.id === tagPlatform)?.name}
                    </h4>
                    
                    {generatedTags[tagPlatform]?.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {generatedTags[tagPlatform].map((tag, index) => (
                            <span
                              key={index}
                              className={`px-3 py-1 rounded-full text-base font-medium ${
                                darkMode 
                                  ? 'bg-sdhq-cyan-500/20 text-sdhq-cyan-400 border border-sdhq-cyan-500/30' 
                                  : 'bg-sdhq-cyan-100 text-sdhq-cyan-700 border border-sdhq-cyan-200'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const tagsText = generatedTags[tagPlatform].map(t => `#${t}`).join(' ')
                            navigator.clipboard.writeText(tagsText)
                            alert('Tags copied to clipboard!')
                          }}
                          className="w-full"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy All Tags
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Hash className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className={`${subtitleClasses}`}>
                          No tags generated yet. Enter a description and click Generate Tags.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tag Database Status */}
                <div className={`mt-6 p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-700' : 'bg-gray-100 border-sdhq-cyan-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <p className={`text-base font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Tag Generator Status
                      </p>
                      <p className={`text-3xl font-bold text-green-500`}>
                        ACTIVE
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Powered by Groq API
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tag-generator-paid">
              <div className={`py-8 ${cardClasses}`}>
                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center space-x-4 mb-3">
                    <Hash className="w-10 h-10 text-sdhq-green-500" />
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.tagGeneratorPaid}</h3>
                  </div>
                  <p className={`${textClasses} text-base`}>{t.tagPaidDesc}</p>
                </div>
                <p className={`text-center ${subtitleClasses}`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="clip-analyzer">
              <div className={`py-8 ${cardClasses}`}>
                {/* Platform Logos */}
                <div className="flex justify-center gap-4 mb-6">
                  {platforms.map((platform) => (
                    <img
                      key={platform.id}
                      src={platform.image}
                      alt={platform.name}
                      className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center space-x-4 mb-3">
                    <Video className="w-10 h-10 text-sdhq-green-500" />
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.clipAnalyzer}</h3>
                  </div>
                  <p className={`${textClasses} text-base`}>{t.clipAnalyzerDesc}</p>
                </div>

                {/* Steps */}
                <div className={`max-w-2xl mx-auto mb-6 p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                  <h4 className={`text-base font-semibold mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>How to use:</h4>
                  <ol className={`space-y-2 text-base ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>1.</span>
                      <span>Select your target platform</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>2.</span>
                      <span>Upload your video file (MP4, WebM, MOV, AVI - max 100MB)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>3.</span>
                      <span>Click analyze and wait for AI analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>4.</span>
                      <span>Use the analysis to improve your clips</span>
                    </li>
                  </ol>
                </div>

                {/* Access Control */}
                {!user ? (
                  <div className="text-center py-12">
                    <p className={`${subtitleClasses}`}>{t.premiumFeature} - Login required</p>
                  </div>
                ) : !(userRole === 'owner' || userRole === 'admin' || userRole === 'subscriber' || userRole === 'subscriber_lifetime') ? (
                  <div className="space-y-6">
                    {/* Blurred out content for free tier */}
                    <div className={`${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-700' : 'bg-gray-100 border-gray-200'} border rounded-xl p-6 blur-sm select-none`}>
                      <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Target Platform
                      </label>
                      <div className="grid grid-cols-5 gap-3 mb-6">
                        {platforms.map((platform) => (
                          <div
                            key={platform.id}
                            className={`relative rounded-xl p-4 ${darkMode ? 'bg-sdhq-dark-900' : 'bg-white'}`}
                          >
                            <img
                              src={platform.image}
                              alt={platform.name}
                              className="w-12 h-12 mx-auto mb-2 rounded-lg object-cover opacity-50"
                            />
                            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {platform.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Video URL
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          disabled
                          placeholder="https://www.tiktok.com/@user/video/..."
                          className={`flex-1 px-4 py-3 rounded-lg text-base font-mono outline-none ${
                            darkMode 
                              ? 'bg-sdhq-dark-900 border-sdhq-dark-700 text-gray-300' 
                              : 'bg-white border-gray-300 text-gray-800'
                          } border`}
                        />
                        <Button disabled className="sdhq-button flex items-center gap-2 opacity-50">
                          <span>Analyze</span>
                          <span>→</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-center py-12">
                      <p className={`${subtitleClasses}`}>{t.premiumFeature} - Subscribe to access</p>
                      <Button onClick={handleVerifySubscription} className="sdhq-button mt-4">
                        Subscribe Now
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Rate Limit Display */}
                    <div className={`rounded-lg p-3 border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-700' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Database className={`w-4 h-4 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Uses</span>
                        </div>
                        <p className={`text-xl font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          {clipRateLimit.remaining === -1 ? '∞' : clipRateLimit.remaining}
                        </p>
                      </div>
                    </div>

                    {/* Input Section */}
                    <div className={`relative overflow-hidden rounded-2xl p-6 ${
                      darkMode 
                        ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                        : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                    }`}>
                      <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
                      <div className="relative">
                        <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          Target Platform
                        </label>
                        <select
                          value={clipPlatform}
                          onChange={(e) => setClipPlatform(e.target.value)}
                          disabled={isAnalyzingClip}
                          className={`w-full px-4 py-3 rounded-xl text-base outline-none transition-all duration-300 mb-4 ${
                            darkMode 
                              ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                              : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                          } border backdrop-blur-sm`}
                        >
                          {platforms.map((platform) => (
                            <option key={platform.id} value={platform.id}>
                              {platform.name}
                            </option>
                          ))}
                        </select>

                        <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          Video File
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              setClipFile(file)
                            }}
                            disabled={isAnalyzingClip}
                            className={`flex-1 px-4 py-3 rounded-xl text-base outline-none transition-all duration-300 ${
                              darkMode 
                                ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                                : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                            } border backdrop-blur-sm`}
                          />
                          <Button
                            onClick={handleAnalyzeClip}
                            disabled={isAnalyzingClip || !clipFile}
                            className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold px-6 rounded-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2"
                          >
                            <span>Analyze</span>
                            <span>→</span>
                          </Button>
                        </div>
                        {clipFile && (
                          <div className="mt-3 text-base">
                            <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Selected:</span>
                            <span className={`ml-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>{clipFile.name}</span>
                            <span className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>({(clipFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                          </div>
                        )}
                        {clipError && (
                          <div className={`mt-3 px-4 py-3 rounded-xl text-base animate-shake ${
                            darkMode ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-red-50 border-red-300 text-red-600'
                          } border`}>
                            {clipError}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loading State */}
                    {isAnalyzingClip && (
                      <div className={`relative overflow-hidden rounded-2xl p-12 text-center ${
                        darkMode 
                          ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                          : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                      }`}>
                        <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
                        <div className="relative">
                          <div className="relative w-16 h-16 mx-auto mb-6">
                            <div className="absolute inset-0 rounded-full border-4 border-sdhq-cyan-500/20"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sdhq-cyan-500 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Video className="w-6 h-6 text-sdhq-cyan-500" />
                            </div>
                          </div>
                          <p className={`font-mono text-sm uppercase tracking-widest mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                            Please wait while AI analyzes your clip
                          </p>
                          <p className={`text-base min-h-5 font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{loadingStep}</p>
                          <p className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                            DO NOT REFRESH until it has finished
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Results Section */}
                    {clipAnalysisResult && (
                      <div className="space-y-4">
                        {/* Score Card */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-4 flex items-center gap-4 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className={`absolute inset-0 bg-gradient-to-r ${
                              clipAnalysisResult.score >= 70 
                                ? 'from-green-500/10 to-sdhq-cyan-500/10' 
                                : clipAnalysisResult.score >= 45 
                                  ? 'from-yellow-500/10 to-orange-500/10' 
                                  : 'from-red-500/10 to-pink-500/10'
                            }`}></div>
                            <div className="relative">
                              <div className="relative w-16 h-16 flex-shrink-0">
                                <svg width="64" height="64" viewBox="0 0 96 96" className="transform -rotate-90">
                                  <circle cx="48" cy="48" r="40" fill="none" stroke={darkMode ? '#222230' : '#e5e7eb'} strokeWidth="8"/>
                                  <circle
                                    cx="48" cy="48" r="40" fill="none"
                                    stroke={
                                      clipAnalysisResult.score >= 70 ? '#4af7a0' :
                                      clipAnalysisResult.score >= 45 ? '#f7b733' : '#ff6b6b'
                                    }
                                    strokeWidth="8"
                                    strokeDasharray="251"
                                    strokeDashoffset={251 - (clipAnalysisResult.score / 100) * 251}
                                    strokeLinecap="round"
                                    className={`filter drop-shadow-[0_0_10px_${
                                      clipAnalysisResult.score >= 70 
                                        ? 'rgba(74,247,160,0.5)' 
                                        : clipAnalysisResult.score >= 45 
                                          ? 'rgba(247,183,51,0.5)' 
                                          : 'rgba(255,107,107,0.5)'
                                    }]`}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                                  <span className={`text-2xl font-bold ${
                                    clipAnalysisResult.score >= 70 ? 'text-green-400' :
                                    clipAnalysisResult.score >= 45 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {clipAnalysisResult.score}
                                  </span>
                                  <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/100</span>
                                </div>
                              </div>
                            </div>
                            <div className="relative flex-1">
                              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {clipAnalysisResult.scoreTitle || 'Discoverability Score'}
                              </h3>
                              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {clipAnalysisResult.scoreSummary || ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actual Pulled Metadata - Under Score */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Video Metadata
                              </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {/* Pulled Title */}
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📝</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Title
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {clipAnalysisResult.extractedData?.title || clipAnalysisResult.extractedData?.summary || '—'}
                                  </div>
                                </div>
                              </div>
                              {/* Pulled Description */}
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📄</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Description
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {clipAnalysisResult.extractedData?.summary || clipAnalysisResult.extractedData?.description || '—'}
                                  </div>
                                </div>
                              </div>
                              {/* Pulled Tags */}
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">#️⃣</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Extracted Tags
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {clipAnalysisResult.extractedData?.tags && clipAnalysisResult.extractedData.tags.length > 0 ? (
                                      clipAnalysisResult.extractedData.tags.map((tag: string, idx: number) => (
                                        <span key={idx} className={`px-2 py-1 rounded text-[10px] font-mono ${
                                          darkMode 
                                            ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20' 
                                            : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300'
                                        }`}>
                                          #{tag.replace(/^#/, '')}
                                        </span>
                                      ))
                                    ) : clipAnalysisResult.extractedData?.topics ? (
                                      clipAnalysisResult.extractedData.topics.map((topic: string, idx: number) => (
                                        <span key={idx} className={`px-2 py-1 rounded text-[10px] font-mono ${
                                          darkMode 
                                            ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20' 
                                            : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300'
                                        }`}>
                                          #{topic}
                                        </span>
                                      ))
                                    ) : (
                                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>—</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Content Insights - Tall Cards */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Content Insights
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((clipAnalysisResult.score || 0) * 0.25)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {(clipAnalysisResult.insights || []).map((insight: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                  darkMode 
                                    ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                    : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                                }`}>
                                  <div className="flex flex-col items-center text-center">
                                    <span className="text-3xl mb-2">{insight.icon || '📊'}</span>
                                    <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                      {insight.label}
                                    </div>
                                    <div className={`text-base font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {insight.value}
                                    </div>
                                    {insight.description && (
                                      <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {insight.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Recommendations - Tall Cards */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Algorithm Recommendations
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((clipAnalysisResult.score || 0) * 0.2)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {(clipAnalysisResult.recommendations || []).map((rec: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                  darkMode 
                                    ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                    : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                                }`}>
                                  <div className="flex flex-col items-center text-center">
                                    <div className={`w-2 h-2 rounded-full mb-3 ${
                                      rec.priority === 'high' ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]' :
                                      rec.priority === 'med' ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                                    }`}></div>
                                    <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                      {rec.category}
                                    </div>
                                    <div className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {rec.text}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Overlays - Tall Cards */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Overlay & Edit Suggestions
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((clipAnalysisResult.score || 0) * 0.15)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {(clipAnalysisResult.overlays || []).map((overlay: any, idx: number) => {
                                const iconMap: Record<string, string> = {
                                  text: '✏️',
                                  sound: '🎵',
                                  visual: '🎬',
                                  cta: '👆'
                                }
                                return (
                                  <div key={idx} className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                    darkMode 
                                      ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                      : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                                  }`}>
                                    <div className="flex flex-col items-center text-center">
                                      <div className="text-3xl mb-2">
                                        {iconMap[overlay.type] || '✨'}
                                      </div>
                                      <div className={`text-base mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {overlay.description}
                                      </div>
                                      <div className={`text-sm font-mono ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                        {overlay.timing}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Metadata Optimization - Recommended */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Recommended Metadata
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((clipAnalysisResult.score || 0) * 0.2)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📝</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Title Options
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {(clipAnalysisResult.titles || [clipAnalysisResult.title]).map((title: string, idx: number) => (
                                      <div key={idx} className="mb-1 last:mb-0">
                                        {idx + 1}. {title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📄</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Description
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {clipAnalysisResult.description || '—'}
                                  </div>
                                </div>
                              </div>
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">#️⃣</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Recommended Tags
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {(clipAnalysisResult.tags || []).map((tag: string, idx: number) => (
                                      <span key={idx} className={`px-2 py-1 rounded text-[10px] font-mono ${
                                        darkMode 
                                          ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20' 
                                          : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300'
                                      }`}>
                                        #{tag.replace(/^#/, '')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Re-analysis Section */}
                        {showReanalysis && (
                          <div className={`relative overflow-hidden rounded-2xl p-6 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
                            <div className="relative">
                              <h4 className={`text-sm font-semibold tracking-wider uppercase mb-4 flex items-center gap-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Analyze for Different Platform
                                <span className="flex-1 h-px bg-gradient-to-r from-sdhq-cyan-500/50 to-transparent"></span>
                              </h4>
                              <p className={`text-base mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Currently optimized for: <span className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>{platforms.find(p => p.id === clipPlatform)?.name}</span>
                              </p>
                              <div className="flex gap-3">
                                <select
                                  onChange={(e) => e.target.value && handleReanalyzeClip(e.target.value)}
                                  disabled={isAnalyzingClip}
                                  className={`flex-1 px-4 py-3 rounded-xl text-base outline-none transition-all duration-300 ${
                                    darkMode 
                                      ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                                      : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                                  } border backdrop-blur-sm`}
                                >
                                  <option value="">Select a platform to re-analyze...</option>
                                  {platforms.filter(p => p.id !== clipPlatform).map((platform) => (
                                    <option key={platform.id} value={platform.id}>
                                      {platform.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Reset Button */}
                        <button
                          onClick={handleResetClip}
                          className={`w-full py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                            darkMode 
                              ? 'border-sdhq-cyan-500/30 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/10 hover:border-sdhq-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]' 
                              : 'border-sdhq-cyan-300 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50 hover:border-sdhq-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                          } border bg-transparent`}
                        >
                          ← Analyze another clip
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="content-analyzer">
              <div className={`py-8 ${cardClasses}`}>
                {/* Platform Logos */}
                <div className="flex justify-center gap-4 mb-6">
                  {platforms.map((platform) => (
                    <img
                      key={platform.id}
                      src={platform.image}
                      alt={platform.name}
                      className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center space-x-4 mb-3">
                    <Brain className="w-10 h-10 text-sdhq-green-500" />
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.contentAnalyzer}</h3>
                  </div>
                  <p className={`${textClasses} text-base`}>{t.contentAnalyzerDesc}</p>
                </div>

                {/* Steps */}
                <div className={`max-w-2xl mx-auto mb-6 p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                  <h4 className={`text-base font-semibold mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>How to use:</h4>
                  <ol className={`space-y-2 text-base ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>1.</span>
                      <span>Enter your content URL</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>2.</span>
                      <span>Click analyze and wait for AI analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>3.</span>
                      <span>Use the analysis to improve your content</span>
                    </li>
                  </ol>
                </div>

                {/* Access Control */}
                {!user ? (
                  <div className="text-center py-12">
                    <p className={`${subtitleClasses}`}>{t.premiumFeature} - Login required</p>
                  </div>
                ) : !(userRole === 'owner' || userRole === 'admin' || userRole === 'subscriber' || userRole === 'subscriber_lifetime') ? (
                  <div className="space-y-6">
                    {/* Blurred out content for free tier */}
                    <div className={`${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-700' : 'bg-gray-100 border-gray-200'} border rounded-xl p-6 blur-sm select-none`}>
                      <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Target Platform
                      </label>
                      <div className="grid grid-cols-5 gap-3 mb-6">
                        {platforms.map((platform) => (
                          <div
                            key={platform.id}
                            className={`relative rounded-xl p-4 ${darkMode ? 'bg-sdhq-dark-900' : 'bg-white'}`}
                          >
                            <img
                              src={platform.image}
                              alt={platform.name}
                              className="w-12 h-12 mx-auto mb-2 rounded-lg object-cover opacity-50"
                            />
                            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {platform.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Content URL
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          disabled
                          placeholder="https://www.tiktok.com/@user/video/..."
                          className={`flex-1 px-4 py-3 rounded-lg text-base font-mono outline-none ${
                            darkMode 
                              ? 'bg-sdhq-dark-900 border-sdhq-dark-700 text-gray-300' 
                              : 'bg-white border-gray-300 text-gray-800'
                          } border`}
                        />
                        <Button disabled className="sdhq-button flex items-center gap-2 opacity-50">
                          <span>Analyze</span>
                          <span>→</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-center py-12">
                      <p className={`${subtitleClasses}`}>{t.premiumFeature} - Subscribe to access</p>
                      <Button onClick={handleVerifySubscription} className="sdhq-button mt-4">
                        Subscribe Now
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Rate Limit Display */}
                    <div className={`rounded-lg p-3 border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-700' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Database className={`w-4 h-4 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Uses</span>
                        </div>
                        <p className={`text-xl font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          {contentRateLimit.remaining === -1 ? '∞' : contentRateLimit.remaining}
                        </p>
                      </div>
                    </div>

                    {/* Input Section */}
                    <div className={`relative overflow-hidden rounded-2xl p-6 ${
                      darkMode 
                        ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                        : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                    }`}>
                      <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
                      <div className="relative">
                        <label className={`block text-sm font-semibold tracking-wider uppercase mb-3 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                          Content URL
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={contentUrl}
                            onChange={(e) => setContentUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeContent()}
                            placeholder="https://www.tiktok.com/@user/video/..."
                            className={`flex-1 px-4 py-3 rounded-xl text-base font-mono outline-none transition-all duration-300 ${
                              darkMode 
                                ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 placeholder-gray-600 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                                : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 placeholder-gray-400 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                            } border backdrop-blur-sm`}
                          />
                          <Button
                            onClick={handleAnalyzeContent}
                            disabled={isAnalyzingContent || !contentUrl}
                            className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold px-6 rounded-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2"
                          >
                            <span>Analyze</span>
                            <span>→</span>
                          </Button>
                        </div>
                        {contentUrl && (
                          <div className="mt-3 text-base">
                            <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>URL:</span>
                            <span className={`ml-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>{contentUrl}</span>
                          </div>
                        )}
                        {contentError && (
                          <div className={`mt-3 px-4 py-3 rounded-xl text-base animate-shake ${
                            darkMode ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-red-50 border-red-300 text-red-600'
                          } border`}>
                            {contentError}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loading State */}
                    {isAnalyzingContent && (
                      <div className={`relative overflow-hidden rounded-2xl p-12 text-center ${
                        darkMode 
                          ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                          : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                      }`}>
                        <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
                        <div className="relative">
                          <div className="relative w-16 h-16 mx-auto mb-6">
                            <div className="absolute inset-0 rounded-full border-4 border-sdhq-cyan-500/20"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sdhq-cyan-500 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Brain className="w-6 h-6 text-sdhq-cyan-500" />
                            </div>
                          </div>
                          <p className={`font-mono text-sm uppercase tracking-widest mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                            Please wait while AI analyzes your content
                          </p>
                          <p className={`text-base min-h-5 font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{contentLoadingStep}</p>
                          <p className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                            DO NOT REFRESH until it has finished
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Results Section */}
                    {contentAnalysisResult && (
                      <div className="space-y-4">
                        {/* Score Card */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-4 flex items-center gap-4 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className={`absolute inset-0 bg-gradient-to-r ${
                              contentAnalysisResult.score >= 70 
                                ? 'from-green-500/10 to-sdhq-cyan-500/10' 
                                : contentAnalysisResult.score >= 45 
                                  ? 'from-yellow-500/10 to-orange-500/10' 
                                  : 'from-red-500/10 to-pink-500/10'
                            }`}></div>
                            <div className="relative">
                              <div className="relative w-16 h-16 flex-shrink-0">
                                <svg width="64" height="64" viewBox="0 0 96 96" className="transform -rotate-90">
                                  <circle cx="48" cy="48" r="40" fill="none" stroke={darkMode ? '#222230' : '#e5e7eb'} strokeWidth="8"/>
                                  <circle
                                    cx="48" cy="48" r="40" fill="none"
                                    stroke={
                                      contentAnalysisResult.score >= 70 ? '#4af7a0' :
                                      contentAnalysisResult.score >= 45 ? '#f7b733' : '#ff6b6b'
                                    }
                                    strokeWidth="8"
                                    strokeDasharray="251"
                                    strokeDashoffset={251 - (contentAnalysisResult.score / 100) * 251}
                                    strokeLinecap="round"
                                    className={`filter drop-shadow-[0_0_10px_${
                                      contentAnalysisResult.score >= 70 
                                        ? 'rgba(74,247,160,0.5)' 
                                        : contentAnalysisResult.score >= 45 
                                          ? 'rgba(247,183,51,0.5)' 
                                          : 'rgba(255,107,107,0.5)'
                                    }]`}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                                  <span className={`text-2xl font-bold ${
                                    contentAnalysisResult.score >= 70 ? 'text-green-400' :
                                    contentAnalysisResult.score >= 45 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {contentAnalysisResult.score}
                                  </span>
                                  <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/100</span>
                                </div>
                              </div>
                            </div>
                            <div className="relative flex-1">
                              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {contentAnalysisResult.scoreTitle || 'Discoverability Score'}
                              </h3>
                              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {contentAnalysisResult.scoreSummary || ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actual Pulled Metadata - Under Score */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Content Metadata
                              </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {/* Pulled Title */}
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📝</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Title
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {contentAnalysisResult.extractedData?.title || contentAnalysisResult.extractedData?.summary || '—'}
                                  </div>
                                </div>
                              </div>
                              {/* Pulled Description */}
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📄</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Description
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {contentAnalysisResult.extractedData?.summary || contentAnalysisResult.extractedData?.description || '—'}
                                  </div>
                                </div>
                              </div>
                              {/* Pulled Tags */}
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">#️⃣</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Extracted Tags
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {contentAnalysisResult.extractedData?.tags && contentAnalysisResult.extractedData.tags.length > 0 ? (
                                      contentAnalysisResult.extractedData.tags.map((tag: string, idx: number) => (
                                        <span key={idx} className={`px-2 py-1 rounded text-[10px] font-mono ${
                                          darkMode 
                                            ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20' 
                                            : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300'
                                        }`}>
                                          #{tag.replace(/^#/, '')}
                                        </span>
                                      ))
                                    ) : contentAnalysisResult.extractedData?.topics ? (
                                      contentAnalysisResult.extractedData.topics.map((topic: string, idx: number) => (
                                        <span key={idx} className={`px-2 py-1 rounded text-[10px] font-mono ${
                                          darkMode 
                                            ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20' 
                                            : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300'
                                        }`}>
                                          #{topic}
                                        </span>
                                      ))
                                    ) : (
                                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>—</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Content Insights - Tall Cards */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Content Insights
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((contentAnalysisResult.score || 0) * 0.25)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {(contentAnalysisResult.insights || []).map((insight: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                  darkMode 
                                    ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                    : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                                }`}>
                                  <div className="flex flex-col items-center text-center">
                                    <span className="text-3xl mb-2">{insight.icon || '📊'}</span>
                                    <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                      {insight.label}
                                    </div>
                                    <div className={`text-base font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {insight.value}
                                    </div>
                                    {insight.description && (
                                      <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {insight.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Recommendations - Tall Cards */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Algorithm Recommendations
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((contentAnalysisResult.score || 0) * 0.2)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {(contentAnalysisResult.recommendations || []).map((rec: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                  darkMode 
                                    ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                    : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                                }`}>
                                  <div className="flex flex-col items-center text-center">
                                    <div className={`w-2 h-2 rounded-full mb-3 ${
                                      rec.priority === 'high' ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]' :
                                      rec.priority === 'med' ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                                    }`}></div>
                                    <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                      {rec.category}
                                    </div>
                                    <div className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {rec.text}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Overlays - Tall Cards */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Overlay & Edit Suggestions
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((contentAnalysisResult.score || 0) * 0.15)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              {(contentAnalysisResult.overlays || []).map((overlay: any, idx: number) => {
                                const iconMap: Record<string, string> = {
                                  text: '✏️',
                                  sound: '🎵',
                                  visual: '🎬',
                                  cta: '👆'
                                }
                                return (
                                  <div key={idx} className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                    darkMode 
                                      ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                      : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                                  }`}>
                                    <div className="flex flex-col items-center text-center">
                                      <div className="text-3xl mb-2">
                                        {iconMap[overlay.type] || '✨'}
                                      </div>
                                      <div className={`text-base mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {overlay.description}
                                      </div>
                                      <div className={`text-sm font-mono ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                        {overlay.timing}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Metadata Optimization - Recommended */}
                        <div>
                          <div className={`relative overflow-hidden rounded-xl p-3 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className={`text-[10px] font-semibold tracking-wider uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Recommended Metadata
                              </h4>
                              <div className={`text-lg font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                {Math.round((contentAnalysisResult.score || 0) * 0.2)}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 justify-center">
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📝</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Title Options
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {(contentAnalysisResult.titles || [contentAnalysisResult.title]).map((title: string, idx: number) => (
                                      <div key={idx} className="mb-1 last:mb-0">
                                        {idx + 1}. {title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">📄</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Description
                                  </div>
                                  <div className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {contentAnalysisResult.description || '—'}
                                  </div>
                                </div>
                              </div>
                              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                darkMode 
                                  ? 'bg-sdhq-dark-700/50 border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' 
                                  : 'bg-gradient-to-br from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
                              }`}>
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-3xl mb-2">#️⃣</span>
                                  <div className={`text-sm font-semibold uppercase mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                    Recommended Tags
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {(contentAnalysisResult.tags || []).map((tag: string, idx: number) => (
                                      <span key={idx} className={`px-2 py-1 rounded text-[10px] font-mono ${
                                        darkMode 
                                          ? 'bg-sdhq-dark-800 text-sdhq-cyan-400 border border-sdhq-cyan-500/20' 
                                          : 'bg-gray-100 text-sdhq-cyan-600 border border-sdhq-cyan-300'
                                      }`}>
                                        #{tag.replace(/^#/, '')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Re-analysis Section */}
                        {showContentReanalysis && (
                          <div className={`relative overflow-hidden rounded-2xl p-6 ${
                            darkMode 
                              ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/20' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-sdhq-cyan-200'
                          }`}>
                            <div className={`absolute inset-0 bg-gradient-to-r from-sdhq-cyan-500/5 to-sdhq-green-500/5 animate-pulse`}></div>
                            <div className="relative">
                              <h4 className={`text-sm font-semibold tracking-wider uppercase mb-4 flex items-center gap-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                                Analyze for Different Platform
                                <span className="flex-1 h-px bg-gradient-to-r from-sdhq-cyan-500/50 to-transparent"></span>
                              </h4>
                              <p className={`text-base mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Currently optimized for: <span className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>{platforms.find(p => p.id === contentPlatform)?.name}</span>
                              </p>
                              <div className="flex gap-3">
                                <select
                                  onChange={(e) => e.target.value && handleReanalyzeContent(e.target.value)}
                                  disabled={isAnalyzingContent}
                                  className={`flex-1 px-4 py-3 rounded-xl text-base outline-none transition-all duration-300 ${
                                    darkMode 
                                      ? 'bg-sdhq-dark-900/80 border-sdhq-cyan-500/30 text-gray-300 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                                      : 'bg-white/80 border-sdhq-cyan-300 text-gray-800 focus:border-sdhq-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                                  } border backdrop-blur-sm`}
                                >
                                  <option value="">Select a platform to re-analyze...</option>
                                  {platforms.filter(p => p.id !== contentPlatform).map((platform) => (
                                    <option key={platform.id} value={platform.id}>
                                      {platform.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Reset Button */}
                        <button
                          onClick={handleResetContent}
                          className={`w-full py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                            darkMode 
                              ? 'border-sdhq-cyan-500/30 text-sdhq-cyan-400 hover:bg-sdhq-cyan-500/10 hover:border-sdhq-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]' 
                              : 'border-sdhq-cyan-300 text-sdhq-cyan-600 hover:bg-sdhq-cyan-50 hover:border-sdhq-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                          } border bg-transparent`}
                        >
                          ← Analyze another content
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className={`py-8 ${cardClasses}`}>
                <div className="flex flex-col items-center mb-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <Settings className="w-8 h-8 text-sdhq-cyan-500" />
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.settings}</h3>
                  </div>
                </div>
                
                <div className="max-w-2xl mx-auto space-y-6 px-6">
                  {/* Language Setting */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200 shadow-sm'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Globe className="w-5 h-5 text-sdhq-cyan-500" />
                        <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.language}</span>
                      </div>
                      <select 
                        value={language}
                        onChange={(e) => handleLanguageChange(e.target.value as Language)}
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
                        <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{darkMode ? t.darkMode : t.lightMode}</span>
                      </div>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
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
                          onClick={handleLifetimeSubscription}
                          className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                        >
                          <Crown className="w-4 h-4 mr-1" />
                          Get Lifetime Pass
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Activity Feed - Admin and Owner only */}
                  {(userRole === 'admin' || userRole === 'owner') && (
                    <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`font-semibold flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          <TrendingUp className="w-5 h-5 mr-2 text-sdhq-green-500" />
                          Activity Feed
                        </h4>
                        <div className="flex gap-2">
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
                              onClick={() => setShowClearConfirm(true)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                      
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
                                      {entry.action.replace('_', ' ')}
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
                      <h4 className={`font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                        Role Management (New System)
                      </h4>
                      
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
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                          <Button 
                            onClick={() => roleSearchUsername && handleUpdateRole(roleSearchUsername, selectedRole)}
                            disabled={!roleSearchUsername}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Assign
                          </Button>
                        </div>
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
                              </div>
                              <div className="flex items-center space-x-2">
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateRole(u.username, e.target.value as Role)}
                                  className={`px-2 py-1 rounded text-sm border ${
                                    darkMode 
                                      ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                >
                                  <option value="free">Free</option>
                                  <option value="subscriber">Subscriber</option>
                                  <option value="subscriber_lifetime">Lifetime</option>
                                  <option value="admin">Admin</option>
                                  <option value="owner" disabled={userRole !== 'owner'}>Owner</option>
                                </select>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteUser(u.username)}
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


                  {/* Admin Tools - Bulletbait604 Only */}
                  {isAdmin && user?.username.toLowerCase() === 'bulletbait604' && (
                    <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                      <h4 className={`font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <Settings className="w-5 h-5 mr-2 text-sdhq-cyan-500" />
                        Admin Tools
                      </h4>
                      
                      <div className="space-y-4">
                        {/* Refresh Algorithms Button */}
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!user || !isAdmin) return
                              
                              setIsLoadingAlgorithms(true)
                              
                              try {
                                const res = await fetch('/api/algorithms', { 
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({})
                                })
                                if (!res.ok) throw new Error(`API error: ${res.status}`)
                                
                                const data = await res.json()
                                if (data.data) {
                                  localStorage.setItem('sdhq-algorithm-data', JSON.stringify(data.data))
                                  localStorage.setItem('sdhq-algorithm-updated', data.lastUpdated)
                                  setLastUpdated(data.lastUpdated)
                                  setPlatforms(prevPlatforms => prevPlatforms.map(p => ({
                                    ...p,
                                    data: data.data[p.id] || null
                                  })))
                                  
                                  // Log the manual refresh
                                  const refreshEntry: ActivityLogEntry = {
                                    id: Date.now().toString(),
                                    username: user.username,
                                    timestamp: new Date().toISOString(),
                                    action: 'algorithm_refresh',
                                    details: `Manual algorithm refresh${data.provider ? ` via ${data.provider}` : ''}`
                                  }
                                  setActivityLog(prev => [refreshEntry, ...prev].slice(0, 100))
                                  
                                  alert('Algorithms refreshed successfully!')
                                }
                              } catch (error) {
                                console.error('Error refreshing algorithms:', error)
                                alert('Failed to refresh algorithms. Please try again.')
                              } finally {
                                setIsLoadingAlgorithms(false)
                              }
                            }}
                            disabled={isLoadingAlgorithms}
                            className="w-full"
                          >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            {isLoadingAlgorithms ? 'Refreshing All...' : 'Refresh All Algorithms'}
                          </Button>
                        </div>

                        {/* Individual Platform Refresh Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {platforms.map((platform) => (
                            <Button
                              key={platform.id}
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (!user || !isAdmin) return
                                
                                setIsLoadingAlgorithms(true)
                                
                                try {
                                  const res = await fetch('/api/algorithms', { 
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ platformId: platform.id })
                                  })
                                  if (!res.ok) throw new Error(`API error: ${res.status}`)
                                  
                                  const data = await res.json()
                                  if (data.data) {
                                    localStorage.setItem('sdhq-algorithm-data', JSON.stringify(data.data))
                                    localStorage.setItem('sdhq-algorithm-updated', data.lastUpdated)
                                    setLastUpdated(data.lastUpdated)
                                    setPlatforms(prevPlatforms => prevPlatforms.map(p => ({
                                      ...p,
                                      data: data.data[p.id] || null
                                    })))
                                    
                                    // Log the manual refresh
                                    const refreshEntry: ActivityLogEntry = {
                                      id: Date.now().toString(),
                                      username: user.username,
                                      timestamp: new Date().toISOString(),
                                      action: 'algorithm_refresh',
                                      details: `Manual ${platform.name} algorithm refresh${data.provider ? ` via ${data.provider}` : ''}`
                                    }
                                    setActivityLog(prev => [refreshEntry, ...prev].slice(0, 100))
                                    
                                    alert(`${platform.name} algorithm refreshed successfully!`)
                                  }
                                } catch (error) {
                                  console.error(`Error refreshing ${platform.name}:`, error)
                                  alert(`Failed to refresh ${platform.name}. Please try again.`)
                                } finally {
                                  setIsLoadingAlgorithms(false)
                                }
                              }}
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
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t ${darkMode ? 'border-sdhq-dark-700 bg-sdhq-dark-800' : 'border-sdhq-cyan-200 bg-white/80'} mt-8`}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <p className={`text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {t.footerCopyright}
              </p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {t.footerTagline}
              </p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Support: Bulletbait604@gmail.com
              </p>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={() => setShowPrivacyPolicy(true)}
                className={`text-base hover:underline ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
              >
                {t.privacyPolicy}
              </button>
              <button 
                onClick={() => setShowTerms(true)}
                className={`text-base hover:underline ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
              >
                {t.termsOfService}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-md w-full p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.settings}</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.language}</span>
                  <select 
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value as Language)}
                    className={`px-3 py-1 rounded border ${
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
              
              <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {darkMode ? t.darkMode : t.lightMode}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleDarkMode}
                    className={darkMode ? 'border-sdhq-dark-600 text-white' : 'border-gray-300 text-gray-900'}
                  >
                    {darkMode ? <Sun className="w-4 h-4 mr-1" /> : <Moon className="w-4 h-4 mr-1" />}
                    {darkMode ? t.lightMode : t.darkMode}
                  </Button>
                </div>
              </div>
              
              {!isOwner && !isAdmin && !isSubscribed && !isLifetimeMember && (
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
                  <h4 className={`font-semibold mb-3 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Crown className="w-4 h-4 mr-2 text-sdhq-cyan-500" />
                    Lifetime Pass
                  </h4>
                  <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Get lifetime access to all premium features for a one-time payment of $54.99 CAD.
                  </p>
                  <Button
                    onClick={handleLifetimeSubscription}
                    className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Get Lifetime Pass
                  </Button>
                </div>
              )}
              
              {isAdmin && (
                <>
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
                    <h4 className={`font-semibold mb-3 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <Hash className="w-4 h-4 mr-2 text-sdhq-cyan-500" />
                      Tag Generator
                    </h4>
                    <Button
                      onClick={handleResetTagUsages}
                      className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset Tag Usages
                    </Button>
                    <p className={`text-base mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Reset all user tag generator usages (Free: 5/day, Subscribers: 25/day)
                    </p>
                  </div>

                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.privacyPolicy}</h3>
              <button 
                onClick={() => setShowPrivacyPolicy(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`space-y-4 text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>1. Information We Collect</h4>
                <p>We collect information you provide directly to us when you create an account, including your Kick username, profile picture, and email address. We also collect usage data related to your content analysis activities.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>2. How We Use Your Information</h4>
                <p>We use your information to provide AI-powered content analysis services, improve our algorithms, and personalize your experience. Your content data is processed to generate optimization recommendations.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>3. Data Security</h4>
                <p>We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>4. Third-Party Services</h4>
                <p>We use Kick OAuth for authentication. Your use of Kick is subject to Kick&apos;s Privacy Policy and Terms of Service.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>5. Your Rights</h4>
                <p>You can access, update, or delete your account information at any time by contacting us or through your account settings.</p>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.termsOfService}</h3>
              <button 
                onClick={() => setShowTerms(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`space-y-4 text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>1. Acceptance of Terms</h4>
                <p>By accessing and using SDHQ Creator Corner, you agree to be bound by these Terms of Service. If you do not agree, please do not use our service.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>2. Description of Service</h4>
                <p>SDHQ Creator Corner provides AI-powered content analysis tools that help creators optimize their content for various platforms. Our services include algorithm insights, tag generation, clip analysis, and content optimization recommendations.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>3. User Accounts</h4>
                <p>You must authenticate through Kick to use our service. You are responsible for maintaining the security of your account and for all activities that occur under your account.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>4. Subscription and Payments</h4>
                <p>Some features require a valid subscription. Free features are available to all users. Premium features require an active subscription or admin privileges.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>5. Content Analysis</h4>
                <p>By using our analysis tools, you grant us permission to process your content data to generate recommendations. We do not store your original content files.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>6. Limitation of Liability</h4>
                <p>Our recommendations are AI-generated suggestions and do not guarantee specific results. You are solely responsible for the content you create and publish.</p>
              </section>
              
              <section>
                <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>7. Termination</h4>
                <p>We reserve the right to terminate or suspend your account at any time for violations of these terms or for any other reason at our discretion.</p>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe Popup */}
      {showSubscribePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-md w-full p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Unlock Premium Features</h3>
              <button 
                onClick={() => setShowSubscribePopup(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Subscribe to unlock all premium features for $6.99 CAD/month.
              </p>
              
              <div className={`p-4 rounded-lg border ${darkMode ? 'border-sdhq-cyan-500 bg-sdhq-dark-700' : 'border-sdhq-cyan-500 bg-gray-50'}`}>
                <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>PayPal Subscription:</p>
                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  $6.99 CAD / month - Premium Access
                </p>
              </div>
              
              <div id="paypal-button-container" className="w-full"></div>
              
              <Button
                variant="outline"
                onClick={() => setShowSubscribePopup(false)}
                className={`w-full ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lifetime Membership Popup */}
      {showLifetimePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-md w-full p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Lifetime Membership</h3>
              <button 
                onClick={() => setShowLifetimePopup(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Get lifetime access to all current and upcoming features for a one-time payment of $54.99 CAD.
              </p>
              
              <div className={`p-4 rounded-lg border ${darkMode ? 'border-sdhq-cyan-500 bg-sdhq-dark-700' : 'border-sdhq-cyan-500 bg-gray-50'}`}>
                <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>PayPal One-Time Payment:</p>
                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  $54.99 CAD - Lifetime Access
                </p>
              </div>
              
              <div id="paypal-lifetime-button-container" className="w-full"></div>
              
              <Button
                variant="outline"
                onClick={() => setShowLifetimePopup(false)}
                className={`w-full ${darkMode ? 'border-sdhq-dark-600 text-white' : ''}`}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Activity Log Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-sm w-full p-6 shadow-2xl`}>
            <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Clear Activity Log?</h3>
            <p className={`text-base mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to clear all activity log entries? This action cannot be undone.
            </p>
            <div className="flex space-x-2">
              <Button
                variant="destructive"
                onClick={handleClearActivityLog}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Yes, Clear
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(false)}
                className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Please Wait - Verification Loading Modal */}
      {isVerifying && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-sm w-full p-8 shadow-2xl text-center`}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sdhq-cyan-500 mx-auto mb-4"></div>
            <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Please Wait...</h3>
            <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Verifying your payment and activating your account. This may take a few moments.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

