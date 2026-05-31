import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface PdfHeaderPreviewProps {
  primaryColor: string;
  accentColor: string;
  pdfLogoUrl?: string;
  logoUrl?: string;
  companyName?: string;
}

export const PdfHeaderPreview = ({
  primaryColor,
  accentColor,
  pdfLogoUrl,
  logoUrl,
  companyName = "Empresa"
}: PdfHeaderPreviewProps) => {
  const displayLogo = pdfLogoUrl || logoUrl;
  const today = format(new Date(), 'dd/MM/yyyy');
  const exampleCode = `RDO Nº 001 - ${format(new Date(), 'dd/MM/yyyy')}`;

  return (
    <div className="w-full overflow-hidden rounded-lg border shadow-sm">
      {/* Main Header */}
      <div 
        className="grid grid-cols-[1fr_2fr_1fr] text-white text-xs"
        style={{ backgroundColor: primaryColor }}
      >
        {/* Logo Column */}
        <div className="flex flex-col items-center justify-center p-3 border-r border-white/30">
          {displayLogo ? (
            <img 
              src={displayLogo} 
              alt="Logo" 
              className="max-h-8 max-w-[80px] object-contain"
            />
          ) : (
            <span className="font-bold text-sm">{companyName}</span>
          )}
          <span className="text-[10px] opacity-80 mt-1">Gestão de Atividades</span>
        </div>

        {/* Title Column */}
        <div className="flex flex-col items-center justify-center p-3 border-r border-white/30">
          <span className="font-bold text-sm tracking-wide">RELATÓRIO DIÁRIO DE ATIVIDADE</span>
          <span className="text-[10px] opacity-80 mt-1">{exampleCode}</span>
        </div>

        {/* Status Column */}
        <div className="flex flex-col items-center justify-center p-3">
          <Badge 
            className="text-[10px] px-2 py-0.5 font-medium border-0"
            style={{ 
              backgroundColor: accentColor,
              color: '#ffffff'
            }}
          >
            APROVADO
          </Badge>
          <span className="text-[10px] opacity-80 mt-1">{today}</span>
        </div>
      </div>

      {/* Sub Header */}
      <div 
        className="text-center py-2 text-[10px] text-white/90 border-t border-white/20"
        style={{ backgroundColor: primaryColor }}
      >
        Empresa Exemplo | Site Demonstração | Projeto Teste
      </div>
    </div>
  );
};
