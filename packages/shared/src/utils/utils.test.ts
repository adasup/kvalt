import { describe, it, expect } from 'vitest'
import { getWeekDates, formatDate, isHoliday } from './index.js'

describe('getWeekDates', () => {
  it('returns 7 dates for a valid ISO week', () => {
    const dates = getWeekDates('2026-W17')
    expect(dates).toHaveLength(7)
  })

  it('returns Monday as first day', () => {
    const dates = getWeekDates('2026-W17')
    expect(dates[0]!.getDay()).toBe(1) // Monday
  })

  it('throws on invalid format', () => {
    expect(() => getWeekDates('2026-17')).toThrow()
  })
})

describe('isHoliday', () => {
  it('identifies Czech public holidays', () => {
    expect(isHoliday(new Date('2026-01-01'))).toBe(true)  // Nový rok
    expect(isHoliday(new Date('2026-05-01'))).toBe(true)  // Svátek práce
    expect(isHoliday(new Date('2026-12-25'))).toBe(true)  // 1. svátek vánoční
  })

  it('returns false for regular days', () => {
    expect(isHoliday(new Date('2026-04-21'))).toBe(false)
    expect(isHoliday(new Date('2026-03-15'))).toBe(false)
  })
})
