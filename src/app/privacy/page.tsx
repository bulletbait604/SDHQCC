import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - SDHQ Creator Corner',
  description: 'Privacy Policy for SDHQ Creator Corner including information about advertising and data collection.',
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sdhq-cyan-50 via-white to-sdhq-green-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-gray-500 mb-6">Last Updated: {new Date().toLocaleDateString()}</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
          <p className="text-gray-600 leading-relaxed">
            SDHQ Creator Corner (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our website.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            We collect information you provide directly to us, such as:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Kick username and profile information (when you log in)</li>
            <li>Content descriptions and tags you generate</li>
            <li>Video files uploaded for analysis (temporarily processed, not stored)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">3. Advertising and Third-Party Services</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            We use third-party advertising services, specifically <strong>Monetag</strong>, to display advertisements on our website. These ads help us keep the service free for users.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Monetag and its advertising partners may use cookies and similar technologies to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
            <li>Deliver personalized advertisements</li>
            <li>Measure ad performance and effectiveness</li>
            <li>Prevent fraud and abuse</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            These cookies collect anonymous data about your browsing behavior and device information. This data is used for targeting and personalization purposes.
          </p>
          <p className="text-gray-600 leading-relaxed mt-4">
            For more information about Monetag&apos;s privacy practices, please visit:{' '}
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
          <h2 className="text-xl font-semibold text-gray-800 mb-4">4. Cookies and Similar Technologies</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            We use cookies for:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li><strong>Essential cookies:</strong> Required for authentication and basic functionality</li>
            <li><strong>Advertising cookies:</strong> Used by our ad partners to deliver relevant ads</li>
            <li><strong>Analytics cookies:</strong> Help us understand how users interact with our site</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-4">
            You can manage your cookie preferences through your browser settings or our cookie consent banner.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">5. Data Storage and Security</h2>
          <p className="text-gray-600 leading-relaxed">
            We take reasonable measures to protect your information. Video files uploaded for analysis are processed temporarily and automatically deleted after analysis is complete. We do not store video content permanently.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">6. Your Rights</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Depending on your location, you may have rights to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Access the personal information we hold about you</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of targeted advertising</li>
            <li>Withdraw consent for cookie use</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">7. Contact Us</h2>
          <p className="text-gray-600 leading-relaxed">
            If you have questions about this Privacy Policy or our data practices, please contact us at:{' '}
            <a 
              href="mailto:Bulletbait604@gmail.com" 
              className="text-sdhq-cyan-600 hover:text-sdhq-cyan-700 underline"
            >
              Bulletbait604@gmail.com
            </a>
          </p>
        </section>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            This site uses advertising to support free access to our tools. By using this website, you consent to our use of cookies and the processing of data as described in this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
