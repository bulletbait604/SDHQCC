'use client'

import { useEffect, useState } from 'react'
import {
  formatCad,
  FREE_DAILY_ANALYSIS_QUOTA,
  FREE_DAILY_TAG_QUOTA,
  LIFETIME_PASS,
  listCoinPacks,
  PRO_ANNUAL,
  PRO_MONTHLY,
  PRO_TRIAL_DAYS,
} from '@/lib/billing/plans'

const FEATURES = [
  {
    title: 'Clip analyzer',
    body: 'Score a clip, then get titles, tags, and edit notes aimed at the platform you actually post on.',
    placeholder: 'public/demos/clip-analyzer.gif',
  },
  {
    title: 'Tag generator',
    body: 'Turn a description into platform tags. Free accounts get a small daily allowance before coins.',
    placeholder: 'public/demos/tag-generator.gif',
  },
  {
    title: 'AI thumbnails',
    body: 'Paint a thumbnail from a prompt or a reference clip. This one spends coins, or it is included with Pro.',
    placeholder: 'public/demos/thumbnails.gif',
  },
  {
    title: 'Post4Me',
    body: 'Draft posts from a clip for more than one platform in a single pass.',
    placeholder: 'public/demos/post4me.gif',
  },
  {
    title: 'Stream Deck',
    body: 'Pro members get a packaged KICK live-status plugin they can install or sell as a one-time download.',
    placeholder: 'public/demos/stream-deck.gif',
  },
]

const FAQS = [
  {
    q: 'How does the 7-day Pro trial work?',
    a: `Sign in with Kick and start it from this page. Pro stays on for ${PRO_TRIAL_DAYS} days on your account, with no PayPal charge. Each account can start it once.`,
  },
  {
    q: 'What do current subscribers keep?',
    a: 'Anyone already marked subscriber, lifetime, admin, owner, or tester keeps unlimited tools. This does not move them onto a new price. PayPal keeps billing the plan they already joined until you create a new plan and they switch.',
  },
  {
    q: 'What is free without Pro?',
    a: `Each UTC day, a free account can run ${FREE_DAILY_ANALYSIS_QUOTA} analyses and ${FREE_DAILY_TAG_QUOTA} tag generations without spending coins. After that, those tools use coins. Thumbnails and Post4Me always cost coins unless you have Pro or a trial.`,
  },
  {
    q: 'What are the coin packs?',
    a: 'Coins are one-time PayPal checkouts. The daily free-coin refresh still applies, and purchased coins stay on the account. Packs are listed below and come from the same price catalog as checkout.',
  },
  {
    q: 'Where do I pay?',
    a: 'Pricing buttons send you through Kick login if you are signed out, then open the existing PayPal subscribe, lifetime, or coin checkout. Nothing on this page charges a card by itself.',
  },
]

function checkoutHref(checkout: string, loggedIn: boolean): string {
  const path = `/?checkout=${encodeURIComponent(checkout)}`
  if (loggedIn) return path
  return `/api/auth/kick/start?return=${encodeURIComponent(path)}`
}

export default function PricingView() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [pro, setPro] = useState(false)
  const coins = listCoinPacks()
  const monthlyTimesTwelve = PRO_MONTHLY.priceCad * 12
  const annualSavings = Math.round(monthlyTimesTwelve - PRO_ANNUAL.priceCad)

  useEffect(() => {
    void fetch('/api/me', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return
        const data = (await response.json()) as {
          user?: { username?: string; role?: string } | null
          subscription?: { isVerified?: boolean; isLifetime?: boolean; isProTrial?: boolean }
        }
        setLoggedIn(!!data.user)
        const role = data.user?.role
        setPro(
          !!data.subscription?.isVerified ||
            !!data.subscription?.isLifetime ||
            !!data.subscription?.isProTrial ||
            role === 'subscriber' ||
            role === 'subscriber_lifetime' ||
            role === 'admin' ||
            role === 'owner' ||
            role === 'tester'
        )
      })
      .catch(() => {
        setLoggedIn(false)
      })
  }, [])

  return (
    <div className="relative min-h-screen bg-[#05070d] text-white">
      <div className="sdhq-page-orbs" />
      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-sdhq-dark-900/75 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <a href="/" className="font-bold tracking-tight">
              <span className="gradient-text">Stream Dreams Creator Corner</span>
            </a>
            <a href="/" className="text-sm font-semibold text-sdhq-cyan-200 hover:text-white">
              Open the app
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-20 pt-12">
          <section className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sdhq-cyan-300">
              Creator toolkit
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              <span className="gradient-text">Make the next post faster.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-300">
              Analyze clips, write tags, paint thumbnails, and draft posts. Start with a{' '}
              {PRO_TRIAL_DAYS}-day Pro trial, stay on the free daily allowance, or pay once for lifetime access.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href={checkoutHref('trial', loggedIn)} className="sdhq-button px-6 py-3 text-base">
                Start {PRO_TRIAL_DAYS}-day Pro trial
              </a>
              <a
                href="#plans"
                className="rounded-xl border border-white/15 px-6 py-3 text-base font-semibold text-white hover:bg-white/5"
              >
                Compare plans
              </a>
            </div>
          </section>

          <section className="mt-16 grid gap-6 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="overflow-hidden rounded-2xl border border-white/10 bg-sdhq-dark-800/70 shadow-xl shadow-black/20"
              >
                <div className="flex aspect-video items-center justify-center border-b border-dashed border-sdhq-cyan-500/40 bg-black/40 px-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-sdhq-cyan-200">Demo GIF placeholder</p>
                    <p className="mt-2 font-mono text-xs text-gray-400">{feature.placeholder}</p>
                  </div>
                </div>
                <div className="p-5">
                  <h2 className="text-xl font-bold">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{feature.body}</p>
                </div>
              </article>
            ))}
          </section>

          <section id="plans" className="mt-20">
            <h2 className="text-center text-3xl font-extrabold">Pricing</h2>
            <p className="mt-2 text-center text-sm text-gray-400">Prices are CAD. Checkout can quote another currency.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PlanCard
                name="Free"
                price="$0"
                cadence="to start"
                points={[
                  `${FREE_DAILY_ANALYSIS_QUOTA} analyses per UTC day`,
                  `${FREE_DAILY_TAG_QUOTA} tag generations per UTC day`,
                  'Thumbnails and Post4Me use coins',
                  'Daily free coins still refresh',
                ]}
                href="/"
                cta="Use the free tools"
              />
              <PlanCard
                name="Pro monthly"
                price={formatCad(PRO_MONTHLY.priceCad)}
                cadence="/ month"
                highlighted
                points={[
                  `${PRO_TRIAL_DAYS}-day trial before you pay`,
                  'Unlimited analyses, tags, thumbnails, and Post4Me',
                  'Stream Deck Pro download',
                  'Cancel in PayPal',
                ]}
                href={checkoutHref('pro-monthly', loggedIn)}
                cta="Subscribe monthly"
              />
              <PlanCard
                name="Pro annual"
                price={formatCad(PRO_ANNUAL.priceCad)}
                cadence="/ year"
                points={[
                  `Save ${formatCad(annualSavings)} versus 12 months`,
                  'Same Pro tools as monthly',
                  'Stream Deck Pro download',
                  'Billed once a year',
                ]}
                href={checkoutHref('pro-annual', loggedIn)}
                cta="Subscribe yearly"
              />
              <PlanCard
                name="Lifetime"
                price={formatCad(LIFETIME_PASS.priceCad)}
                cadence="once"
                points={[
                  'One-time PayPal checkout',
                  'Unlimited tools, same as Pro',
                  'Stream Deck Pro download',
                  'No monthly renewal',
                ]}
                href={checkoutHref('lifetime', loggedIn)}
                cta="Get the lifetime pass"
              />
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Coin packs</h3>
                  <p className="text-sm text-gray-400">One-time top-ups. Thumbnails and extra analyses spend these.</p>
                </div>
                <a href={checkoutHref('coins', loggedIn)} className="text-sm font-semibold text-sdhq-cyan-300">
                  Buy coins
                </a>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {coins.map((pack) => (
                  <div key={pack.id} className="rounded-xl border border-white/10 px-4 py-3">
                    <p className="font-semibold">{pack.label}</p>
                    <p className="mt-1 text-2xl font-extrabold">{formatCad(pack.priceCad)}</p>
                    <p className="text-sm text-gray-400">{pack.coins} coins</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-16 rounded-2xl border border-sdhq-cyan-500/30 bg-sdhq-cyan-500/10 p-6">
            <h2 className="text-2xl font-bold">Stream Deck Pro</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-200">
              The Pro build is a double-clickable <span className="font-mono">.streamDeckPlugin</span> file. Upload it
              to Gumroad as a paid download, or let Pro members download it here. Build it locally with{' '}
              <span className="font-mono">npm run package:streamdeck:pro</span>.
            </p>
            <div className="mt-4">
              {pro ? (
                <a href="/api/streamdeck/download" className="sdhq-button px-5 py-2.5 text-sm">
                  Download Stream Deck Pro
                </a>
              ) : (
                <a href={checkoutHref('trial', loggedIn)} className="sdhq-button px-5 py-2.5 text-sm">
                  Unlock the download with Pro
                </a>
              )}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold">FAQ</h2>
            <div className="mt-6 space-y-3">
              {FAQS.map((item) => (
                <details key={item.q} className="rounded-2xl border border-white/10 bg-sdhq-dark-800/70 px-5 py-4">
                  <summary className="cursor-pointer font-semibold">{item.q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-gray-300">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-16 text-center">
            <h2 className="text-3xl font-extrabold">Ready when you are</h2>
            <p className="mt-3 text-gray-300">The trial starts in the app. PayPal opens only when you choose a paid plan.</p>
            <a href={checkoutHref('trial', loggedIn)} className="sdhq-button mt-6 inline-flex px-8 py-3 text-base">
              Start the free Pro trial
            </a>
          </section>
        </main>
      </div>
    </div>
  )
}

function PlanCard({
  name,
  price,
  cadence,
  points,
  href,
  cta,
  highlighted = false,
}: {
  name: string
  price: string
  cadence: string
  points: string[]
  href: string
  cta: string
  highlighted?: boolean
}) {
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border p-5 ${
        highlighted
          ? 'border-sdhq-cyan-400 bg-gradient-to-b from-sdhq-cyan-500/15 to-transparent shadow-neon-cyan'
          : 'border-white/10 bg-sdhq-dark-800/70'
      }`}
    >
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="mt-3 text-3xl font-extrabold">
        {price} <span className="text-sm font-medium text-gray-400">{cadence}</span>
      </p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-300">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <a
        href={href}
        className={`mt-6 w-full text-center ${highlighted ? 'sdhq-button' : 'sdhq-button-outline'}`}
      >
        {cta}
      </a>
    </article>
  )
}
