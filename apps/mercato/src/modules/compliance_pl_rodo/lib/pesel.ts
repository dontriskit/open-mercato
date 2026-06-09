// PESEL checksum validator — Polish national identification number.
// Weighted checksum: weights 1,3,7,9,1,3,7,9,1,3 over the first 10 digits,
// summed mod 10, then (10 - mod) mod 10 must equal the 11th control digit.
// Rejects values that are not exactly 11 numeric digits.
const WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]

export function isValidPesel(value: string): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{11}$/.test(value)) return false
  const digits = value.split('').map((d) => Number(d))
  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * WEIGHTS[i]
  }
  const control = (10 - (sum % 10)) % 10
  return control === digits[10]
}
