"use client";

import AdminIntegrationGate from "@/components/admin/AdminIntegrationGate";
import AdminInstagramIntegrations from "@/components/admin/AdminInstagramIntegrations";

/** Client gate is UX-only; /api/social/instagram/* enforces admin server-side. */
export default function AdminInstagramIntegrationsPage() {
  return (
    <AdminIntegrationGate redirectPath="/admin/integrations/instagram">
      <AdminInstagramIntegrations />
    </AdminIntegrationGate>
  );
}
