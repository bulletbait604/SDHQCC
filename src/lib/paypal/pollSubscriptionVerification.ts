/** Poll MongoDB / check-payment after PayPal subscription approval. */
export function pollSubscriptionVerification(params: {
  subscriptionId: string
  username: string
  onVerifyingChange: (verifying: boolean) => void
}): void {
  const uname = params.username.replace(/^@/, '').toLowerCase()
  console.log('🔍 Starting verification polling for:', params.subscriptionId, 'user:', uname)
  params.onVerifyingChange(true)

  let pollCount = 0
  const maxPolls = 60

  const confirmAndReload = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('verified', Date.now().toString())
    window.location.replace(url.toString())
  }

  const poll = setInterval(async () => {
    pollCount++
    try {
      const checkRes = await fetch('/api/check-payment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: uname,
          subscriptionId: params.subscriptionId,
        }),
      })
      const checkData = checkRes.ok ? await checkRes.json() : null
      if (checkData?.verified) {
        clearInterval(poll)
        params.onVerifyingChange(false)
        confirmAndReload()
        return
      }

      const response = await fetch(`/api/paypal-webhook?username=${encodeURIComponent(uname)}`)
      const data = await response.json()
      if (data.verified) {
        clearInterval(poll)
        params.onVerifyingChange(false)
        confirmAndReload()
        return
      }

      if (pollCount >= maxPolls) {
        clearInterval(poll)
        params.onVerifyingChange(false)
        alert(
          'Payment went through, but we could not confirm the subscription in time. Refresh the page — if your badge still does not appear, contact support with your PayPal receipt.'
        )
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }, 1000)
}
