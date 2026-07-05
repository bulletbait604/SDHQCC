import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - Stream Dreams Creator Corner',
  description:
    'Privacy Policy for Stream Dreams Creator Corner including cookies, authentication, advertising, and your data rights.',
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sdhq-cyan-50 via-white to-sdhq-green-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-gray-500 mb-6">Last Updated: June 17, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
          <p className="text-gray-600 leading-relaxed">
            Stream Dreams Creator Corner (&quot;SDHQ,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy.
            This Privacy Policy explains how we collect, use, store, and protect your information when you use{' '}
            <strong>sdhqcc.vercel.app</strong> and related services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>
          <p className="text-gray-600 leading-relaxed mb-4">We may collect:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>
              <strong>Account data:</strong> Kick username, profile picture, and email address when you sign in with
              Kick OAuth
            </li>
            <li>
              <strong>Linked gaming accounts:</strong> Bungie display name, membership IDs, guardian profile summary,
              and OAuth tokens (stored server-side) when you connect DestinyTopNest to Bungie.net
            </li>
            <li>
              <strong>Content you submit:</strong> tags, descriptions, thumbnails, and other tool inputs
            </li>
            <li>
              <strong>Uploaded media:</strong> video files for clip analysis (processed temporarily, not stored
              permanently)
            </li>
            <li>
              <strong>Payment-related data:</strong> transaction identifiers from PayPal for subscriptions, lifetime
              passes, donations, and coin purchases (we do not store full payment card numbers)
            </li>
            <li>
              <strong>Technical data:</strong> IP address, browser type, device information, and usage logs for security
              and operations
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">3. Cookies and Similar Technologies</h2>
          <p className="text-gray-600 leading-relaxed mb-4">We use cookies and similar storage for distinct purposes:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
            <li>
              <strong>Strictly necessary cookies:</strong> Session authentication (httpOnly JWT), OAuth state and return
              paths (Kick and Bungie login flows), and security tokens. These are required for login and linked
              accounts and do not require advertising consent.
            </li>
            <li>
              <strong>Preference cookies:</strong> Language and dark/light theme choices stored in browser cookies
              (e.g. <code className="text-sm">sdhq_language</code>, <code className="text-sm">sdhq_dark</code>).
            </li>
            <li>
              <strong>Consent cookie:</strong> Your cookie banner choice (<code className="text-sm">sdhq_cookie_consent</code>).
            </li>
            <li>
              <strong>Advertising cookies:</strong> Set by our ad partners when you accept advertising cookies in the
              consent banner.
            </li>
          </ul>
          <p className="text-gray-600 leading-relaxed mb-4">
            <strong>Navigation state:</strong> To keep you on the same tab when you refresh or return from login, we store
            your current section in the page URL (query parameters such as <code className="text-sm">?tab=rnd</code>).
            This is not a tracking cookie—it is part of the address bar and helps restore your place in the app.
          </p>
          <p className="text-gray-600 leading-relaxed">
            You can manage non-essential cookies through our consent banner or your browser settings. Blocking essential
            cookies may prevent sign-in and account linking.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">4. Third-Party Services</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>
              <strong>Kick:</strong> OAuth authentication — subject to Kick&apos;s policies
            </li>
            <li>
              <strong>Bungie.net:</strong> Optional Destiny account linking — subject to Bungie&apos;s terms and privacy
              policy
            </li>
            <li>
              <strong>PayPal:</strong> Payments and subscriptions
            </li>
            <li>
              <strong>Monetag / Google AdSense:</strong> Advertising for free-tier users
            </li>
            <li>
              <strong>Vercel Analytics:</strong> Aggregated, privacy-oriented usage metrics
            </li>
            <li>
              <strong>MongoDB Atlas:</strong> Secure database hosting for accounts and app data
            </li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-4">
            Monetag privacy policy:{' '}
            <a
              href="https://monetag.com/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sdhq-cyan-600 hover:text-sdhq-cyan-700 underline"
            >
              https://monetag.com/privacy-policy/
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">5. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Provide creator tools, AI analysis, and DestinyTopNest features</li>
            <li>Authenticate you and maintain your session</li>
            <li>Process payments and manage subscriptions or coin balances</li>
            <li>Display personalized ads to non-subscribers (with consent where required)</li>
            <li>Prevent fraud, abuse, and unauthorized access</li>
            <li>Improve reliability and fix bugs</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">6. Data Storage and Security</h2>
          <p className="text-gray-600 leading-relaxed">
            We use industry-standard measures including encrypted connections (HTTPS), httpOnly session cookies, and
            access controls. Video uploads are processed temporarily and deleted after analysis. Bungie OAuth refresh
            tokens are stored server-side only and are not exposed to the browser.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">7. Your Rights</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Depending on where you live (including the EU/EEA under GDPR, California under CCPA/CPRA, and other U.S.
            state privacy laws), you may have the right to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and linked data</li>
            <li>Export your data in a portable format</li>
            <li>Opt out of targeted advertising and certain data sales/sharing</li>
            <li>Withdraw consent for non-essential cookies</li>
            <li>Disconnect linked third-party accounts (e.g. Bungie) from within the app</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-4">
            To exercise these rights, contact us at the email below. We will respond within the timeframe required by
            applicable law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">8. Children</h2>
          <p className="text-gray-600 leading-relaxed">
            Our service is not directed to children under 13 (or 16 where applicable). We do not knowingly collect
            personal information from children. If you believe a child has provided us data, contact us for deletion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">9. Changes</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update this policy from time to time. Material changes will be reflected by updating the &quot;Last
            Updated&quot; date. Continued use after changes constitutes acceptance of the revised policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">10. Contact Us</h2>
          <p className="text-gray-600 leading-relaxed">
            Questions about this Privacy Policy or your data:{' '}
            <a
              href="mailto:Bulletbait604@gmail.com"
              className="text-sdhq-cyan-600 hover:text-sdhq-cyan-700 underline"
            >
              Bulletbait604@gmail.com
            </a>
          </p>
          <p className="text-gray-600 leading-relaxed mt-4">
            See also our <Link href="/terms" className="text-sdhq-cyan-600 hover:text-sdhq-cyan-700 underline">Terms of Service</Link>.
          </p>
        </section>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            This site uses advertising to support free access. Essential cookies are required for login. Advertising
            cookies are optional and controlled through the cookie consent banner.
          </p>
        </div>
      </div>
    </div>
  )
}
