import { useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  FacebookAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updatePhoneNumber,
  PhoneAuthProvider,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { deleteUser, sendEmailVerification } from 'firebase/auth'

import { auth, db } from '@/lib/firebase'
import type { AppUser, Profile } from '@/types/user.types'

// ---------------------------------------------------------------------------
// useAuth — session + profile (role) management.
// The role lives in the Firestore `profiles/{uid}` doc (not auth custom
// claims) so security rules can query it directly via get().
// ---------------------------------------------------------------------------

/** Normalize a Firestore profile doc into the Profile shape. Firestore server
 *  timestamps arrive as Timestamp objects (have toMillis); normalize to an
 *  epoch-millis string so callers can Date() it. */
function parseProfile(id: string, data: Record<string, unknown>): Profile {
  let createdAt = ''
  if (data.created_at) {
    const ts = data.created_at as { toMillis?: () => number }
    createdAt = typeof ts.toMillis === 'function' ? String(ts.toMillis()) : String(data.created_at)
  }
  return {
    id,
    full_name: typeof data.full_name === 'string' ? data.full_name : null,
    role: data.role === 'admin' ? 'admin' : 'user',
    email: typeof data.email === 'string' ? data.email : null,
    phone: typeof data.phone === 'string' ? data.phone : null,
    active: data.active !== false,
    avatar_url: typeof data.avatar_url === 'string' ? data.avatar_url : null,
    fcm_token: typeof data.fcm_token === 'string' ? data.fcm_token : null,
    created_at: createdAt,
  }
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const snap = await getDoc(doc(db, 'profiles', userId))
    if (!snap.exists()) return null
    return parseProfile(snap.id, snap.data())
  } catch (err) {
    console.error('[useAuth] profile fetch failed', err instanceof Error ? err.message : err)
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // useAuth is NOT a shared context — every consumer mounts its own hook
    // instance. A one-time getDoc leaves the UserMenu/Sidebar/Navbar stale after
    // the Profile page edits the doc, so live-subscribe to the profile doc: any
    // name/phone/avatar change propagates to every consumer without a reload.
    const cleanups: (() => void)[] = []
    const unsubscribe = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
      cleanups.forEach((fn) => fn())
      cleanups.length = 0
      if (!fbUser) {
        setUser(null)
        setIsLoading(false)
        return
      }
      const unsubProfile = onSnapshot(
        doc(db, 'profiles', fbUser.uid),
        (snap) => {
          const profile = snap.exists() ? parseProfile(snap.id, snap.data()) : null
          setUser({
            id: fbUser.uid,
            email: fbUser.email ?? '',
            phone: fbUser.phoneNumber ?? null,
            emailVerified: fbUser.emailVerified,
            profile,
          })
          setIsLoading(false)
        },
        (err) => {
          console.error('[useAuth] profile snapshot failed', err instanceof Error ? err.message : err)
          setIsLoading(false)
        }
      )
      cleanups.push(unsubProfile)
    })
    return () => {
      unsubscribe()
      cleanups.forEach((fn) => fn())
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const profile = await fetchProfile(user.id)
    if (profile) setUser((prev) => (prev ? { ...prev, profile } : prev))
  }, [user])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { error: null as null | Error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign-in failed') }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      // Create the profile doc (rules allow users to create their own).
      await setDoc(doc(db, 'profiles', cred.user.uid), {
        full_name: fullName,
        role: 'user',
        email: cred.user.email ?? '',
        active: true,
        created_at: Date.now(),
      })
      return { data: cred, error: null as null | Error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign-up failed') }
    }
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
    setUser(null)
  }, [])

  /** Send a password-reset email (Firebase handles the flow). */
  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      return { error: null as null | Error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Password reset failed') }
    }
  }, [])

  /** Ensure a profile doc exists for a 3rd-party user (Google/Facebook/phone).
   *  Auth rules let users create their own profile; displayName falls back to
   *  the provider name or phone number. */
  const ensureProfile = useCallback(
    async (fbUser: FirebaseUser) => {
      const snap = await getDoc(doc(db, 'profiles', fbUser.uid))
      if (snap.exists()) return
      const fullName =
        fbUser.displayName ||
        (fbUser.phoneNumber ? `User ${fbUser.phoneNumber.slice(-4)}` : fbUser.email?.split('@')[0] || 'User')
      await setDoc(doc(db, 'profiles', fbUser.uid), {
        full_name: fullName,
        role: 'user',
        email: fbUser.email ?? '',
        active: true,
        created_at: Date.now(),
      })
      const profile = await fetchProfile(fbUser.uid)
      setUser({
        id: fbUser.uid,
        email: fbUser.email ?? '',
        phone: fbUser.phoneNumber ?? null,
        emailVerified: fbUser.emailVerified,
        profile,
      })
    },
    []
  )

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      await ensureProfile(cred.user)
      return { error: null as null | Error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Google sign-in failed') }
    }
  }, [ensureProfile])

  const signInWithFacebook = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, new FacebookAuthProvider())
      await ensureProfile(cred.user)
      return { error: null as null | Error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Facebook sign-in failed') }
    }
  }, [ensureProfile])

  /** Start a phone OTP flow. Returns a confirmation result to pass to
   *  confirmPhoneCode(confirmation, code). The recaptcha container must exist
   *  in the DOM (invisible widget). */
  const sendPhoneCode = useCallback(
    async (phoneNumber: string, containerId: string): Promise<{ confirmation: ConfirmationResult | null; error: Error | null }> => {
      try {
        const verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
        const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier)
        return { confirmation, error: null }
      } catch (err) {
        return { confirmation: null, error: err instanceof Error ? err : new Error('Could not send code') }
      }
    },
    []
  )

  const confirmPhoneCode = useCallback(
    async (confirmation: ConfirmationResult, code: string) => {
      try {
        const cred = await confirmation.confirm(code)
        await ensureProfile(cred.user)
        return { error: null as null | Error }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Invalid verification code') }
      }
    },
    [ensureProfile]
  )

  /** Edit the display name on the profile doc. */
  const updateProfileName = useCallback(
    async (fullName: string): Promise<{ error: Error | null }> => {
      if (!user) return { error: new Error('Not signed in') }
      try {
        await updateDoc(doc(db, 'profiles', user.id), { full_name: fullName.trim(), updated_at: Date.now() })
        await refreshProfile()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Could not update name') }
      }
    },
    [user, refreshProfile]
  )

  /** Edit the contact phone on the profile doc (not the sign-in phone). */
  const updateProfilePhone = useCallback(
    async (phone: string): Promise<{ error: Error | null }> => {
      if (!user) return { error: new Error('Not signed in') }
      try {
        await updateDoc(doc(db, 'profiles', user.id), { phone: phone.trim() || null, updated_at: Date.now() })
        await refreshProfile()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Could not update phone') }
      }
    },
    [user, refreshProfile]
  )

  /** Set (or remove) the profile avatar from a base64 data URL. */
  const updateProfileAvatar = useCallback(
    async (avatar: string | null): Promise<{ error: Error | null }> => {
      if (!user) return { error: new Error('Not signed in') }
      try {
        await updateDoc(doc(db, 'profiles', user.id), { avatar_url: avatar || null, updated_at: Date.now() })
        await refreshProfile()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Could not update avatar') }
      }
    },
    [user, refreshProfile]
  )

  /** Step 1 of changing the SIGN-IN phone: send an OTP to the new number.
   *  Unlike sendPhoneCode (which signs in), this only verifies — the code is
   *  applied to the CURRENT user via confirmPhoneUpdate. */
  const sendPhoneUpdateCode = useCallback(
    async (newPhone: string, containerId: string): Promise<{ verificationId: string | null; error: Error | null }> => {
      try {
        const verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
        const confirmation = await signInWithPhoneNumber(auth, newPhone, verifier)
        return { verificationId: confirmation.verificationId, error: null }
      } catch (err) {
        return { verificationId: null, error: err instanceof Error ? err : new Error('Could not send code') }
      }
    },
    []
  )

  /** Step 2: apply the verified new number to the current user's auth account. */
  const confirmPhoneUpdate = useCallback(
    async (verificationId: string, code: string): Promise<{ error: Error | null }> => {
      const fbUser = auth.currentUser
      if (!fbUser) return { error: new Error('Not signed in') }
      try {
        const credential = PhoneAuthProvider.credential(verificationId, code.trim())
        await updatePhoneNumber(fbUser, credential)
        // Keep the profile doc phone in sync with the auth phone.
        await updateDoc(doc(db, 'profiles', fbUser.uid), {
          phone: fbUser.phoneNumber ?? null,
          updated_at: Date.now(),
        }).catch(() => undefined)
        await refreshProfile()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Invalid verification code') }
      }
    },
    [refreshProfile]
  )

  /** Send the account email a verification link (user clicks it in their inbox). */
  const sendVerificationEmail = useCallback(async (): Promise<{ error: Error | null }> => {
    const fbUser = auth.currentUser
    if (!fbUser) return { error: new Error('Not signed in') }
    try {
      await sendEmailVerification(fbUser)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Could not send verification email') }
    }
  }, [])

  /**
   * Permanently delete this account: the user's booking history + slot docs,
   * their profile, then the Firebase Auth record. Rules require recent login
   * for deleteUser — if that fails we tell the user to sign back in and retry.
   */
  const deleteAccount = useCallback(async (): Promise<{ error: Error | null }> => {
    const fbUser = auth.currentUser
    if (!fbUser) return { error: new Error('Not signed in') }
    const uid = fbUser.uid
    try {
      // 1. Booking history (owner-delete allowed by rules) — free their slots.
      const historySnap = await getDocs(query(collection(db, 'booking_history'), where('user_id', '==', uid)))
      for (const d of historySnap.docs) {
        const data = d.data() as { status?: string; resource_id?: string; start_time?: string }
        if (data.status !== 'cancelled' && data.resource_id && data.start_time) {
          await deleteDoc(doc(db, 'bookings', `${data.resource_id}__${data.start_time}`)).catch(() => undefined)
        }
        await deleteDoc(doc(db, 'booking_history', d.id)).catch(() => undefined)
      }
      // 2. Any remaining slot docs.
      const slotSnap = await getDocs(query(collection(db, 'bookings'), where('user_id', '==', uid)))
      for (const d of slotSnap.docs) {
        await deleteDoc(doc(db, 'bookings', d.id)).catch(() => undefined)
      }
      // 3. Profile doc.
      await deleteDoc(doc(db, 'profiles', uid)).catch(() => undefined)
      // 4. The auth account itself.
      await deleteUser(fbUser)
      setUser(null)
      return { error: null }
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/requires-recent-login') {
        return { error: new Error('recent-login') }
      }
      return { error: err instanceof Error ? err : new Error('Could not delete account') }
    }
  }, [])

  const isAdmin = user?.profile?.role === 'admin'

  return {
    user,
    profile: user?.profile ?? null,
    isAdmin,
    isLoading,
    refreshProfile,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    signInWithGoogle,
    signInWithFacebook,
    sendPhoneCode,
    confirmPhoneCode,
    sendVerificationEmail,
    deleteAccount,
    updateProfileName,
    updateProfilePhone,
    updateProfileAvatar,
    sendPhoneUpdateCode,
    confirmPhoneUpdate,
  }
}
