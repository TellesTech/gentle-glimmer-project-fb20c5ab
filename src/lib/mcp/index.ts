import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";

// Build the OAuth issuer from the project ref (Vite inlines this at build time).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rdo-wees-mcp",
  title: "RDO Wees MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do app RDO Wees. Use `echo` para validar a conectividade da integração.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool],
});