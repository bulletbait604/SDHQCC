'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Bot,
  Send,
  Trash2,
  User,
  Sparkles,
  Loader2,
  MessageSquare,
  Wand2,
  Copy,
  Check,
  Info,
  ArrowRight,
  Search,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RobotTalkTabProps {
  darkMode: boolean
  subtitleClasses: string
  title: string
}

interface AIModel {
  id: string
  name: string
  provider: string
}

const MODELS_BY_PROVIDER: Record<string, AIModel[]> = {
  'OpenAI': [
    { id: 'gpt-4o', name: 'GPT-4o (Omni)', provider: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o-mini', provider: 'OpenAI' },
    { id: 'o1', name: 'o1 (Reasoning)', provider: 'OpenAI' },
    { id: 'o1-mini', name: 'o1-mini (Reasoning)', provider: 'OpenAI' },
    { id: 'o3-mini', name: 'o3-mini (Reasoning)', provider: 'OpenAI' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'gpt-4', name: 'GPT-4 (Legacy)', provider: 'OpenAI' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  ],
  'Anthropic': [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  ],
  'Google': [
    { id: 'gemini-2-0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
    { id: 'gemini-1-5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
    { id: 'gemini-1-0-pro', name: 'Gemini 1.0 Pro', provider: 'Google' },
    { id: 'gemma-2-27b', name: 'Gemma 2 27B', provider: 'Google' },
    { id: 'gemma-2-9b', name: 'Gemma 2 9B', provider: 'Google' },
    { id: 'gemma-2-2b', name: 'Gemma 2 2B', provider: 'Google' },
  ],
  'Meta (Llama)': [
    { id: 'llama-3-3-70b', name: 'Llama 3.3 70B Instruct', provider: 'Meta' },
    { id: 'llama-3-2-1b', name: 'Llama 3.2 1B Instruct', provider: 'Meta' },
    { id: 'llama-3-2-3b', name: 'Llama 3.2 3B Instruct', provider: 'Meta' },
    { id: 'llama-3-2-11b', name: 'Llama 3.2 11B Vision', provider: 'Meta' },
    { id: 'llama-3-2-90b', name: 'Llama 3.2 90B Vision', provider: 'Meta' },
    { id: 'llama-3-1-8b', name: 'Llama 3.1 8B Instruct', provider: 'Meta' },
    { id: 'llama-3-1-70b', name: 'Llama 3.1 70B Instruct', provider: 'Meta' },
    { id: 'llama-3-1-405b', name: 'Llama 3.1 405B Instruct', provider: 'Meta' },
    { id: 'llama-3-8b', name: 'Llama 3 8B Instruct', provider: 'Meta' },
    { id: 'llama-3-70b', name: 'Llama 3 70B Instruct', provider: 'Meta' },
  ],
  'DeepSeek': [
    { id: 'deepseek-v3', name: 'DeepSeek-V3', provider: 'DeepSeek' },
    { id: 'deepseek-coder-v2', name: 'DeepSeek-Coder-V2', provider: 'DeepSeek' },
    { id: 'deepseek-r1', name: 'DeepSeek-R1 (Reasoning)', provider: 'DeepSeek' },
  ],
  'Mistral': [
    { id: 'mistral-large-2', name: 'Mistral Large 2', provider: 'Mistral' },
    { id: 'mistral-8x22b', name: 'Mistral 8x22B Instruct', provider: 'Mistral' },
    { id: 'mixtral-8x7b', name: 'Mixtral 8x7B Instruct', provider: 'Mistral' },
    { id: 'mistral-7b', name: 'Mistral 7B Instruct', provider: 'Mistral' },
    { id: 'codestral', name: 'Codestral (Coding)', provider: 'Mistral' },
    { id: 'pixtral-12b', name: 'Pixtral 12B (Vision)', provider: 'Mistral' },
  ],
  'Microsoft': [
    { id: 'phi-4', name: 'Phi-4', provider: 'Microsoft' },
    { id: 'phi-3-5-moe', name: 'Phi-3.5 MoE', provider: 'Microsoft' },
    { id: 'phi-3-5-vision', name: 'Phi-3.5 Vision', provider: 'Microsoft' },
    { id: 'phi-3-medium', name: 'Phi-3 Medium', provider: 'Microsoft' },
    { id: 'phi-3-mini', name: 'Phi-3 Mini', provider: 'Microsoft' },
  ],
  'Qwen': [
    { id: 'qwen-2-5-72b', name: 'Qwen 2.5 72B Instruct', provider: 'Qwen' },
    { id: 'qwen-2-5-32b', name: 'Qwen 2.5 32B Instruct', provider: 'Qwen' },
    { id: 'qwen-2-5-14b', name: 'Qwen 2.5 14B Instruct', provider: 'Qwen' },
    { id: 'qwen-2-5-7b', name: 'Qwen 2.5 7B Instruct', provider: 'Qwen' },
    { id: 'qwen-2-5-coder-32b', name: 'Qwen 2.5 Coder 32B', provider: 'Qwen' },
    { id: 'qwen-2-5-coder-7b', name: 'Qwen 2.5 Coder 7B', provider: 'Qwen' },
  ],
  'Cohere': [
    { id: 'command-r-plus', name: 'Command R+', provider: 'Cohere' },
    { id: 'command-r', name: 'Command R', provider: 'Cohere' },
    { id: 'command-light', name: 'Command Light', provider: 'Cohere' },
  ],
  'xAI': [
    { id: 'grok-2', name: 'Grok 2', provider: 'xAI' },
    { id: 'grok-2-mini', name: 'Grok 2 Mini', provider: 'xAI' },
  ],
  'Perplexity': [
    { id: 'sonar-large', name: 'Sonar Large', provider: 'Perplexity' },
    { id: 'sonar-medium', name: 'Sonar Medium', provider: 'Perplexity' },
  ],
}

const SUGGESTIONS = [
  'How do I optimize my Kick clips for TikTok?',
  'Give me ideas for stream panels and banners.',
  'What is the best pacing strategy for vertical videos?',
  'Explain the latest YouTube Shorts algorithm trends.',
]

export default function RobotTalkTab({ darkMode, subtitleClasses, title }: RobotTalkTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'architect'>('chat')

  // Chat State
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Prompt Architect State
  const [selectedModelId, setSelectedModelId] = useState('gpt-4o')
  const [ideaInput, setIdeaInput] = useState('')
  const [architectLoading, setArchitectLoading] = useState(false)
  const [architectError, setArchitectError] = useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [promptExplanation, setPromptExplanation] = useState('')
  const [copied, setCopied] = useState(false)

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Scroll to bottom whenever messages list changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (activeSubTab === 'chat') {
      scrollToBottom()
    }
  }, [messages, loading, activeSubTab])

  const handleSend = async (textToSend?: string) => {
    const messageText = textToSend || input
    if (!messageText.trim() || loading) return

    if (!textToSend) {
      setInput('')
    }
    
    setError(null)
    const newMessages: Message[] = [...messages, { role: 'user', content: messageText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/robot-talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.details || data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setMessages([])
      setError(null)
    }
  }

  // Find selected model details
  const selectedModel = Object.values(MODELS_BY_PROVIDER)
    .flat()
    .find((m) => m.id === selectedModelId)

  // Prompt Architect Handlers
  const handleGeneratePrompt = async () => {
    if (!ideaInput.trim() || architectLoading) return

    setArchitectLoading(true)
    setArchitectError(null)
    setGeneratedPrompt('')
    setPromptExplanation('')

    try {
      const res = await fetch('/api/robot-talk/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: ideaInput,
          targetModel: selectedModel?.name || selectedModelId,
          provider: selectedModel?.provider || 'Unknown',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.details || data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setGeneratedPrompt(data.generatedPrompt)
      setPromptExplanation(data.explanation)
    } catch (err) {
      setArchitectError(err instanceof Error ? err.message : 'Failed to generate prompt. Please verify OPENAI_API configuration.')
    } finally {
      setArchitectLoading(false)
    }
  }

  const handleCopyPrompt = () => {
    if (!generatedPrompt) return
    navigator.clipboard.writeText(generatedPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendToChat = () => {
    if (!generatedPrompt) return
    setActiveSubTab('chat')
    handleSend(
      `Here is a prompt I generated using the AI Prompt Architect for ${selectedModelId}:\n\n---\n\n${generatedPrompt}`
    )
  }

  // Filter providers and models based on search query
  const filteredProviders = Object.keys(MODELS_BY_PROVIDER).reduce<Record<string, AIModel[]>>((acc, provider) => {
    const matches = MODELS_BY_PROVIDER[provider].filter(
      (model) =>
        model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        model.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        provider.toLowerCase().includes(modelSearchQuery.toLowerCase())
    )
    if (matches.length > 0) {
      acc[provider] = matches
    }
    return acc
  }, {})

  return (
    <div className="flex flex-col h-[650px] max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sdhq-green-500/10 rounded-lg text-sdhq-green-500">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">AI Creator & Stream Assistant</p>
          </div>
        </div>
        {activeSubTab === 'chat' && messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 dark:text-gray-400 dark:hover:text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear Chat
          </Button>
        )}
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex justify-center border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/10 p-2">
        <div className="flex bg-gray-200/60 dark:bg-gray-800/60 p-1 rounded-xl w-full max-w-md">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeSubTab === 'chat'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat Assistant
          </button>
          <button
            onClick={() => setActiveSubTab('architect')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeSubTab === 'architect'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            AI Prompt Architect
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'chat' ? (
          /* Chat Tab */
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30 dark:bg-gray-950/30">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-6">
                  <div className="p-4 bg-sdhq-green-500/10 rounded-full text-sdhq-green-500 animate-pulse">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                      Welcome to RobotTalk!
                    </h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      I am your dedicated streaming and content creation assistant. Ask me anything about
                      optimizing clips, designing panels, understanding platform algorithms, or growing your brand!
                    </p>
                  </div>

                  <div className="w-full space-y-2 pt-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-left">
                      Suggested Topics
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {SUGGESTIONS.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(suggestion)}
                          className="text-left text-xs p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-sdhq-green-500/50 hover:bg-sdhq-green-500/5 dark:hover:bg-sdhq-green-500/5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 transition-all duration-200"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user'
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-full bg-sdhq-green-500/10 text-sdhq-green-500 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-sdhq-green-600 text-white rounded-tr-none'
                              : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-800 rounded-tl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                        {isUser && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {loading && (
                    <div className="flex items-start gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-sdhq-green-500/10 text-sdhq-green-500 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-sdhq-green-500" />
                        Thinking...
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg text-xs text-center">
                      {error}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask RobotTalk anything..."
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sdhq-green-500/50 focus:border-sdhq-green-500 transition-all duration-200 disabled:opacity-50"
                />
                <Button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-sdhq-green-600 hover:bg-sdhq-green-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            </div>
          </div>
        ) : (
          /* Prompt Architect Tab */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full p-6 overflow-y-auto bg-gray-50/20 dark:bg-gray-950/20">
            {/* Left Column: Input Form */}
            <div className="md:col-span-5 flex flex-col space-y-4">
              <div className="space-y-1.5 relative" ref={modelDropdownRef}>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Target AI Model
                </label>
                
                {/* Trigger Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsModelDropdownOpen(!isModelDropdownOpen)
                    setModelSearchQuery('') // Reset search query when opening
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sdhq-green-500/50 focus:border-sdhq-green-500 transition-all duration-200 text-left"
                >
                  <span className="truncate">
                    {selectedModel ? `${selectedModel.name} (${selectedModel.provider})` : 'Select a model...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                </button>

                {/* Dropdown Popover */}
                {isModelDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-50 flex flex-col max-h-[320px] overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center px-3 py-2 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                      <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder="Search models or providers..."
                        className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    {/* Model List */}
                    <div className="flex-1 overflow-y-auto py-1">
                      {Object.keys(filteredProviders).length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                          No models found
                        </div>
                      ) : (
                        Object.keys(filteredProviders).map((provider) => (
                          <div key={provider} className="space-y-0.5">
                            {/* Provider Header */}
                            <div className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50/50 dark:bg-gray-900/30">
                              {provider}
                            </div>
                            {/* Models */}
                            {filteredProviders[provider].map((model) => {
                              const isSelected = model.id === selectedModelId
                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedModelId(model.id)
                                    setIsModelDropdownOpen(false)
                                  }}
                                  className={`w-full text-left px-4 py-2 text-xs transition-colors duration-150 flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-sdhq-green-500/10 text-sdhq-green-600 dark:text-sdhq-green-400 font-medium'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <span>{model.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-sdhq-green-500 shrink-0" />}
                                </button>
                              )
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1 flex flex-col">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Your Prompt Idea
                </label>
                <textarea
                  value={ideaInput}
                  onChange={(e) => setIdeaInput(e.target.value)}
                  placeholder="Describe what you want the AI to do in plain English. E.g., 'I am trying to turn 2 warzone clips into a viral tiktok clip with viral cuts, overlays and text with captions.'"
                  className="w-full flex-1 min-h-[150px] md:min-h-[220px] p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sdhq-green-500/50 focus:border-sdhq-green-500 transition-all duration-200 resize-none"
                />
              </div>

              <Button
                onClick={handleGeneratePrompt}
                disabled={architectLoading || !ideaInput.trim()}
                className="w-full bg-sdhq-green-600 hover:bg-sdhq-green-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
              >
                {architectLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Engineering Prompt...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Optimized Prompt
                  </>
                )}
              </Button>

              {architectError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg text-xs leading-relaxed">
                  {architectError}
                </div>
              )}
            </div>

            {/* Right Column: Generated Output */}
            <div className="md:col-span-7 flex flex-col h-full min-h-[350px]">
              {generatedPrompt ? (
                <div className="flex flex-col h-full space-y-4">
                  {/* Prompt Box */}
                  <div className="flex-1 flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Optimized Prompt
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyPrompt}
                          className="h-8 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-sdhq-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSendToChat}
                          className="h-8 text-xs text-sdhq-green-500 hover:bg-sdhq-green-500/10"
                        >
                          Send to Chat
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap select-all leading-relaxed bg-gray-50/50 dark:bg-gray-950/50">
                      {generatedPrompt}
                    </div>
                  </div>

                  {/* Explanation Box */}
                  {promptExplanation && (
                    <div className="p-4 border border-sdhq-green-500/20 bg-sdhq-green-500/5 rounded-xl flex items-start gap-3">
                      <Info className="w-5 h-5 text-sdhq-green-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h6 className="text-xs font-semibold text-sdhq-green-600 uppercase tracking-wider">
                          Prompt Engineering Insights
                        </h6>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          {promptExplanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900/20">
                  <Wand2 className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3 animate-pulse" />
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    No prompt generated yet
                  </h5>
                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                    Fill out your idea on the left and select your target model to generate a custom, high-efficiency prompt.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
