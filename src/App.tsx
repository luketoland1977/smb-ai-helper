import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ClientForm from "./pages/ClientForm";
import AgentForm from "./pages/AgentForm";
import Chat from "./pages/Chat";
import KnowledgeBase from "./pages/KnowledgeBase";
import ChatWidgetManager from "./pages/ChatWidgetManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson', 'support']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/clients/new" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson']}>
                  <ClientForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/clients/:id" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson']}>
                  <ClientForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/clients/:clientId/knowledge-base" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson', 'support']}>
                  <KnowledgeBase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/agents/new" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson']}>
                  <AgentForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/agents/:id" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson']}>
                  <AgentForm />
                </ProtectedRoute>
              } 
            />
            <Route path="/chat/:agentId" element={<Chat />} />
            <Route 
              path="/widgets" 
              element={
                <ProtectedRoute roles={['admin', 'salesperson']}>
                  <ChatWidgetManager />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
