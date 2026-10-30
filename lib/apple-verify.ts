/**
 * Offline verification of App Store signed data (JWS) for the iPhone lifetime
 * unlock (spec 2026-10-13 §6). Server only.
 *
 * The signature chain is checked against Apple's root certificates, embedded
 * in lib/apple-root-certs.ts. No App Store Connect API key is needed.
 * Production is tried first; TestFlight and App Review use the Sandbox, so an
 * INVALID_ENVIRONMENT result falls back to the Sandbox verifier.
 */
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'
import { APPLE_ROOT_CERTS_BASE64 } from '@/lib/apple-root-certs'

export const APPLE_BUNDLE_ID = 'com.mandarineer.app'
export const APPLE_APP_ID = 6803774095
export const APPLE_LIFETIME_PRODUCT_ID = 'com.mandarineer.app.lifetime'

let verifiers: SignedDataVerifier[] | null = null

function getVerifiers(): SignedDataVerifier[] {
  if (!verifiers) {
    const roots = APPLE_ROOT_CERTS_BASE64.map((b64) => Buffer.from(b64, 'base64'))
    verifiers = [
      new SignedDataVerifier(roots, false, Environment.PRODUCTION, APPLE_BUNDLE_ID, APPLE_APP_ID),
      new SignedDataVerifier(roots, false, Environment.SANDBOX, APPLE_BUNDLE_ID),
    ]
  }
  return verifiers
}

/** Runs `fn` with the Production verifier, then the Sandbox one when the data is from the other environment. */
async function withEnvironmentFallback<T>(fn: (v: SignedDataVerifier) => Promise<T>): Promise<T> {
  const [production, sandbox] = getVerifiers()
  try {
    return await fn(production)
  } catch (err) {
    if (err instanceof VerificationException && err.status === VerificationStatus.INVALID_ENVIRONMENT) {
      return fn(sandbox)
    }
    throw err
  }
}

export function verifyTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  return withEnvironmentFallback((v) => v.verifyAndDecodeTransaction(jws))
}

export function verifyNotification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload> {
  return withEnvironmentFallback((v) => v.verifyAndDecodeNotification(signedPayload))
}

/** Our one product, non-consumable, not revoked. */
export function isValidLifetimeTransaction(tx: JWSTransactionDecodedPayload): boolean {
  return (
    tx.productId === APPLE_LIFETIME_PRODUCT_ID &&
    tx.type === 'Non-Consumable' &&
    !tx.revocationDate &&
    typeof tx.originalTransactionId === 'string' &&
    tx.originalTransactionId.length > 0
  )
}

/** Family Sharing is on for the product: a family member's copy of the purchase. */
export function isFamilyShared(tx: JWSTransactionDecodedPayload): boolean {
  return tx.inAppOwnershipType === 'FAMILY_SHARED'
}
