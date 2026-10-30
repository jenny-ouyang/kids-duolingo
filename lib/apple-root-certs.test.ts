import { X509Certificate } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { APPLE_ROOT_CERTS_BASE64 } from './apple-root-certs'

// Guards the embedded certificates: a bad paste or a truncated regenerate fails here.
describe('embedded Apple root certificates', () => {
  it('parse as the three Apple roots, G3 included, still valid', () => {
    const certs = APPLE_ROOT_CERTS_BASE64.map((b64) => new X509Certificate(Buffer.from(b64, 'base64')))
    const names = certs.map((c) => c.subject.match(/CN=([^\n]+)/)?.[1]).sort()
    expect(names).toEqual(['Apple Root CA', 'Apple Root CA - G2', 'Apple Root CA - G3'])
    for (const c of certs) {
      expect(c.ca).toBe(true)
      expect(new Date(c.validTo).getTime()).toBeGreaterThan(Date.now())
    }
    const g3 = certs.find((c) => c.subject.includes('G3'))!
    expect(g3.fingerprint256).toBe(
      '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79'
    )
  })
})
