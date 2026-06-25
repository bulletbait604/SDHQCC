/** Minimal PayPal JS SDK surface used by checkout popups. */
interface PayPalButtonsInstance {
  render: (selector: string | HTMLElement) => Promise<void>
  isEligible: () => boolean
}

interface PayPalSdk {
  Buttons: (options: Record<string, unknown>) => PayPalButtonsInstance
}

declare global {
  interface Window {
    paypal?: PayPalSdk
    paypal_subscribe?: PayPalSdk
    paypal_lifetime?: PayPalSdk
    paypal_donate?: PayPalSdk
  }
}

export {}
