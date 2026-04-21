import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout.js'
import { LoginPage } from './pages/LoginPage.js'
import { AuthCallbackPage } from './pages/AuthCallbackPage.js'
import { DashboardPage } from './pages/Dashboard/DashboardPage.js'
import { BudgetsPage } from './pages/Budgets/BudgetsPage.js'
import { BudgetDetailPage } from './pages/Budgets/BudgetDetailPage.js'
import { ProjectsPage } from './pages/Projects/ProjectsPage.js'
import { ProjectDetailPage } from './pages/Projects/ProjectDetailPage.js'
import { TeamsPage } from './pages/Teams/TeamsPage.js'
import { WeekViewPage } from './pages/Planning/WeekViewPage.js'
import { AttendancePage } from './pages/Attendance/AttendancePage.js'
import { DiaryPage } from './pages/Diary/DiaryPage.js'
import { InvoicesPage } from './pages/Invoices/InvoicesPage.js'
import { ReportsPage } from './pages/Reports/ReportsPage.js'
import { getToken } from './lib/auth.js'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />
}

function Guarded({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route path="/" element={<Guarded><Navigate to="/dashboard" replace /></Guarded>} />
        <Route path="/dashboard" element={<Guarded><DashboardPage /></Guarded>} />
        <Route path="/projects" element={<Guarded><ProjectsPage /></Guarded>} />
        <Route path="/projects/:id" element={<Guarded><ProjectDetailPage /></Guarded>} />
        <Route path="/planning" element={<Guarded><WeekViewPage /></Guarded>} />
        <Route path="/attendance" element={<Guarded><AttendancePage /></Guarded>} />
        <Route path="/budgets" element={<Guarded><BudgetsPage /></Guarded>} />
        <Route path="/budgets/:id" element={<Guarded><BudgetDetailPage /></Guarded>} />
        <Route path="/diary" element={<Guarded><DiaryPage /></Guarded>} />
        <Route path="/invoices" element={<Guarded><InvoicesPage /></Guarded>} />
        <Route path="/reports" element={<Guarded><ReportsPage /></Guarded>} />
        <Route path="/teams" element={<Guarded><TeamsPage /></Guarded>} />
      </Routes>
    </BrowserRouter>
  )
}
