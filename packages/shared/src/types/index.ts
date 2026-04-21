// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'FOREMAN' | 'WORKER'

export type ProjectStatus =
  | 'OFFER'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'HANDOVER'
  | 'INVOICED'
  | 'PAID'
  | 'CANCELLED'

export type AssignmentStatus =
  | 'PLANNED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type BudgetStatus = 'DRAFT' | 'DONE'

export type AttendanceType = 'REGULAR' | 'OVERTIME' | 'WEEKEND' | 'HOLIDAY' | 'TRAVEL'

export type InvoiceType = 'ADVANCE' | 'FINAL'

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE'

export type MatchType = 'MATCHED' | 'ESTIMATED' | 'MANUAL'

export type NotificationType = 'tomorrow_assignment' | 'attendance_reminder' | 'approval_needed'

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  ico: string
  dic?: string
  address?: string
  logoUrl?: string
  settings?: Record<string, unknown>
  zitadelOrgId: string
  createdAt: string
}

export interface User {
  id: string
  companyId: string
  zitadelUserId: string
  fullName: string
  email: string
  phone?: string
  role: UserRole
  hourlyRate: number
  overtimeRatePercent: number
  weekendRatePercent: number
  holidayRatePercent: number
  pushToken?: string
  isActive: boolean
  createdAt: string
}

export interface Team {
  id: string
  companyId: string
  name: string
  leaderId?: string
  color?: string
  createdAt: string
}

export interface TeamMember {
  teamId: string
  userId: string
}

export interface Project {
  id: string
  companyId: string
  name: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  clientIco?: string
  address?: string
  status: ProjectStatus
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Assignment {
  id: string
  companyId: string
  projectId: string
  date: string
  teamId?: string
  userId?: string
  status: AssignmentStatus
  startTime: string
  endTime: string
  description?: string
  notes?: string
  notificationSent: boolean
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  companyId: string
  projectId?: string
  name: string
  status: BudgetStatus
  vatRate: number
  totalWithoutVat: number
  createdAt: string
  updatedAt: string
}

export interface BudgetItem {
  id: string
  budgetId: string
  name: string
  rawText?: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
  matchType: MatchType
  matchedPriceItem?: string
  category?: string
  sortOrder: number
}

export interface Transcript {
  id: string
  budgetId: string
  text: string
  wordCount: number
  createdAt: string
}

export interface PriceList {
  id: string
  companyId: string
  name: string
  source: string
  createdAt: string
}

export interface PriceListItem {
  id: string
  priceListId: string
  name: string
  unit: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  occurrences: number
  category?: string
  projects: string[]
}

export interface Attendance {
  id: string
  userId: string
  projectId: string
  assignmentId?: string
  date: string
  checkIn: string
  checkOut?: string
  type: AttendanceType
  breakMinutes: number
  hoursWorked?: number
  earnings?: number
  approved: boolean
  approvedById?: string
  notes?: string
  offlineCreated: boolean
  createdAt: string
}

export interface DiaryEntry {
  id: string
  projectId: string
  authorId: string
  date: string
  weather?: string
  temperature?: number
  description: string
  workersPresent: number
  createdAt: string
}

export interface DiaryPhoto {
  id: string
  diaryEntryId: string
  storagePath: string
  caption?: string
}

export interface ExtraWork {
  id: string
  projectId: string
  description: string
  scope?: string
  estimatedPrice?: number
  approvedByClient: boolean
  createdAt: string
}

export interface ProjectPhoto {
  id: string
  projectId: string
  storagePath: string
  caption?: string
  createdAt: string
}

export interface Invoice {
  id: string
  companyId: string
  projectId?: string
  invoiceNumber: string
  type: InvoiceType
  dateIssued: string
  dateDue: string
  datePaid?: string
  totalWithoutVat: number
  vatAmount: number
  totalWithVat: number
  status: InvoiceStatus
  clientName: string
  clientAddress?: string
  clientIco?: string
  clientDic?: string
  pdfStoragePath?: string
  createdAt: string
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  name: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
  totalPrice: number
}

export interface Subcontractor {
  id: string
  companyId: string
  name: string
  ico?: string
  contactPerson?: string
  phone?: string
  email?: string
  trade?: string
  createdAt: string
}

export interface Equipment {
  id: string
  companyId: string
  name: string
  type?: string
  licensePlate?: string
  stkDate?: string
  insuranceDate?: string
  notes?: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  read: boolean
  sentAt: string
}

// ─── API Context ──────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string
  companyId: string
  role: UserRole
  zitadelUserId: string
  zitadelOrgId: string
}
