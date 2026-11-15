import { ArrowRight, ExternalLink } from "lucide-react";

const TARGET_URL = "https://staf.wees.com.br";
const LOGO_URL =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/pcnzjQlbNAac3gCFLybWlmDzHtL2/uploads/1767008391542-LOGO WEES OFICIAL.png";

export default function SystemMoved() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl text-center">
        <img
          src={LOGO_URL}
          alt="WEES"
          className="mx-auto h-16 w-auto mb-10"
        />

        <span className="inline-block rounded-full bg-accent text-accent-foreground text-xs font-semibold uppercase tracking-wider px-3 py-1 mb-6">
          Aviso
        </span>

        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
          O RDO agora está no sistema corporativo da WEES
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg mb-10">
          Este endereço foi desativado temporariamente. Para criar, consultar e
          assinar seus Relatórios Diários de Obra, acesse o sistema corporativo.
        </p>

        <a
          href={TARGET_URL}
          className="group inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-base font-semibold shadow-md transition-opacity hover:opacity-90"
        >
          Acessar staf.wees.com.br
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </a>

        <p className="mt-6 text-sm text-muted-foreground">
          <a
            href={TARGET_URL}
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          >
            {TARGET_URL}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
    </main>
  );
}
