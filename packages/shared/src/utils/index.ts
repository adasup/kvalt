export function getWeekDates(isoWeek: string): Date[] {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek)
  if (!match) throw new Error(`Invalid week format: ${isoWeek}`)
  const year = parseInt(match[1]!)
  const week = parseInt(match[2]!)

  // Use UTC to avoid timezone shift when formatting with toISOString()
  const jan4 = Date.UTC(year, 0, 4)
  const jan4Day = new Date(jan4).getUTCDay() // 0=Sun
  const mondayOfWeek1 = jan4 - ((jan4Day + 6) % 7) * 86_400_000
  const mondayMs = mondayOfWeek1 + (week - 1) * 7 * 86_400_000

  return Array.from({ length: 7 }, (_, i) => new Date(mondayMs + i * 86_400_000))
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isHoliday(date: Date): boolean {
  const czHolidays = [
    '01-01', '05-01', '05-08', '07-05', '07-06',
    '09-28', '10-28', '11-17', '12-24', '12-25', '12-26',
  ]
  const mmdd = date.toISOString().slice(5, 10)
  return czHolidays.includes(mmdd)
}
