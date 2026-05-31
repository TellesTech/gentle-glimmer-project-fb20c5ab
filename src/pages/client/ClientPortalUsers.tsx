import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClientLayout } from '@/components/client/ClientLayout';
import { ClientContactsSection } from '@/components/settings/ClientContactsSection';
import { useAuth } from '@/contexts/AuthContext';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Loader2 } from 'lucide-react';

export default function ClientPortalUsers() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user: adminUser, role } = useAuth();
  const { clientProfile } = useClientAuth();

  const companyId = params.get('company_id') || '';
  const siteId = params.get('site_id') || undefined;

  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const isInternalUser =
    !clientProfile && !!adminUser && (role === 'super_admin' || role === 'admin');

  useEffect(() => {
    if (!isInternalUser) {
      navigate(`/client/dashboard?${params.toString()}`, { replace: true });
    }
  }, [isInternalUser, navigate, params]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!companyId) return;
      setLoading(true);
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
        siteId
          ? supabase.from('sites').select('name').eq('id', siteId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (!active) return;
      setCompanyName(c?.name || '');
      setSiteName(s?.name || undefined);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [companyId, siteId]);

  if (!isInternalUser) return null;

  return (
    <ClientLayout>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              Membros da Unidade {siteName ? `— ${siteName}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Cadastre aqui os contatos do cliente que terão acesso ao portal e
              poderão assinar os RDOs. Defina nome, e-mail, foto, função e PIN
              de 4 dígitos. Use o botão <strong>"Convite"</strong> no topo para
              gerar o texto de WhatsApp com link e PIN reais.
            </p>
          </div>
        </div>

        {loading || !companyId ? (
          <Card>
            <CardContent className="py-10 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando contatos da unidade...
            </CardContent>
          </Card>
        ) : (
          <ClientContactsSection
            companyId={companyId}
            companyName={companyName}
            siteId={siteId}
            siteName={siteName}
            embedded
          />
        )}
      </div>
    </ClientLayout>
  );
}
