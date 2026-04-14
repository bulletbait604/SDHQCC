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
  Crown
} from 'lucide-react'
import { createKickAuthURL } from '@/lib/kick-oauth'

interface KickUser {
  id: string
  username: string
  display_name: string
  profile_image_url?: string
}

export default function HomePage() {
  const [user, setUser] = useState<KickUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('algorithm-info')

  useEffect(() => {
    setMounted(true)
    
    // Check for existing user session
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('kickUser')
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          setUser(parsedUser)
        } catch (error) {
          console.error('Error loading stored user:', error)
        }
      }
    }
  }, [])

  const handleLogin = async () => {
    try {
      const { url, codeVerifier } = await createKickAuthURL()
      // Store code verifier for the callback
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
    }
  }

  const handleVerifySubscription = () => {
    // TODO: Implement subscription verification
    alert('Subscription verification coming soon!')
  }

  const handleSettings = () => {
    // TODO: Implement settings
    alert('Settings coming soon!')
  }

  function generateRandomString(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sdhq-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sdhq-cyan-200">
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
                      className="w-10 h-10 rounded-full border-2 border-sdhq-cyan-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-green-400 flex items-center justify-center">
                      <User className="w-5 h-5 text-black" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{user.display_name}</p>
                    <p className="text-sm text-gray-600">@{user.username}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleVerifySubscription}
                    className="ml-2"
                  >
                    <Shield className="w-4 h-4 mr-1" />
                    Verify Subscription
                  </Button>
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-bold gradient-text">SDHQ Creator Corner</h1>
                  <p className="text-sm text-gray-600">Optimize content for ANY platform</p>
                </div>
              )}
            </div>
            
            {/* Right side - Actions */}
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleSettings}>
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-1" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button onClick={handleLogin} className="sdhq-button">
                  Login with Kick
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!user ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <Crown className="w-10 h-10 text-black" />
              </div>
              <h2 className="text-3xl font-bold gradient-text mb-4">SDHQ Creator Corner</h2>
              <p className="text-gray-600 mb-8">
                Optimize long and short form content for ANY platform with AI-powered insights and tools.
              </p>
              <Button onClick={handleLogin} className="sdhq-button text-lg px-8 py-3">
                Login with Kick to Get Started
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="algorithm-info" className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Algorithm Info</span>
              </TabsTrigger>
              <TabsTrigger value="tag-generator-free" className="flex items-center space-x-2">
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">Tag Generator</span>
                <span className="text-xs bg-sdhq-cyan-100 text-sdhq-cyan-600 px-1 rounded">Free</span>
              </TabsTrigger>
              <TabsTrigger value="tag-generator-paid" className="flex items-center space-x-2">
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">Tag Generator</span>
                <span className="text-xs bg-sdhq-green-100 text-sdhq-green-600 px-1 rounded">Paid</span>
              </TabsTrigger>
              <TabsTrigger value="clip-analyzer" className="flex items-center space-x-2">
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Clip Analyzer</span>
                <span className="text-xs bg-sdhq-green-100 text-sdhq-green-600 px-1 rounded">Paid</span>
              </TabsTrigger>
              <TabsTrigger value="content-analyzer" className="flex items-center space-x-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Content Analyzer</span>
                <span className="text-xs bg-sdhq-green-100 text-sdhq-green-600 px-1 rounded">Paid</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="algorithm-info">
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-sdhq-cyan-500" />
                <h3 className="text-2xl font-bold mb-4">Algorithm Information</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Get detailed insights into how different platform algorithms work and how to optimize your content for maximum reach and engagement.
                </p>
                <p className="text-sm text-gray-500 mt-4">Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="tag-generator-free">
              <div className="text-center py-12">
                <Hash className="w-16 h-16 mx-auto mb-4 text-sdhq-cyan-500" />
                <h3 className="text-2xl font-bold mb-4">Tag Generator (Free)</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Generate basic tags for your content to improve discoverability across platforms.
                </p>
                <p className="text-sm text-gray-500 mt-4">Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="tag-generator-paid">
              <div className="text-center py-12">
                <Hash className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className="text-2xl font-bold mb-4">Tag Generator (Paid)</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Advanced AI-powered tag generation with trending keywords, optimization suggestions, and platform-specific recommendations.
                </p>
                <p className="text-sm text-gray-500 mt-4">Premium feature - Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="clip-analyzer">
              <div className="text-center py-12">
                <Video className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className="text-2xl font-bold mb-4">Clip Analyzer (Paid)</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Analyze your video clips with AI to get insights on performance, engagement potential, and optimization recommendations.
                </p>
                <p className="text-sm text-gray-500 mt-4">Premium feature - Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="content-analyzer">
              <div className="text-center py-12">
                <Brain className="w-16 h-16 mx-auto mb-4 text-sdhq-green-500" />
                <h3 className="text-2xl font-bold mb-4">Content Analyzer (Paid)</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Comprehensive content analysis with AI insights, trend detection, and optimization strategies for any platform.
                </p>
                <p className="text-sm text-gray-500 mt-4">Premium feature - Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="text-center py-12">
                <Settings className="w-16 h-16 mx-auto mb-4 text-sdhq-cyan-500" />
                <h3 className="text-2xl font-bold mb-4">Settings</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Manage your account, preferences, and subscription settings.
                </p>
                <p className="text-sm text-gray-500 mt-4">Coming soon...</p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
