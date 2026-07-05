import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service - Stream Dreams Creator Corner',
  description: 'Terms of Service for Stream Dreams Creator Corner.',
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sdhq-cyan-50 via-white to-sdhq-green-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <p className="text-gray-500 mb-6">Last Updated: June 17, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            By accessing or using Stream Dreams Creator Corner (&quot;SDHQ&quot;), you agree to these Terms of Service
            and our{' '}
            <Link href="/privacy" className="text-sdhq-cyan-600 hover:text-sdhq-cyan-700 underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Description of Service</h2>
          <p className="text-gray-600 leading-relaxed">
            SDHQ provides AI-powered content creation tools for streamers and creators, including tag generation,
            thumbnail tools, clip analysis, Post4Me copy generation, and experimental R&amp;D features. Features may
            change, move, or be removed without notice as part of ongoing development.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">3. Accounts and Authentication</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>You must sign in with a valid Kick account to access most features.</li>
            <li>You are responsible for activity under your account and for keeping your Kick credentials secure.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">4. Subscriptions, Coins, and Payments</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Some features require a subscription, lifetime pass, or virtual coins. Payments are processed by PayPal.
            Refund eligibility follows PayPal and our published policies at the time of purchase. Free features remain
            available subject to usage limits and advertising.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">5. User Content and License</h2>
          <p className="text-gray-600 leading-relaxed">
            You retain ownership of content you submit. You grant SDHQ a limited license to process that content solely
            to operate the service (e.g. generate tags, analyze clips). You represent that
            you have the rights to submit the content you provide.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">6. Acceptable Use</h2>
          <p className="text-gray-600 leading-relaxed mb-4">You agree not to:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Violate applicable laws or third-party terms (Kick, platform ToS)</li>
            <li>Attempt to bypass authentication, access controls, or rate limits</li>
            <li>Upload malware, harass others, or abuse staff tools</li>
            <li>Scrape or reverse-engineer the service except where permitted by law</li>
            <li>Use automated means to overload our infrastructure</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">7. AI and Game Data Disclaimer</h2>
          <p className="text-gray-600 leading-relaxed">
            AI-generated recommendations, tags, and analysis are provided &quot;as is&quot; without guarantee of accuracy,
            virality, or in-game results.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">8. Advertising</h2>
          <p className="text-gray-600 leading-relaxed">
            Free-tier users may see third-party advertisements. Subscribers and certain roles may receive an ad-reduced
            experience. Advertising partners may use cookies as described in our Privacy Policy when you consent.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">9. Termination</h2>
          <p className="text-gray-600 leading-relaxed">
            We may suspend or terminate access for violations of these terms, fraud, or abuse. You may stop using the
            service at any time. Provisions that by nature should survive termination (disclaimers, limitations of
            liability) will survive.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">10. Limitation of Liability</h2>
          <p className="text-gray-600 leading-relaxed">
            To the maximum extent permitted by law, SDHQ and its operators are not liable for indirect, incidental,
            special, consequential, or punitive damages, or for loss of profits, data, or goodwill. Our total liability
            for any claim relating to the service is limited to the amount you paid us in the twelve months before the
            claim, or fifty U.S. dollars if you paid nothing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">11. Governing Law</h2>
          <p className="text-gray-600 leading-relaxed">
            These terms are governed by the laws of the jurisdiction in which the service operator resides, without
            regard to conflict-of-law rules. Disputes will be resolved in the courts of that jurisdiction unless
            otherwise required by mandatory consumer protection laws in your country.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">12. Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            Questions about these Terms:{' '}
            <a
              href="mailto:Bulletbait604@gmail.com"
              className="text-sdhq-cyan-600 hover:text-sdhq-cyan-700 underline"
            >
              Bulletbait604@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
