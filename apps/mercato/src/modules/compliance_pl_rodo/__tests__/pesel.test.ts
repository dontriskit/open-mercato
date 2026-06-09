import { isValidPesel } from '../lib/pesel'

describe('isValidPesel', () => {
  it('accepts known-valid PESELs', () => {
    expect(isValidPesel('44051401359')).toBe(true)
    expect(isValidPesel('02030571325')).toBe(true)
    expect(isValidPesel('99091961653')).toBe(true)
  })

  it('rejects a wrong control digit', () => {
    expect(isValidPesel('44051401358')).toBe(false)
    expect(isValidPesel('02030571320')).toBe(false)
  })

  it('rejects non-11-digit / non-numeric values', () => {
    expect(isValidPesel('')).toBe(false)
    expect(isValidPesel('123')).toBe(false)
    expect(isValidPesel('440514013590')).toBe(false)
    expect(isValidPesel('4405140135a')).toBe(false)
    // @ts-expect-error guarding non-string input
    expect(isValidPesel(44051401359)).toBe(false)
  })
})
