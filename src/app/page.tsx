'use client'

import { useState, useEffect } from 'react'
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
  CheckCircle
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
}

type Language = 'en' | 'es' | 'fr' | 'de';

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

  const t = translations[language]
  const isAdmin = user ? ADMIN_USERNAMES.includes(user.username) : false

  useEffect(() => {
    setMounted(true)
    
    // Check for existing user session
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('kickUser')
      const storedLanguage = localStorage.getItem('sdhq-language') as Language
      const storedDarkMode = localStorage.getItem('sdhq-darkmode')
      const storedSubscribers = localStorage.getItem('sdhq-subscribers')
      const storedActivityLog = localStorage.getItem('sdhq-activity-log')
      
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
    }
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
        timestamp: new Date().toISOString()
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
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kickUser')
      localStorage.removeItem('kickAccessToken')
      window.location.href = '/'
    }
  }

  const handleVerifySubscription = () => {
    setShowSubscribePopup(true)
  }

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
                      {!isAdmin && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          Unverified
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${subtitleClasses}`}>@{user.username}</p>
                  </div>
                  {!isAdmin && (
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
              <div className={`text-center py-12 ${cardClasses}`}>
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-sdhq-cyan-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>{t.algorithmsExplained}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.algorithmsDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="tag-generator-free">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Hash className="w-16 h-16 mx-auto mb-4 text-sdhq-cyan-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>{t.tagGeneratorFree}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.tagFreeDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="tag-generator-paid">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Hash className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>{t.tagGeneratorPaid}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.tagPaidDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="clip-analyzer">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Video className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>{t.clipAnalyzer}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.clipAnalyzerDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="content-analyzer">
              <div className={`text-center py-12 ${cardClasses}`}>
                <Brain className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>{t.contentAnalyzer}</h3>
                <p className={`${textClasses} max-w-2xl mx-auto`}>
                  {t.contentAnalyzerDesc}
                </p>
                <p className={`${subtitleClasses} mt-4`}>{t.premiumFeature} - {t.comingSoon}</p>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className={`py-8 ${cardClasses}`}>
                <h3 className={`text-2xl font-bold mb-6 text-center ${darkMode ? 'text-white' : ''}`}>{t.settings}</h3>
                
                <div className="max-w-2xl mx-auto space-y-6 px-6">
                  {/* Language Setting */}
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Globe className="w-5 h-5 text-sdhq-cyan-500" />
                        <span className={`font-medium ${darkMode ? 'text-white' : ''}`}>{t.language}</span>
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
                        <span className={`font-medium ${darkMode ? 'text-white' : ''}`}>
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
                      
                      <div className={`space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 ${darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'}`}>
                        {activityLog.length === 0 ? (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No activity yet.</p>
                        ) : (
                          activityLog.map((entry: ActivityLogEntry) => (
                            <div 
                              key={entry.id}
                              className={`flex items-center justify-between p-2 rounded border ${
                                darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-sdhq-cyan-500 flex-shrink-0" />
                                <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{entry.username}</span>
                              </div>
                              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))
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
                </div>
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
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Subscribe to Access</h3>
              <button 
                onClick={() => setShowSubscribePopup(false)}
                className={`p-1 rounded-full hover:bg-gray-200 ${darkMode ? 'hover:bg-sdhq-dark-700 text-white' : 'text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                You need to subscribe to Bulletbait604 on Kick to unlock premium features and remove the Unverified status.
              </p>
              
              <div className={`p-4 rounded-lg border ${darkMode ? 'border-sdhq-dark-600 bg-sdhq-dark-700' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Subscribe at:</p>
                <a 
                  href="https://kick.com/bulletbait604/subscribe" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sdhq-cyan-500 hover:text-sdhq-cyan-400 font-medium break-all"
                >
                  https://kick.com/bulletbait604/subscribe
                </a>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => window.open('https://kick.com/bulletbait604/subscribe', '_blank')}
                  className="flex-1 bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Subscribe Now
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
    </div>
  )
}
