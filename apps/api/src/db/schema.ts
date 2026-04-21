import {
  pgTable,
  text,
  integer,
  boolean,
  real,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  json,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'FOREMAN', 'WORKER'])

export const projectStatusEnum = pgEnum('project_status', [
  'OFFER',
  'APPROVED',
  'IN_PROGRESS',
  'HANDOVER',
  'INVOICED',
  'PAID',
  'CANCELLED',
])

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'PLANNED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
])

export const budgetStatusEnum = pgEnum('budget_status', ['DRAFT', 'DONE'])

export const attendanceTypeEnum = pgEnum('attendance_type', [
  'REGULAR',
  'OVERTIME',
  'WEEKEND',
  'HOLIDAY',
  'TRAVEL',
])

export const invoiceTypeEnum = pgEnum('invoice_type', ['ADVANCE', 'FINAL'])

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'DRAFT',
  'ISSUED',
  'PAID',
  'OVERDUE',
])

export const matchTypeEnum = pgEnum('match_type', ['MATCHED', 'ESTIMATED', 'MANUAL'])

export const notificationTypeEnum = pgEnum('notification_type', [
  'tomorrow_assignment',
  'attendance_reminder',
  'approval_needed',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const companies = pgTable('companies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ico: text('ico').notNull(),
  dic: text('dic'),
  address: text('address'),
  logoUrl: text('logo_url'),
  settings: json('settings').$type<Record<string, unknown>>(),
  zitadelOrgId: text('zitadel_org_id').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  zitadelUserId: text('zitadel_user_id').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('WORKER'),
  hourlyRate: real('hourly_rate').notNull().default(0),
  overtimeRatePercent: integer('overtime_rate_percent').notNull().default(25),
  weekendRatePercent: integer('weekend_rate_percent').notNull().default(10),
  holidayRatePercent: integer('holiday_rate_percent').notNull().default(100),
  pushToken: text('push_token'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const teams = pgTable('teams', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  leaderId: text('leader_id').references(() => users.id),
  color: text('color'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
)

export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  clientName: text('client_name'),
  clientEmail: text('client_email'),
  clientPhone: text('client_phone'),
  clientIco: text('client_ico'),
  address: text('address'),
  status: projectStatusEnum('status').notNull().default('OFFER'),
  plannedStart: text('planned_start'),
  plannedEnd: text('planned_end'),
  actualStart: text('actual_start'),
  actualEnd: text('actual_end'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    teamId: text('team_id').references(() => teams.id),
    userId: text('user_id').references(() => users.id),
    status: assignmentStatusEnum('status').notNull().default('PLANNED'),
    startTime: text('start_time').notNull().default('07:00'),
    endTime: text('end_time').notNull().default('16:00'),
    description: text('description'),
    notes: text('notes'),
    notificationSent: boolean('notification_sent').notNull().default(false),
    createdById: text('created_by_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('assignments_date_idx').on(t.date),
    index('assignments_project_date_idx').on(t.projectId, t.date),
    index('assignments_user_date_idx').on(t.userId, t.date),
    index('assignments_team_date_idx').on(t.teamId, t.date),
  ],
)

export const budgets = pgTable('budgets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id),
  name: text('name').notNull(),
  status: budgetStatusEnum('status').notNull().default('DRAFT'),
  vatRate: real('vat_rate').notNull().default(21),
  totalWithoutVat: real('total_without_vat').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const budgetItems = pgTable('budget_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  budgetId: text('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  rawText: text('raw_text'),
  unit: text('unit').notNull(),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalPrice: real('total_price').notNull(),
  matchType: matchTypeEnum('match_type').notNull().default('MANUAL'),
  matchedPriceItem: text('matched_price_item'),
  category: text('category'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const transcripts = pgTable('transcripts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  budgetId: text('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  wordCount: integer('word_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const priceLists = pgTable('price_lists', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const priceListItems = pgTable('price_list_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  priceListId: text('price_list_id').notNull().references(() => priceLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  avgPrice: real('avg_price').notNull(),
  minPrice: real('min_price').notNull(),
  maxPrice: real('max_price').notNull(),
  occurrences: integer('occurrences').notNull().default(1),
  category: text('category'),
  projects: json('projects').$type<string[]>().notNull().default([]),
})

export const attendance = pgTable(
  'attendance',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull().references(() => projects.id),
    assignmentId: text('assignment_id').references(() => assignments.id),
    date: text('date').notNull(),
    checkIn: text('check_in').notNull(),
    checkOut: text('check_out'),
    type: attendanceTypeEnum('type').notNull().default('REGULAR'),
    breakMinutes: integer('break_minutes').notNull().default(0),
    hoursWorked: real('hours_worked'),
    earnings: real('earnings'),
    approved: boolean('approved').notNull().default(false),
    approvedById: text('approved_by_id').references(() => users.id),
    notes: text('notes'),
    offlineCreated: boolean('offline_created').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('attendance_user_date_idx').on(t.userId, t.date),
    index('attendance_project_date_idx').on(t.projectId, t.date),
  ],
)

export const diaryEntries = pgTable('diary_entries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  weather: text('weather'),
  temperature: real('temperature'),
  description: text('description').notNull(),
  workersPresent: integer('workers_present').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const diaryPhotos = pgTable('diary_photos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  diaryEntryId: text('diary_entry_id').notNull().references(() => diaryEntries.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  caption: text('caption'),
})

export const extraWorks = pgTable('extra_works', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  scope: text('scope'),
  estimatedPrice: real('estimated_price'),
  approvedByClient: boolean('approved_by_client').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const projectPhotos = pgTable('project_photos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id),
  invoiceNumber: text('invoice_number').notNull(),
  type: invoiceTypeEnum('type').notNull(),
  dateIssued: text('date_issued').notNull(),
  dateDue: text('date_due').notNull(),
  datePaid: text('date_paid'),
  totalWithoutVat: real('total_without_vat').notNull(),
  vatAmount: real('vat_amount').notNull(),
  totalWithVat: real('total_with_vat').notNull(),
  status: invoiceStatusEnum('status').notNull().default('DRAFT'),
  clientName: text('client_name').notNull(),
  clientAddress: text('client_address'),
  clientIco: text('client_ico'),
  clientDic: text('client_dic'),
  pdfStoragePath: text('pdf_storage_path'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  vatRate: real('vat_rate').notNull(),
  totalPrice: real('total_price').notNull(),
})

export const subcontractors = pgTable('subcontractors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ico: text('ico'),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  trade: text('trade'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const equipment = pgTable('equipment', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type'),
  licensePlate: text('license_plate'),
  stkDate: text('stk_date'),
  insuranceDate: text('insurance_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: json('data').$type<Record<string, unknown>>(),
  read: boolean('read').notNull().default(false),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  teams: many(teams),
  projects: many(projects),
  budgets: many(budgets),
  priceLists: many(priceLists),
  assignments: many(assignments),
  invoices: many(invoices),
  subcontractors: many(subcontractors),
  equipment: many(equipment),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  teamMemberships: many(teamMembers),
  attendance: many(attendance),
  notifications: many(notifications),
}))

export const teamsRelations = relations(teams, ({ one, many }) => ({
  company: one(companies, { fields: [teams.companyId], references: [companies.id] }),
  leader: one(users, { fields: [teams.leaderId], references: [users.id] }),
  members: many(teamMembers),
  assignments: many(assignments),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  company: one(companies, { fields: [projects.companyId], references: [companies.id] }),
  budgets: many(budgets),
  assignments: many(assignments),
  attendance: many(attendance),
  diaryEntries: many(diaryEntries),
  extraWorks: many(extraWorks),
  photos: many(projectPhotos),
  invoices: many(invoices),
}))

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  company: one(companies, { fields: [assignments.companyId], references: [companies.id] }),
  project: one(projects, { fields: [assignments.projectId], references: [projects.id] }),
  team: one(teams, { fields: [assignments.teamId], references: [teams.id] }),
  user: one(users, { fields: [assignments.userId], references: [users.id] }),
  createdBy: one(users, { fields: [assignments.createdById], references: [users.id] }),
  attendance: many(attendance),
}))

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  company: one(companies, { fields: [budgets.companyId], references: [companies.id] }),
  project: one(projects, { fields: [budgets.projectId], references: [projects.id] }),
  items: many(budgetItems),
  transcripts: many(transcripts),
}))

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, { fields: [attendance.userId], references: [users.id] }),
  project: one(projects, { fields: [attendance.projectId], references: [projects.id] }),
  assignment: one(assignments, { fields: [attendance.assignmentId], references: [assignments.id] }),
  approvedBy: one(users, { fields: [attendance.approvedById], references: [users.id] }),
}))
