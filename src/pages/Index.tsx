import { useState, useRef } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, FileDown, FileText, Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [language, setLanguage] = useState("por");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setProgress(0);
    setOcrText("");
    try {
      if (file.type === "application/pdf") {
        await processPdf(file);
      } else if (file.type.startsWith("image/")) {
        await processImage(file);
      } else {
        toast.error("Por favor, envie um PDF ou uma imagem.");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      toast.error("Erro ao processar o arquivo.");
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  };

  const processImage = async (file: File | string) => {
    const worker = await createWorker(language, 1);
    const { data: { text } } = await worker.recognize(file);
    setOcrText(text);
    await worker.terminate();
  };

  const processPdf = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const worker = await createWorker(language, 1);
    let fullText = "";
    for (let i = 1; i <= numPages; i++) {
      setProgress(Math.round(((i - 1) / numPages) * 100));
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // @ts-ignore - The types in pdfjs-dist 5.x can be inconsistent with build environments
      await page.render({ canvasContext: context!, viewport, canvas }).promise;
      const { data: { text } } = await worker.recognize(canvas.toDataURL("image/png"));
      fullText += `--- Página ${i} ---\n${text}\n\n`;
    }
    setOcrText(fullText);
    await worker.terminate();
  };

  const downloadText = () => {
    const blob = new Blob([ocrText], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "texto_extraido.txt");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">OCR para PDF Editável</h1>
          <p className="text-slate-500">Transforme PDFs escaneados em texto editável.</p>
        </div>
        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="flex items-center gap-4 mb-4">
                <Languages className="w-4 h-4 text-slate-500" />
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="por">Português</SelectItem>
                    <SelectItem value="eng">Inglês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input type="file" accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={isLoading} />
              <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full max-w-xs">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isLoading ? "Processando..." : "Selecionar PDF ou Imagem"}
              </Button>
            </div>
            {isLoading && <Progress value={progress} className="h-2 mt-4" />}
          </CardContent>
        </Card>
        {ocrText && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Texto Extraído</CardTitle>
              <Button variant="outline" size="sm" onClick={downloadText}><FileDown className="mr-2 h-4 w-4" /> Baixar .txt</Button>
            </CardHeader>
            <CardContent>
              <Textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} className="min-h-[400px]" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
