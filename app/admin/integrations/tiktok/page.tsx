"use client";

import AdminIntegrationGate from "@/components/admin/AdminIntegrationGate";
import AdminTikTokIntegrations from "@/components/admin/AdminTikTokIntegrations";

/** Client gate is UX-only; /api/social/tiktok/* enforces admin server-side. */
export default function AdminTikTokIntegrationsPage() {
  return (
    <AdminIntegrationGate redirectPath="/admin/integrations/tiktok">
      <AdminTikTokIntegrations />
    </AdminIntegrationGate>
  );
}
