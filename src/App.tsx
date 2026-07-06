// WEES — Diário de Obra Pro
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeApplicator } from "@/components/shared/ThemeApplicator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClientAuthProvider } from "@/contexts/ClientAuthContext";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import SalesPage from "@/pages/SalesPage";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ClientReportView from "@/pages/ClientReportView";
import ClientLogin from "@/pages/ClientLogin";
import InitialSetup from "@/pages/InitialSetup";
import Diagnostico from "@/pages/Diagnostico";
import OAuthConsent from "@/pages/OAuthConsent";

// Client Portal
import ClientDashboard from "@/pages/client/ClientDashboard";
import ClientProfile from "@/pages/client/ClientProfile";
import ClientReports from "@/pages/client/ClientReports";
import ClientActivityList from "@/pages/client/ClientActivityList";
import ClientPortalPicker from "@/pages/client/ClientPortalPicker";
import ClientPortalUsers from "@/pages/client/ClientPortalUsers";

import { ClientProtectedRoute } from "@/components/client/ClientProtectedRoute";
import { HomeRedirect } from "@/components/HomeRedirect";
import AdminExports from "@/pages/AdminExports";
import AdminSignatures from "@/pages/AdminSignatures";
import AdminBackup from "@/pages/AdminBackup";
import AdminDataQuality from "@/pages/AdminDataQuality";
import ImpactMetrics from "@/pages/ImpactMetrics";
import ApiKeysPage from "@/pages/admin/ApiKeys";

import Reports from "@/pages/Reports";
import ReportForm from "@/pages/ReportForm";
import ReportDetail from "@/pages/ReportDetail";
import QuickReportWizard from "@/pages/QuickReportWizard";
import ServiceReportBuilder from "@/pages/ServiceReportBuilder";
import ServiceReportEditor from "@/pages/ServiceReportEditor";
import SimplifiedReportForm from "@/pages/SimplifiedReportForm";

import ProjectCalendar from "@/pages/ProjectCalendar";

import TeamDetails from "@/pages/TeamDetails";
import Teams from "@/pages/Teams";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import SuperAdminPanel from "@/pages/SuperAdminPanel";
import CompanyDashboard from "@/pages/CompanyDashboard";
import SiteDashboard from "@/pages/SiteDashboard";
import SuggestionsRoadmap from "@/pages/SuggestionsRoadmap";
import WorkforceDatabase from "@/pages/WorkforceDatabase";
import AIAssistant from "@/pages/AIAssistant";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { GlobalErrorListener } from "@/components/shared/GlobalErrorListener";


const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <GlobalErrorListener />
          <AuthProvider>
            <ThemeApplicator />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/pv" element={<SalesPage />} />
                <Route path="/diagnostico" element={<Diagnostico />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/setup" element={<InitialSetup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/client/report/:accessToken" element={<ClientReportView />} />
                

                {/* Client Portal routes */}
                <Route path="/client/login" element={<Navigate to="/login" replace />} />
                
                <Route path="/client/dashboard" element={<ClientAuthProvider><ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute></ClientAuthProvider>} />
                <Route path="/client/reports" element={<ClientAuthProvider><ClientProtectedRoute><ClientReports /></ClientProtectedRoute></ClientAuthProvider>} />
                <Route path="/client/reports/:reportId" element={<ClientAuthProvider><ClientProtectedRoute><ClientReportView /></ClientProtectedRoute></ClientAuthProvider>} />
                <Route path="/client/activity/:projectId" element={<ClientAuthProvider><ClientProtectedRoute><ClientActivityList /></ClientProtectedRoute></ClientAuthProvider>} />
                
                
                <Route path="/client/profile" element={<ClientAuthProvider><ClientProtectedRoute><ClientProfile /></ClientProtectedRoute></ClientAuthProvider>} />
                <Route path="/client/users" element={<ClientAuthProvider><ClientProtectedRoute><ClientPortalUsers /></ClientProtectedRoute></ClientAuthProvider>} />
                <Route path="/client/rewards" element={<Navigate to="/client/dashboard" replace />} />
                <Route path="/client/signatures" element={<Navigate to="/client/dashboard" replace />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                  <Route path="/home" element={<HomeRedirect />} />
                  <Route path="/admin/exports" element={<AdminExports />} />
                  <Route path="/admin/signatures" element={<AdminSignatures />} />
                  <Route path="/admin/backup" element={<AdminBackup />} />
                  <Route path="/admin/data-quality" element={<AdminDataQuality />} />
                  <Route path="/admin/impact" element={<ImpactMetrics />} />
                  <Route path="/admin/api-keys" element={<SuperAdminRoute><ApiKeysPage /></SuperAdminRoute>} />
                  
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/new" element={<QuickReportWizard />} />
                  <Route path="/reports/create/:projectId" element={<SimplifiedReportForm />} />
                  <Route path="/reports/full/new" element={<ReportForm />} />
                  <Route path="/reports/:id" element={<ReportDetail />} />
                  <Route path="/reports/:id/edit" element={<ReportForm />} />
                  <Route path="/reports/:reportId/edit-simple" element={<SimplifiedReportForm />} />
                  
                  {/* Service Reports */}
                  <Route path="/service-reports" element={<ServiceReportBuilder />} />
                  
                  {/* Hierarchical routes - Redirecionam para o wizard que centraliza a gestão */}
                  <Route path="/companies-manage" element={<Navigate to="/reports/new" replace />} />
                  <Route path="/companies/:companyId" element={<Navigate to="/reports/new" replace />} />
                  <Route path="/sites/:siteId" element={<Navigate to="/reports/new" replace />} />
                  <Route path="/sites/:siteId/dashboard" element={<SiteDashboard />} />
                  <Route path="/projects/:projectId" element={<ProjectCalendar />} />
                  
                  <Route path="/teams/:teamId" element={<TeamDetails />} />
                  
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/suggestions" element={<SuggestionsRoadmap />} />
                  <Route path="/workforce-database" element={<WorkforceDatabase />} />
                  <Route path="/ai-assistant" element={<AIAssistant />} />
                  <Route path="/client/select" element={<ClientPortalPicker />} />

                  {/* Super Admin routes */}
                  <Route path="/super-admin" element={<SuperAdminPanel />} />
                  <Route path="/companies/:companyId/dashboard" element={<CompanyDashboard />} />
                </Route>

                {/* Service Report Editor - standalone (no MainLayout) */}
                <Route path="/service-reports/:id/edit" element={<ProtectedRoute><ServiceReportEditor /></ProtectedRoute>} />

                {/* Fallback p/ rotas internas reservadas que possam cair no catch-all */}
                <Route path="/admin/*" element={<Navigate to="/home" replace />} />

                {/* Client portal catch-all routes (must be last) */}
                <Route path="/:slug/c/:contactId" element={<ClientLogin />} />
                <Route path="/:slug/:siteId/c/:contactId" element={<ClientLogin />} />
                <Route path="/:slug" element={<ClientLogin />} />
                <Route path="/:slug/:siteId" element={<ClientLogin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;