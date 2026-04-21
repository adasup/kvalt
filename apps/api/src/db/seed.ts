import { createDb } from './client.js'
import { companies, users, priceLists, priceListItems } from './schema.js'
import defaultCenik from '../../../../data/default-cenik.json' assert { type: 'json' }

const DATABASE_URL = process.env['DATABASE_URL']
if (!DATABASE_URL) throw new Error('DATABASE_URL is required')

const db = createDb(DATABASE_URL)

async function seed() {
  console.log('Seeding database...')

  // Demo company
  const [company] = await db
    .insert(companies)
    .values({
      name: 'Demo Stavby s.r.o.',
      ico: '12345678',
      dic: 'CZ12345678',
      address: 'Václavské náměstí 1, 110 00 Praha 1',
      zitadelOrgId: 'demo-org-id',
    })
    .returning()

  if (!company) throw new Error('Failed to create company')
  console.log('Created company:', company.name)

  // Admin user
  await db.insert(users).values({
    companyId: company.id,
    zitadelUserId: 'demo-admin-zitadel-id',
    fullName: 'Jan Novák',
    email: 'admin@demo-stavby.cz',
    role: 'ADMIN',
    hourlyRate: 350,
  })

  // Default price list
  const [priceList] = await db
    .insert(priceLists)
    .values({
      companyId: company.id,
      name: 'Výchozí ceník',
      source: 'json',
    })
    .returning()

  if (!priceList) throw new Error('Failed to create price list')

  // Insert ceník items in batches
  const items = (defaultCenik as Array<{
    nazev: string
    mj: string
    cena_prumer: number
    cena_min: number
    cena_max: number
    pocet_vyskytu: number
    sekce?: string
    sekce_norm?: string
    projekty?: string[]
  }>)

  const batchSize = 100
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map((item) => ({
      priceListId: priceList.id,
      name: item.nazev,
      unit: item.mj,
      avgPrice: item.cena_prumer,
      minPrice: item.cena_min,
      maxPrice: item.cena_max,
      occurrences: item.pocet_vyskytu,
      category: item.sekce_norm ?? item.sekce,
      projects: item.projekty ?? [],
    }))
    await db.insert(priceListItems).values(batch)
  }

  console.log(`Seeded ${items.length} price list items`)
  console.log('Done!')
}

seed().catch(console.error)
