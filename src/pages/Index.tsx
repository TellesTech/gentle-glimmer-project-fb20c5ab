import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Draggable from "react-draggable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileDown, X, Type, Eraser } from "lucide-react";
import { toast } from "sonner";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Annotation {
  id: string;
  type: 'text' | 'whiteout';
  x: number;
  y: number;
  text?: string;
  width?: number;
  height?: number;
  page: number;
}

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("PDF.js version:", pdfjsLib.version);
    console.log("Worker source:", pdfjsLib.GlobalWorkerOptions.workerSrc);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF.");
      return;
    }
    setPdfFile(file);
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        // @ts-ignore
        await page.render({ canvasContext: context!, viewport, canvas }).promise;
        pages.push(canvas.toDataURL());
      }
      setPdfPages(pages);
      setAnnotations([]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar o PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  const addAnnotation = (type: 'text' | 'whiteout') => {
    const newAnn: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 50,
      y: 50,
      page: 1,
      ...(type === 'text' ? { text: "Novo Texto" } : { width: 100, height: 20 })
    };
    setAnnotations([...annotations, newAnn]);
  };

  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    setAnnotations(annotations.map(ann => ann.id === id ? { ...ann, ...updates } : ann));
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter(ann => ann.id !== id));
  };

  const savePdf = async () => {
    if (!pdfFile) return;
    setIsLoading(true);
    try {
      const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      
      for (const ann of annotations) {
        const page = pages[ann.page - 1];
        const { height } = page.getSize();
        const scale = 0.67; // Compensation for 1.5 preview scale
        
        if (ann.type === 'whiteout') {
          page.drawRectangle({
            x: ann.x * scale,
            y: height - (ann.y * scale) - (ann.height! * scale),
            width: ann.width! * scale,
            height: ann.height! * scale,
            color: rgb(1, 1, 1),
          });
        } else {
          page.drawText(ann.text || "", {
            x: ann.x * scale,
            y: height - (ann.y * scale) - 10,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
        }
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "editado.pdf";
      link.click();
      toast.success("PDF salvo!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b p-4 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold mr-4">PDF Editor</h1>
          {pdfFile && (
            <>
              <Button variant="ghost" size="sm" onClick={() => addAnnotation('whiteout')}><Eraser className="w-4 h-4 mr-2" /> Apagar</Button>
              <Button variant="ghost" size="sm" onClick={() => addAnnotation('text')}><Type className="w-4 h-4 mr-2" /> Texto</Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            <Upload className="w-4 h-4 mr-2" /> {pdfFile ? "Trocar" : "Abrir PDF"}
          </Button>
          {pdfFile && (
            <Button onClick={savePdf} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
              Baixar
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8 flex justify-center">
        {!pdfFile ? (
          <Card className="border-dashed border-2 p-12 text-center max-w-md h-fit mt-20">
            <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-semibold mb-2">Editor de PDF Visual</h2>
            <p className="text-slate-500 mb-6 text-sm">Carregue um PDF para apagar áreas e adicionar novos textos por cima do original.</p>
            <Button onClick={() => fileInputRef.current?.click()}>Selecionar PDF</Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            {pdfPages.map((pageSrc, i) => (
              <div key={i} className="relative shadow-2xl bg-white h-fit">
                <img src={pageSrc} alt={`Página ${i+1}`} className="block pointer-events-none" />
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {annotations.filter(ann => ann.page === i + 1).map(ann => (
                    <Draggable
                      key={ann.id}
                      defaultPosition={{ x: ann.x, y: ann.y }}
                      onStop={(e, data) => updateAnnotation(ann.id, { x: data.x, y: data.y })}
                      bounds="parent"
                    >
                      <div className="absolute pointer-events-auto cursor-move group" style={{ zIndex: 100 }}>
                        {ann.type === 'whiteout' ? (
                          <div className="bg-white border border-slate-200 border-dashed group-hover:border-blue-500" style={{ width: ann.width, height: ann.height }} />
                        ) : (
                          <Input 
                            value={ann.text} 
                            onChange={(e) => updateAnnotation(ann.id, { text: e.target.value })} 
                            className="h-8 bg-white/90 border-slate-300 min-w-[120px]" 
                          />
                        )}
                        <button onClick={() => removeAnnotation(ann.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                      </div>
                    </Draggable>
                  ))}
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">Página {i+1}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
