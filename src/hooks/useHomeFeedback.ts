'use client'

import { useCallback, useState } from 'react'
import type { KickUser } from '@/lib/home/types'

export function useHomeFeedback(user: KickUser | null, userRole: string, isOwner: boolean) {
  const [feedbackReplyEmail, setFeedbackReplyEmail] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)

  const handleSubmitStaffFeedback = useCallback(async () => {
    if (!user || userRole === 'owner' || isOwner) return
    const email = feedbackReplyEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address so we can reply.')
      return
    }
    const msg = feedbackMessage.trim()
    if (msg.length < 5) {
      alert('Please write a short message.')
      return
    }
    setFeedbackSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ replyEmail: email, message: msg }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not send feedback.')
      }
      setFeedbackMessage('')
      const staff = data.staffEmail || 'bulletbait604@gmail.com'
      if (data.emailSent === true) {
        alert(
          `Thanks! We emailed ${staff} with your message. We'll reply to you at ${email} when we can.`
        )
      } else {
        alert(
          `Thanks! Your message was saved. We couldn't send the automatic email just now — please also contact ${staff} if it's urgent.`
        )
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send feedback.')
    } finally {
      setFeedbackSending(false)
    }
  }, [feedbackMessage, feedbackReplyEmail, isOwner, user, userRole])

  return {
    feedbackReplyEmail,
    setFeedbackReplyEmail,
    feedbackMessage,
    setFeedbackMessage,
    feedbackSending,
    handleSubmitStaffFeedback,
  }
}
