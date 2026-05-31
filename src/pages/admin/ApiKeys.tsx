import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AVAILABLE_SCOPES = [
  "read:reports", "read:projects", "read:sites", "read:companies",
  "read:workforce", "read:photos", "read:signatures", "read:all",
];

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:reports"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_keys" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar chaves");
    else setKeys((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!name.trim()) return toast.error("Informe um nome");
    if (selectedScopes.length === 0) return toast.error("Selecione ao menos um escopo");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-api-keys", {
      body: { action: "create", name, scopes: selectedScopes, expires_at: expiresAt || null },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erro");
      return;
    }
    setCreatedKey((data as any).key);
    setName(""); setSelectedScopes(["read:reports"]); setExpiresAt("");
    load();
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revogar esta chave? Não pode ser desfeito.")) return;
    const { error } = await supabase.functions.invoke("admin-api-keys", {
      body: { action: "revoke", id },
    });
    if (error) return toast.error(error.message);
    toast.success("Chave revogada");
    load();
  }

  function toggleScope(s: string) {
    setSelectedScopes((prev) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function statusOf(k: ApiKey): { label: string; variant: "default" | "secondary" | "destructive" } {
    if (k.revoked_at) return { label: "Revogada", variant: "destructive" };
    if (k.expires_at && new Date(k.expires_at) < new Date()) return { label: "Expirada", variant: "secondary" };
    return { label: "Ativa", variant: "default" };
  }

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <KeyRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Chaves de API</h1>
          <p className="text-muted-foreground">Gere tokens para integração com sistemas externos</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como usar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Envie o header <code className="bg-muted px-1.5 py-0.5 rounded">x-api-key</code> nas chamadas às edge functions:</p>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl ${baseUrl}/<endpoint> \\
  -H "x-api-key: wees_xxxxxxx"`}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Nova chave</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL base do projeto</Label>
            <div className="flex gap-2 mt-1">
              <Input value={baseUrl} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { navigator.clipboard.writeText(baseUrl); toast.success("URL copiada!"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use esta URL como base no outro projeto, junto com o header <code className="bg-muted px-1 rounded">x-api-key</code>.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Projeto migração 2026" />
            </div>
            <div>
              <Label>Expira em (opcional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Escopos</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AVAILABLE_SCOPES.map((s) => (
                <Badge
                  key={s}
                  variant={selectedScopes.includes(s) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleScope(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Gerando..." : "Gerar chave"}
          </Button>
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>Chaves existentes</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Carregando...</p> : keys.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma chave criada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prefixo</TableHead>
                  <TableHead>Escopos</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => {
                  const st = statusOf(k);
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell><code className="text-xs">{k.key_prefix}…</code></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(k.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="text-xs">
                        {k.last_used_at ? format(new Date(k.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell>
                        {!k.revoked_at && (
                          <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!createdKey} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Copie agora — não será exibida novamente
            </DialogTitle>
            <DialogDescription>
              Esta chave só aparece uma vez. Guarde em local seguro (cofre de secrets do projeto consumidor).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Chave (x-api-key)</Label>
            <div className="bg-muted p-3 rounded font-mono text-sm break-all">{createdKey}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL base do projeto</Label>
            <div className="bg-muted p-3 rounded font-mono text-xs break-all">{baseUrl}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(baseUrl); toast.success("URL copiada!"); }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar URL
            </Button>
            <Button onClick={() => { navigator.clipboard.writeText(createdKey!); toast.success("Chave copiada!"); }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar chave
            </Button>
            <Button variant="ghost" onClick={() => setCreatedKey(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
