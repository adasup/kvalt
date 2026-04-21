export interface ParsedItem {
  name: string
  rawText?: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
  matchType: 'MATCHED' | 'ESTIMATED' | 'MANUAL'
  matchedPriceItem?: string
  category?: string
}

export interface PriceItemCompact {
  name: string
  unit: string
  avgPrice: number
  category?: string | null
}

function buildPrompt(text: string, priceItems: PriceItemCompact[]): string {
  const compact = priceItems.map((p) => ({
    n: p.name,
    mj: p.unit,
    cena: p.avgPrice,
    kat: p.category,
  }))

  return `Jsi asistent pro tvorbu stavebních rozpočtů v Česku. Dostaneš nadiktovaný text a ceník položek.

NADIKTOVANÝ TEXT:
"""
${text}
"""

CENÍK (zkrácený JSON — n=název, mj=měrná jednotka, cena=průměrná cena Kč, kat=kategorie):
${JSON.stringify(compact)}

ÚKOL:
1. Rozparsuj nadiktovaný text na jednotlivé položky rozpočtu.
2. Pro každou urči: normalizovaný název, množství, měrnou jednotku (m2, ks, mb, soub., kpl, bm, den).
3. Spáruj s ceníkem — hledej nejbližší shodu. Pozor na českou morfologii, hovorové výrazy (umejvák=umyvadlo, kachlíky=obklad, záchod=WC), zkratky.
4. Pokud položka je v ceníku, použij její cenu. Pokud ne, odhadni cenu na základě znalosti českého stavebního trhu 2024-2026.
5. Pokud množství není uvedeno, dej 1.

Vrať POUZE validní JSON pole (žádný markdown, žádné backticky, žádný komentář):
[{"name":"...","rawText":"...","unit":"m2","quantity":25,"unitPrice":890,"totalPrice":22250,"matchType":"matched","matchedPriceItem":"...","category":"..."}]

matchType je "matched" pokud odpovídá ceníku, "estimated" pokud odhaduješ.`
}

export type ClaudeFn = (text: string, priceItems: PriceItemCompact[]) => Promise<ParsedItem[]>

export type DiaryClaudeFn = (rawText: string) => Promise<string>

export function createDiaryClaudeFn(apiKey: string, fetchFn: typeof fetch = fetch): DiaryClaudeFn {
  return async (rawText) => {
    const res = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Jsi asistent pro stavební deník v Česku. Dostaneš surový text zápisu a vrátíš ho ve strukturované, profesionální formě pro stavební deník. Zachovej všechny fakta, pouze uprav formát a jazyk. Odpověz POUZE textem zápisu, bez úvodu ani komentáře.\n\nSUROMÝ TEXT:\n"""\n${rawText}\n"""`,
          },
        ],
      }),
    })

    if (!res.ok) throw new Error(`Claude API error ${res.status}`)

    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()
  }
}

export function createClaudeFn(apiKey: string, fetchFn: typeof fetch = fetch): ClaudeFn {
  return async (text, priceItems) => {
    const res = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(text, priceItems) }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`Claude API error ${res.status}: ${err.error?.message ?? res.statusText}`)
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>
    }

    const raw = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(raw) as Array<{
      name: string
      rawText?: string
      unit: string
      quantity: number
      unitPrice: number
      totalPrice: number
      matchType: string
      matchedPriceItem?: string
      category?: string
    }>

    return parsed.map((item): ParsedItem => ({
      name: item.name,
      rawText: item.rawText,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      matchType: (item.matchType.toUpperCase() as 'MATCHED' | 'ESTIMATED') ?? 'ESTIMATED',
      matchedPriceItem: item.matchedPriceItem,
      category: item.category,
    }))
  }
}
