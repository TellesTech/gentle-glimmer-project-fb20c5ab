import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";
import Draggable from "react-draggable";
import { createWorker } from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileDown, X, Type, Eraser, Languages } from "lucide-react";
import { toast } from "sonner";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

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
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrWorker, setOcrWorker] = useState<any>(null);

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
        await page.render({ canvasContext: context!, viewport }).promise;
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

  const runOCR = async () => {
    if (!pdfFile) return;
    setIsProcessingOCR(true);
    toast.info("Processando páginas com OCR... Isso pode levar alguns segundos.");
    let worker: any = null;
    try {
      worker = await createWorker('por');
      const pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
      const newAnns: Annotation[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport }).promise;
        const { data } = await worker.recognize(canvas.toDataURL('image/png'));
        data.lines.forEach((line: any) => {
          if (line.confidence < 50) return;
          const scale = 1.5 / 2;
          const x = line.bbox.x0 * scale;
          const y = line.bbox.y0 * scale;
          const w = (line.bbox.x1 - line.bbox.x0) * scale;
          const h = (line.bbox.y1 - line.bbox.y0) * scale;
          newAnns.push({ id: Math.random().toString(36).substr(2, 9), type: 'whiteout', x, y, width: w, height: h, page: i });
          newAnns.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', x: x, y: y, page: i, text: line.text.trim() });
        });
      }
      setAnnotations([...annotations, ...newAnns]);
      toast.success("Textos de imagem agora são editáveis!");
    } catch (err) {
      console.error("OCR Error detail:", err);
      toast.error("Erro no processamento OCR. Verifique o console para detalhes.");
    } finally {
      if (worker) await worker.terminate();
      setIsProcessingOCR(false);
    }
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if ((e.target as HTMLElement).closest('.annotation-item')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    addAnnotationAt('text', e.clientX - rect.left, e.clientY - rect.top, pageNum);
  };

  const addAnnotationAt = (type: 'text' | 'whiteout', x: number, y: number, page: number) => {
    const newAnn: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type, x, y, page,
      ...(type === 'text' ? { text: "" } : { width: 100, height: 20 })
    };
    setAnnotations([...annotations, newAnn]);
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
      
      const allPages = pdfDoc.getPages();
      const scale = 0.67;
      for (const ann of annotations) {
        const page = allPages[ann.page - 1];
        const { height } = page.getSize();
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
            y: height - (ann.y * scale) - 12,
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
        <div className="flex items-center gap-2">
          {pdfFile && (
            <>
              <Button variant="secondary" size="sm" onClick={runOCR} disabled={isProcessingOCR} className="bg-blue-50 text-blue-600 border-blue-100 disabled:opacity-50">
                {isProcessingOCR ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Languages className="w-4 h-4 mr-2" />}
                Liberar Textos (OCR)
              </Button>
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <Button variant="ghost" size="sm" onClick={() => addAnnotation('whiteout')}><Eraser className="w-4 h-4 mr-2" /> Apagar</Button>
              <Button variant="ghost" size="sm" onClick={() => addAnnotation('text')}><Type className="w-4 h-4 mr-2" /> Novo Texto</Button>
            </>
          )}
        </div>
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
              <div 
                key={i} 
                className="relative shadow-2xl bg-white h-fit cursor-crosshair"
                onClick={(e) => handlePageClick(e, i + 1)}
              >
                <img src={pageSrc} alt={`Página ${i+1}`} className="block pointer-events-none" />
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {annotations.filter(ann => ann.page === i + 1).map(ann => (
                    <Draggable
                      key={ann.id}
                      defaultPosition={{ x: ann.x, y: ann.y }}
                      onStop={(e, data) => updateAnnotation(ann.id, { x: data.x, y: data.y })}
                      bounds="parent"
                    >
                      <div className="absolute pointer-events-auto cursor-move group annotation-item" style={{ zIndex: 100 }}>
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
