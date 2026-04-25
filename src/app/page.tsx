'use client'

import { useState, useEffect } from 'react'

// TypeScript declaration for PayPal
declare global {
  interface Window {
    paypal?: any
  }
}
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

interface ActivityLogEntry {
  id: string
  username: string
  timestamp: string
  action: 'login' | 'logout' | 'payment_success' | 'payment_failed' | 'verification_attempt' | 'access_expired' | 'algorithm_refresh'
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
    clipAnalyzer: 'Clip Analyzer (Paid)',
    contentAnalyzer: 'Content Analyzer (Paid)',
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
    clipAnalyzer: 'Analizador de Clips (Pago)',
    contentAnalyzer: 'Analizador de Contenido (Pago)',
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
    clipAnalyzer: 'Analyseur de Clips (Payant)',
    contentAnalyzer: 'Analyseur de Contenu (Payant)',
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
    clipAnalyzer: 'Clip Analyzer (Bezahlt)',
    contentAnalyzer: 'Content Analyzer (Bezahlt)',
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

const ADMIN_USERNAMES = ['bulletbait604', 'Bulletbait604'];

export default function HomePage() {
  const [user, setUser] = useState<KickUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('algorithms-explained')
  const [language, setLanguage] = useState<Language>('en')
  const [darkMode, setDarkMode] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [newSubscriberUsername, setNewSubscriberUsername] = useState('')
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [showSubscribePopup, setShowSubscribePopup] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  // Payment states
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')
  
  // Verification states
  const [isVerified, setIsVerified] = useState<boolean>(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
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
  const [isRefreshingTags, setIsRefreshingTags] = useState<boolean>(false)
  const [tagRefreshProgress, setTagRefreshProgress] = useState<number>(0)
  const [algorithmRefreshProgress, setAlgorithmRefreshProgress] = useState<number>(0)
  const [isRefreshingHashy, setIsRefreshingHashy] = useState<boolean>(false)
  const [hashyRefreshStatus, setHashyRefreshStatus] = useState<string | null>(null)
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
  const isAdmin = user ? ADMIN_USERNAMES.includes(user.username) : false
  const isSubscribed = user ? (isVerified || subscribers.some(sub => sub.username.toLowerCase() === user.username.toLowerCase())) : false

  useEffect(() => {
    setMounted(true)
    
    // Check for existing user session
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('kickUser')
      const storedLanguage = localStorage.getItem('sdhq-language') as Language
      const storedDarkMode = localStorage.getItem('sdhq-darkmode')
      const storedSubscribers = localStorage.getItem('sdhq-subscribers')
      const storedActivityLog = localStorage.getItem('sdhq-activity-log')
      const storedVerified = localStorage.getItem('isVerified')
      
      if (storedVerified) {
        setIsVerified(storedVerified === 'true')
      }
      
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)
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
      
      if (storedSubscribers) {
        try {
          setSubscribers(JSON.parse(storedSubscribers))
        } catch (error) {
          console.error('Error loading subscribers:', error)
        }
      }
      
      if (storedActivityLog) {
        try {
          setActivityLog(JSON.parse(storedActivityLog))
        } catch (error) {
          console.error('Error loading activity log:', error)
        }
      }

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
      localStorage.setItem('sdhq-darkmode', darkMode.toString())
    }
  }, [language, darkMode])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-subscribers', JSON.stringify(subscribers))
    }
  }, [subscribers])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sdhq-activity-log', JSON.stringify(activityLog))
    }
  }, [activityLog])

  // Track user login
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      const newEntry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'login'
      }
      setActivityLog(prev => [newEntry, ...prev].slice(0, 100)) // Keep last 100 entries
    }
  }, [user?.id]) // Only run when user ID changes (login)

  const handleLogin = async () => {
    try {
      const { url, codeVerifier } = await createKickAuthURL()
      sessionStorage.setItem('kickCodeVerifier', codeVerifier)
      sessionStorage.setItem('kickAuthReturn', window.location.pathname)
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
        action: 'logout',
        details: 'User logged out'
      }
      setActivityLog(prev => [logoutEntry, ...prev].slice(0, 100))
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

  // Load PayPal SDK and render subscription button
  useEffect(() => {
    if (showSubscribePopup && !paypalLoaded) {
      // Remove existing PayPal button if any
      const container = document.getElementById('paypal-button-container')
      if (container) {
        container.innerHTML = ''
      }

      // Load PayPal SDK
      const script = document.createElement('script')
      script.src = 'https://www.paypal.com/sdk/js?client-id=AcreigdRauOMN5Md7nV3SIJbF3ykTEMBLUTMSLEzCiaEgNIIsW45ETtIP6JBeRzPigk6IIHkTkDWuMhR&vault=true&intent=subscription'
      script.setAttribute('data-sdk-integration-source', 'button-factory')
      script.onload = () => {
        // Render PayPal button after SDK loads
        if (window.paypal && user) {
          window.paypal.Buttons({
            style: {
              shape: 'pill',
              color: 'blue',
              layout: 'horizontal',
              label: 'subscribe'
            },
            createSubscription: function(data: any, actions: any) {
              return actions.subscription.create({
                plan_id: 'P-85G51774HA849662NNHWRF5I',
                custom_id: `${user.username}|${paypalEmail}`
              })
            },
            onApprove: function(data: any, actions: any) {
              console.log('Subscription approved:', data.subscriptionID)
              setSubscriptionId(data.subscriptionID)
              alert(`Subscription successful! Subscription ID: ${data.subscriptionID}\n\nVerifying your subscription automatically...`)
              
              // Start polling for verification status
              pollVerificationStatus(data.subscriptionID)
            }
          }).render('#paypal-button-container')
          setPaypalLoaded(true)
        }
      }
      document.body.appendChild(script)

      return () => {
        document.body.removeChild(script)
      }
    }
  }, [showSubscribePopup, user, paypalLoaded, paypalEmail])

  const handleClearActivityLog = () => {
    setActivityLog([])
    setShowClearConfirm(false)
  }

  const handleAddSubscriber = () => {
    if (newSubscriberUsername.trim()) {
      const newSubscriber: Subscriber = {
        id: Date.now().toString(),
        username: newSubscriberUsername.trim(),
        addedAt: new Date().toISOString()
      }
      setSubscribers([...subscribers, newSubscriber])
      setNewSubscriberUsername('')
    }
  }

  const handleRemoveSubscriber = (id: string) => {
    setSubscribers(subscribers.filter(sub => sub.id !== id))
  }

  const handleRefreshHashy = async () => {
    if (!isAdmin) return

    setIsRefreshingHashy(true)
    setHashyRefreshStatus('Analyzing platform algorithms...')

    try {
      const response = await fetch('/api/admin/refresh-hashy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: true })
      })

      const data = await response.json()

      if (data.success) {
        setHashyRefreshStatus(`✅ Updated ${data.updatedPlatforms.length} platforms`)
        setTimeout(() => setHashyRefreshStatus(null), 3000)
      } else {
        setHashyRefreshStatus('❌ Failed to refresh Hashy')
        setTimeout(() => setHashyRefreshStatus(null), 3000)
      }
    } catch (error) {
      console.error('Error refreshing Hashy:', error)
      setHashyRefreshStatus('❌ Error refreshing Hashy')
      setTimeout(() => setHashyRefreshStatus(null), 3000)
    } finally {
      setIsRefreshingHashy(false)
    }
  }

  const pollVerificationStatus = (subscriptionId: string) => {
    if (!user) return
    
    let pollCount = 0
    const maxPolls = 30 // Poll for up to 2.5 minutes (30 * 5 seconds)
    
    const poll = setInterval(async () => {
      pollCount++
      
      try {
        const response = await fetch(`/api/paypal-webhook?username=${user.username}`)
        const data = await response.json()
        
        if (data.verified) {
          clearInterval(poll)
          
          // User is automatically verified
          setIsVerified(true)
          localStorage.setItem('isVerified', 'true')
          localStorage.setItem('verifiedUsername', user.username)
          localStorage.setItem('verificationExpiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString()) // 30 days
          localStorage.setItem('subscriptionId', data.subscriptionId)
          
          // Add to subscribers list for admin visibility
          const verifiedUser: Subscriber = {
            id: Date.now().toString(),
            username: user.username,
            addedAt: new Date().toISOString()
          }
          setSubscribers(prev => [...prev, verifiedUser])
          
          // Log successful automatic verification
          const successEntry: ActivityLogEntry = {
            id: Date.now().toString(),
            username: user.username,
            timestamp: new Date().toISOString(),
            action: 'payment_success',
            details: `Auto-verified via webhook - Subscription ID: ${data.subscriptionId}`
          }
          setActivityLog(prev => [successEntry, ...prev].slice(0, 100))
          
          alert(`✅ Subscription verified automatically!\n\nPremium features unlocked for 30 days!`)
          setShowSubscribePopup(false)
        }
        
        if (pollCount >= maxPolls) {
          clearInterval(poll)
          alert('Verification is taking longer than expected. Please click "Verify Subscription" to manually check your status.')
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000) // Poll every 5 seconds
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
        // Subscription verified - unlock premium features
        setIsVerified(true)
        localStorage.setItem('isVerified', 'true')
        localStorage.setItem('verifiedUsername', user.username)
        localStorage.setItem('verificationExpiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString()) // 30 days
        localStorage.setItem('subscriptionId', data.subscriptionId)
        
        // Add to subscribers list for admin visibility
        const verifiedUser = {
          id: Date.now().toString(),
          username: user.username,
          addedAt: new Date().toISOString()
        }
        setSubscribers(prev => [...prev, verifiedUser])
        
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
    ? 'bg-sdhq-dark-800/90 backdrop-blur-sm border-b border-sdhq-dark-700'
    : 'bg-white/80 backdrop-blur-sm border-b border-sdhq-cyan-200'
  
  const cardClasses = darkMode
    ? 'bg-sdhq-dark-800/90 border border-sdhq-dark-700 rounded-xl shadow-lg'
    : 'bg-white/80 backdrop-blur-sm border border-sdhq-cyan-200 rounded-xl shadow-lg'
  
  const tabListClasses = darkMode
    ? 'bg-sdhq-dark-800 border border-sdhq-dark-700'
    : 'bg-white border border-sdhq-cyan-200'
  
  const tabTriggerActiveClasses = darkMode
    ? 'bg-sdhq-dark-700 text-sdhq-green-400 shadow-sm'
    : 'bg-sdhq-cyan-100 text-sdhq-cyan-700 shadow-sm'

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
                      {isAdmin && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black text-xs font-bold rounded-full">
                          {t.admin}
                        </span>
                      )}
                      {!isAdmin && isSubscribed && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-sdhq-green-500 to-sdhq-cyan-500 text-black text-xs font-bold rounded-full">
                          Subscribed
                        </span>
                      )}
                      {!isAdmin && !isSubscribed && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          Unverified
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${subtitleClasses}`}>@{user.username}</p>
                  </div>
                  {!isAdmin && !isSubscribed && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleVerifySubscription}
                      className="ml-2"
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      {t.verifySubscription}
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
                <div className="flex items-center space-x-2">
                  <img 
                    src="https://iili.io/BebhdFf.png" 
                    alt="SDHQ Logo"
                    className="w-8 h-8"
                  />
                  <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>
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
                className={`px-3 py-1.5 rounded-md text-sm border ${
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
              <h2 className={`text-2xl font-bold gradient-text mb-4 ${darkMode ? 'from-sdhq-cyan-400 to-sdhq-green-400' : ''}`}>
                {t.welcome}
              </h2>
              <p className={`${textClasses} mb-8`}>
                {t.description}
              </p>
              <Button onClick={handleLogin} className="sdhq-button text-lg px-8 py-3">
                {t.loginButton}
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`grid w-full grid-cols-6 ${tabListClasses}`}>
              <TabsTrigger 
                value="algorithms-explained" 
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses}`}
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">{t.algorithmsExplained}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tag-generator-free"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses}`}
              >
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">{t.tagGeneratorFree}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tag-generator-paid"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses}`}
              >
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">{t.tagGeneratorPaid}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="clip-analyzer"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses}`}
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">{t.clipAnalyzer}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="content-analyzer"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses}`}
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">{t.contentAnalyzer}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className={`flex items-center space-x-2 data-[state=active]:${tabTriggerActiveClasses}`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">{t.settings}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="algorithms-explained">
              <div className="space-y-6">
                <div className={`flex items-center justify-between mb-6`}>
                  <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {t.algorithmsExplained}
                  </h3>
                  <div className="flex items-center gap-3">
                    {isLoadingAlgorithms && (
                      <span className={`${subtitleClasses} text-sm`}>Loading...</span>
                    )}
                    {algorithmError && (
                      <span className="text-red-500 text-sm">{algorithmError}</span>
                    )}
                    <p className={`${subtitleClasses} text-sm`}>
                      Last updated: {lastUpdated}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {platforms.map((platform) => (
                    <div
                      key={platform.id}
                      className={`${cardClasses} transition-all duration-300 hover:shadow-lg`}
                    >
                      <div className="p-4">
                        <div className="flex items-center space-x-4 mb-4">
                          <img
                            src={platform.image}
                            alt={platform.name}
                            className="w-12 h-12 rounded-lg"
                          />
                          <h4 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {platform.name}
                          </h4>
                        </div>
                        
                        <div className="space-y-2">
                          {platform.data ? (
                            <>
                              {platform.data.summaries ? (
                                // Use AI-generated platform-specific summaries
                                <>
                                  {platform.data.summaries.slice(0, 4).map((summary, index) => (
                                    <div key={index} className="flex items-start space-x-2">
                                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${index % 2 === 0 ? 'bg-sdhq-cyan-500' : 'bg-sdhq-green-500'}`}></div>
                                      <p className={`${textClasses} text-sm`}>{summary}</p>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                // Fallback to generic bullets if summaries not available
                                <>
                                  <div className="flex items-start space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-sdhq-cyan-500 mt-1.5 flex-shrink-0"></div>
                                    <p className={`${textClasses} text-sm`}>Key algorithm changes</p>
                                  </div>
                                  <div className="flex items-start space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-sdhq-green-500 mt-1.5 flex-shrink-0"></div>
                                    <p className={`${textClasses} text-sm`}>Editing optimization tips</p>
                                  </div>
                                  <div className="flex items-start space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-sdhq-cyan-500 mt-1.5 flex-shrink-0"></div>
                                    <p className={`${textClasses} text-sm`}>Best posting strategies</p>
                                  </div>
                                  <div className="flex items-start space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-sdhq-green-500 mt-1.5 flex-shrink-0"></div>
                                    <p className={`${textClasses} text-sm`}>Title & description guides</p>
                                  </div>
                                </>
                              )}
                              <div className="pt-3 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedCard(platform.id)}
                                  className="w-full"
                                >
                                  Read More
                                </Button>
                              </div>
                            </>
                          ) : (
                            <p className={`${subtitleClasses} text-sm`}>Loading algorithm data...</p>
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
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                {(() => {
                  const platform = platforms.find(p => p.id === expandedCard)
                  if (!platform) return null
                  return (
                    <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl`}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          <img
                            src={platform.image}
                            alt={platform.name}
                            className="w-12 h-12 rounded-lg"
                          />
                          <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {platform.name} Algorithm
                          </h3>
                        </div>
                        <button 
                          onClick={() => setExpandedCard(null)}
                          className={`p-2 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        {platform.data ? (
                          <>
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                              <h4 className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'} mb-3 flex items-center`}>
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Key Changes
                              </h4>
                              <p className={`${textClasses} text-sm leading-relaxed`}>{platform.data.keyChanges}</p>
                            </div>
                            
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                              <h4 className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'} mb-3 flex items-center`}>
                                <Video className="w-4 h-4 mr-2" />
                                Editing Tips
                              </h4>
                              <p className={`${textClasses} text-sm leading-relaxed`}>{platform.data.editingTips}</p>
                            </div>
                            
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                              <h4 className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'} mb-3 flex items-center`}>
                                <Globe className="w-4 h-4 mr-2" />
                                Posting Tips
                              </h4>
                              <p className={`${textClasses} text-sm leading-relaxed`}>{platform.data.postingTips}</p>
                            </div>
                            
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                              <h4 className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'} mb-3 flex items-center`}>
                                <Hash className="w-4 h-4 mr-2" />
                                Title Tips
                              </h4>
                              <p className={`${textClasses} text-sm leading-relaxed`}>{platform.data.titleTips}</p>
                            </div>
                            
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                              <h4 className={`font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'} mb-3 flex items-center`}>
                                <Brain className="w-4 h-4 mr-2" />
                                Description Tips
                              </h4>
                              <p className={`${textClasses} text-sm leading-relaxed`}>{platform.data.descriptionTips}</p>
                            </div>
                          </>
                        ) : (
                          <p className={`${subtitleClasses} text-center py-8`}>Loading algorithm data...</p>
                        )}
                        
                        <div className="pt-4 border-t border-gray-200 dark:border-sdhq-dark-700">
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setExpandedCard(null)}
                            className="w-full"
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <TabsContent value="tag-generator-free">
              <div className={`${cardClasses} p-6`}>
                <div className="text-center mb-8">
                  <Hash className="w-12 h-12 mx-auto mb-4 text-sdhq-cyan-500" />
                  <h3 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.tagGeneratorFree}</h3>
                  <p className={`${textClasses} max-w-2xl mx-auto`}>
                    Select a platform, describe your content, and generate optimized tags based on platform-specific algorithm insights.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Section */}
                  <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                    <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Content Details
                    </h4>
                    
                    {/* Platform Selection */}
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Select Platform
                      </label>
                      <select
                        value={tagPlatform}
                        onChange={(e) => setTagPlatform(e.target.value)}
                        className={`w-full px-3 py-2 rounded-md border ${
                          darkMode 
                            ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white' 
                            : 'bg-white border-gray-300'
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
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
                            : 'bg-white border-gray-300'
                        }`}
                      />
                    </div>

                    {/* Tag Count */}
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
                      <div className="flex justify-between text-xs mt-1 text-gray-500">
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
                              count: tagCount
                            })
                          })
                          
                          if (!res.ok) throw new Error(`API error: ${res.status}`)
                          
                          const data = await res.json()
                          setGeneratedTags(prev => ({ ...prev, [tagPlatform]: data.tags }))
                        } catch (error) {
                          console.error('Error generating tags:', error)
                          alert('Failed to generate tags. Please try again.')
                        } finally {
                          setIsGeneratingTags(false)
                        }
                      }}
                      disabled={isGeneratingTags || !tagDescription.trim()}
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
                  <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                    <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Generated Tags for {platforms.find(p => p.id === tagPlatform)?.name}
                    </h4>
                    
                    {generatedTags[tagPlatform]?.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {generatedTags[tagPlatform].map((tag, index) => (
                            <span
                              key={index}
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-800' : 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Tag Database Status
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {tagDatabaseStatus.lastUpdated 
                          ? `Last updated: ${new Date(tagDatabaseStatus.lastUpdated).toLocaleString()}`
                          : 'Database not initialized'
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                        {tagDatabaseStatus.totalTags.toLocaleString()}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        total tags across platforms
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tag-generator-paid">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Hash className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.tagGeneratorPaid}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.tagPaidDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="clip-analyzer">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Video className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.clipAnalyzer}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.clipAnalyzerDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="content-analyzer">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Brain className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.contentAnalyzer}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.contentAnalyzerDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className={`py-8 ${cardClasses}`}>
                <h3 className={`text-2xl font-bold mb-6 text-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.settings}</h3>
                
                <div className="max-w-2xl mx-auto space-y-6 px-6">
                  {/* Language Setting */}
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
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
                            : 'bg-white border-gray-300'
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
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {darkMode ? <Sun className="w-5 h-5 text-sdhq-green-400" /> : <Moon className="w-5 h-5 text-sdhq-cyan-500" />}
                        <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {darkMode ? t.darkMode : t.lightMode}
                        </span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={toggleDarkMode}
                        className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                      >
                        {darkMode ? t.lightMode : t.darkMode}
                      </Button>
                    </div>
                  </div>

                  {/* Subscribers Management - Admin Only */}
                  {isAdmin && (
                    <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                      <h4 className={`font-semibold mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <Crown className="w-5 h-5 mr-2 text-sdhq-green-500" />
                        {t.subscribers}
                      </h4>
                      
                      {/* Add Subscriber */}
                      <div className="flex space-x-2 mb-4">
                        <input
                          type="text"
                          value={newSubscriberUsername}
                          onChange={(e) => setNewSubscriberUsername(e.target.value)}
                          placeholder="Username"
                          className={`flex-1 px-3 py-2 rounded-md border ${
                            darkMode 
                              ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500' 
                              : 'bg-white border-gray-300'
                          }`}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddSubscriber()}
                        />
                        <Button 
                          onClick={handleAddSubscriber}
                          className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t.addSubscriber}
                        </Button>
                      </div>
                      
                      {/* Subscribers List */}
                      <div className={`space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        {subscribers.length === 0 ? (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No subscribers yet.</p>
                        ) : (
                          subscribers.map((sub: Subscriber) => (
                            <div 
                              key={sub.id}
                              className={`flex items-center justify-between p-2 rounded border ${
                                darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-sdhq-green-500 flex-shrink-0" />
                                <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{sub.username}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleRemoveSubscriber(sub.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
                        {/* Refresh Algorithms Button with Progress */}
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!user || !isAdmin) return
                              
                              setIsLoadingAlgorithms(true)
                              setAlgorithmRefreshProgress(0)
                              
                              // Simulate progress updates
                              const progressInterval = setInterval(() => {
                                setAlgorithmRefreshProgress(prev => {
                                  if (prev >= 90) return prev
                                  return prev + Math.random() * 15
                                })
                              }, 1000)
                              
                              try {
                                const res = await fetch('/api/algorithms', { method: 'POST' })
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
                                  
                                  setAlgorithmRefreshProgress(100)
                                  alert('Algorithms refreshed successfully!')
                                }
                              } catch (error) {
                                console.error('Error refreshing algorithms:', error)
                                alert('Failed to refresh algorithms. Please try again.')
                              } finally {
                                clearInterval(progressInterval)
                                setIsLoadingAlgorithms(false)
                                setTimeout(() => setAlgorithmRefreshProgress(0), 2000)
                              }
                            }}
                            disabled={isLoadingAlgorithms}
                            className="w-full"
                          >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            {isLoadingAlgorithms ? 'Refreshing Algorithms...' : 'Refresh Algorithms'}
                          </Button>
                          
                          {/* Algorithm Refresh Progress Bar */}
                          {isLoadingAlgorithms && (
                            <div className="mt-2">
                              <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-sdhq-dark-600' : 'bg-gray-200'}`}>
                                <div 
                                  className="h-2 rounded-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 transition-all duration-300"
                                  style={{ width: `${Math.min(algorithmRefreshProgress, 100)}%` }}
                                />
                              </div>
                              <p className={`text-xs mt-1 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {Math.round(algorithmRefreshProgress)}% complete
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Refresh Tag Database Button with Progress */}
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!user || !isAdmin) return
                              
                              setIsRefreshingTags(true)
                              setTagRefreshProgress(0)
                              
                              // Simulate progress updates
                              const progressInterval = setInterval(() => {
                                setTagRefreshProgress(prev => {
                                  if (prev >= 90) return prev
                                  return prev + Math.random() * 10
                                })
                              }, 1500)
                              
                              try {
                                const res = await fetch('/api/tags', { method: 'PUT' })
                                if (!res.ok) throw new Error(`API error: ${res.status}`)
                                
                                const data = await res.json()
                                if (data.success) {
                                  setTagDatabaseStatus({
                                    lastUpdated: data.lastUpdated,
                                    totalTags: data.totalTags
                                  })
                                  
                                  // Log the tag refresh
                                  const refreshEntry: ActivityLogEntry = {
                                    id: Date.now().toString(),
                                    username: user.username,
                                    timestamp: new Date().toISOString(),
                                    action: 'algorithm_refresh',
                                    details: `Manual tag database refresh${data.provider ? ` via ${data.provider}` : ''} - ${data.totalTags.toLocaleString()} tags`
                                  }
                                  setActivityLog(prev => [refreshEntry, ...prev].slice(0, 100))
                                  
                                  setTagRefreshProgress(100)
                                  alert(`Tag database refreshed successfully! ${data.totalTags.toLocaleString()} tags generated.`)
                                }
                              } catch (error) {
                                console.error('Error refreshing tag database:', error)
                                alert('Failed to refresh tag database. Please try again.')
                              } finally {
                                clearInterval(progressInterval)
                                setIsRefreshingTags(false)
                                setTimeout(() => setTagRefreshProgress(0), 2000)
                              }
                            }}
                            disabled={isRefreshingTags}
                            className="w-full"
                          >
                            <Database className="w-4 h-4 mr-2" />
                            {isRefreshingTags ? 'Refreshing Tags...' : 'Refresh Tag Database'}
                          </Button>
                          
                          {/* Tag Refresh Progress Bar */}
                          {isRefreshingTags && (
                            <div className="mt-2">
                              <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-sdhq-dark-600' : 'bg-gray-200'}`}>
                                <div 
                                  className="h-2 rounded-full bg-gradient-to-r from-sdhq-green-500 to-sdhq-cyan-500 transition-all duration-300"
                                  style={{ width: `${Math.min(tagRefreshProgress, 100)}%` }}
                                />
                              </div>
                              <p className={`text-xs mt-1 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {Math.round(tagRefreshProgress)}% complete - Generating 100k+ tags across 5 platforms...
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity Feed - Admin Only */}
                  {isAdmin && (
                    <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`font-semibold flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          <TrendingUp className="w-5 h-5 mr-2 text-sdhq-green-500" />
                          Activity Feed
                        </h4>
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
                      
                      <div className={`space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        {activityLog.length === 0 ? (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No activity yet.</p>
                        ) : (
                          activityLog.map((entry: ActivityLogEntry) => {
                            const getActionColor = () => {
                              switch (entry.action) {
                                case 'login': return 'text-blue-500'
                                case 'logout': return 'text-purple-500'
                                case 'payment_success': return 'text-green-500'
                                case 'payment_failed': return 'text-red-500'
                                case 'verification_attempt': return 'text-yellow-500'
                                case 'access_expired': return 'text-orange-500'
                                case 'algorithm_refresh': return 'text-cyan-400'
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
                                    <span className="text-sm">{getActionIcon()}</span>
                                    <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{entry.username}</span>
                                    <span className={`text-xs font-semibold uppercase ${getActionColor()}`}>
                                      {entry.action.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {new Date(entry.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                {entry.details && (
                                  <p className={`text-xs mt-1 pl-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {t.footerCopyright}
              </p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {t.footerTagline}
              </p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Support: Bulletbait604@gmail.com
              </p>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={() => setShowPrivacyPolicy(true)}
                className={`text-sm hover:underline ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
              >
                {t.privacyPolicy}
              </button>
              <button 
                onClick={() => setShowTerms(true)}
                className={`text-sm hover:underline ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
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
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.settings}</h3>
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
              
              {isAdmin && (
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
                  <h4 className={`font-semibold mb-3 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Brain className="w-4 h-4 mr-2 text-sdhq-cyan-500" />
                    Hashy Algorithm
                  </h4>
                  <Button
                    onClick={handleRefreshHashy}
                    disabled={isRefreshingHashy}
                    className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                  >
                    {isRefreshingHashy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Hashy Algorithm
                      </>
                    )}
                  </Button>
                  {hashyRefreshStatus && (
                    <p className={`text-sm mt-2 ${hashyRefreshStatus.includes('✅') ? 'text-green-500' : 'text-red-500'}`}>
                      {hashyRefreshStatus}
                    </p>
                  )}
                </div>
              )}

              {isAdmin && (
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-dark-600' : 'bg-white border-gray-200'}`}>
                  <h4 className={`font-semibold mb-3 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Crown className="w-4 h-4 mr-2 text-sdhq-green-500" />
                    {t.subscribers} ({subscribers.length})
                  </h4>
                  <div className="flex space-x-2 mb-3">
                    <input
                      type="text"
                      value={newSubscriberUsername}
                      onChange={(e) => setNewSubscriberUsername(e.target.value)}
                      placeholder="Username"
                      className={`flex-1 px-3 py-1.5 rounded border text-sm ${
                        darkMode 
                          ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300'
                      }`}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSubscriber()}
                    />
                    <Button 
                      size="sm"
                      onClick={handleAddSubscriber}
                      className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Subscriber List */}
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {subscribers.length === 0 ? (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No subscribers yet.</p>
                    ) : (
                      subscribers.map((sub: Subscriber) => (
                        <div 
                          key={sub.id}
                          className={`flex items-center justify-between p-2 rounded border ${
                            darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-sdhq-green-500 flex-shrink-0" />
                            <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{sub.username}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveSubscriber(sub.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
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
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.privacyPolicy}</h3>
              <button 
                onClick={() => setShowPrivacyPolicy(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`space-y-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
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
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.termsOfService}</h3>
              <button 
                onClick={() => setShowTerms(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`space-y-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
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
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Unlock Premium Features</h3>
              <button 
                onClick={() => setShowSubscribePopup(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Subscribe to unlock all premium features for $6.99 CAD/month.
              </p>
              
              <div className={`p-4 rounded-lg border-2 border-dashed ${darkMode ? 'border-sdhq-cyan-500 bg-sdhq-dark-700' : 'border-sdhq-cyan-500 bg-gray-50'}`}>
                <p className={`text-xs mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <strong>Step 1:</strong> Enter your PayPal email address (the email you used to create your PayPal account):
                </p>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="your-email@paypal.com"
                  className={`w-full px-3 py-2 rounded border text-sm ${
                    darkMode 
                      ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500' 
                      : 'bg-white border-gray-300'
                  }`}
                />
                <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  This will be used to verify your subscription ownership.
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${darkMode ? 'border-sdhq-cyan-500 bg-sdhq-dark-700' : 'border-sdhq-cyan-500 bg-gray-50'}`}>
                <p className={`text-xs mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>PayPal Subscription:</p>
                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  $6.99 CAD / month - Premium Access
                </p>
              </div>
              
              <div id="paypal-button-container" className="w-full"></div>
              
              {subscriptionId && (
                <div className={`p-3 rounded-lg border ${darkMode ? 'border-sdhq-green-500 bg-sdhq-green-500/10' : 'border-sdhq-green-500 bg-sdhq-green-50'}`}>
                  <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <strong className={darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}>Subscription created!</strong> Subscription ID: {subscriptionId}
                  </p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Click below to verify your subscription.
                  </p>
                </div>
              )}
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowPaymentConfirm(true)}
                  className="flex-1 bg-sdhq-green-600 hover:bg-sdhq-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  I&apos;ve Paid - Unlock Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSubscribePopup(false)}
                  className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                >
                  Close
                </Button>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Clear Activity Log Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-sm w-full p-6 shadow-2xl`}>
            <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Clear Activity Log?</h3>
            <p className={`text-sm mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
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

      {/* Payment Confirmation Popup */}
      {showPaymentConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'} rounded-xl max-w-sm w-full p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Confirm Payment</h3>
              <button 
                onClick={() => setShowPaymentConfirm(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border-2 border-yellow-500 ${darkMode ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
                <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  Verify your subscription
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  PayPal Email: <strong className={darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}>{paypalEmail}</strong>
                </p>
                <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  We will verify your subscription by matching your KICK username and PayPal email.
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    setShowPaymentConfirm(false)
                    checkPaymentStatus()
                  }}
                  className="flex-1 bg-sdhq-green-600 hover:bg-sdhq-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Verify Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentConfirm(false)}
                  className={darkMode ? 'border-sdhq-dark-600 text-white' : ''}
                >
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
