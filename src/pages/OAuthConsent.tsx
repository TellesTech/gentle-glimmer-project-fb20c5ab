import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface AuthorizationDetails {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
}

// The Supabase OAuth 2.1 namespace is beta and not always typed in the SDK.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function getOAuthApi(): OAuthApi | null {
  const anyAuth = (supabase.auth as unknown) as { oauth?: OAuthApi };
  return anyAuth.oauth ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente.");
        return;
      }
      const oauth = getOAuthApi();
      if (!oauth) {
        setError("O provedor OAuth do Supabase ainda não está disponível nesta sessão.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: detailsError } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuthApi();
    if (!oauth) return;
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar aplicativo</CardTitle>
          <CardDescription>
            {details?.client?.name
              ? `${details.client.name} está solicitando acesso à sua conta.`
              : "Um aplicativo externo está solicitando acesso à sua conta."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">Não foi possível processar essa solicitação: {error}</p>
          )}
          {!error && !details && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}
          {details && (
            <>
              <p className="text-sm text-muted-foreground">
                Ao aprovar, o aplicativo poderá usar as ferramentas do sistema em seu nome.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => decide(true)} disabled={busy} className="flex-1">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                </Button>
                <Button variant="outline" onClick={() => decide(false)} disabled={busy} className="flex-1">
                  Negar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}