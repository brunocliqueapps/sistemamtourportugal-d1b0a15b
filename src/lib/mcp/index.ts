import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchClients from "./tools/search-clients";
import listServiceOrders from "./tools/list-service-orders";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "crm-mtour-portugal",
  title: "CRM Mtour Portugal",
  version: "0.1.0",
  instructions:
    "Tools for the Mtour Portugal CRM. Search clients and list service orders (OS) as the signed-in user; access follows the user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchClients, listServiceOrders],
});
