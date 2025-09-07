import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ClientForm from "./pages/ClientForm";
import AgentForm from "./pages/AgentForm";
import Chat from "./pages/Chat";
import KnowledgeBase from "./pages/KnowledgeBase";
import ChatWidgetManager from "./pages/ChatWidgetManager";
import NotFound from "./pages/NotFound";
import PasswordProtection from "./components/PasswordProtection";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<PasswordProtection><Dashboard /></PasswordProtection>} />
          <Route path="/clients/new" element={<PasswordProtection><ClientForm /></PasswordProtection>} />
          <Route path="/clients/:id" element={<PasswordProtection><ClientForm /></PasswordProtection>} />
          <Route path="/clients/:clientId/knowledge-base" element={<PasswordProtection><KnowledgeBase /></PasswordProtection>} />
          <Route path="/agents/new" element={<PasswordProtection><AgentForm /></PasswordProtection>} />
          <Route path="/agents/:id" element={<PasswordProtection><AgentForm /></PasswordProtection>} />
          <Route path="/chat/:agentId" element={<PasswordProtection><Chat /></PasswordProtection>} />
          <Route path="/widgets" element={<PasswordProtection><ChatWidgetManager /></PasswordProtection>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
