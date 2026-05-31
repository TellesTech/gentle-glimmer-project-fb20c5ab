import { useState, useRef } from "react";
import { Lightbulb, Upload, X, Camera, Info, Image as ImageIcon, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NewSuggestion, SuggestionCategory, SuggestionPriority } from "@/hooks/useSuggestions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageAnnotator } from "@/components/shared/ImageAnnotator";

interface NewSuggestionDialogProps {
  onSubmit: (suggestion: NewSuggestion) => void;
  isLoading?: boolean;
}

export function NewSuggestionDialog({ onSubmit, isLoading }: NewSuggestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SuggestionCategory>("melhoria");
  const [priority, setPriority] = useState<SuggestionPriority>("media");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione apenas imagens");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("suggestion-screenshots")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("suggestion-screenshots")
        .getPublicUrl(filePath);

      setScreenshot(urlData.publicUrl);
      toast.success("Imagem anexada com sucesso!");
    } catch (error) {
      console.error("Error uploading screenshot:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
  };

  const handleAnnotatedImage = async (annotatedDataUrl: string) => {
    // Convert data URL to blob and upload
    setIsUploading(true);
    try {
      const response = await fetch(annotatedDataUrl);
      const blob = await response.blob();
      
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-annotated.png`;
      const filePath = `screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("suggestion-screenshots")
        .upload(filePath, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("suggestion-screenshots")
        .getPublicUrl(filePath);

      setScreenshot(urlData.publicUrl);
      toast.success("Imagem com marcações salva!");
    } catch (error) {
      console.error("Error uploading annotated image:", error);
      toast.error("Erro ao salvar imagem anotada");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      screenshot_url: screenshot || undefined,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setCategory("melhoria");
    setPriority("media");
    setScreenshot(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Nova Sugestão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Nova Sugestão
          </DialogTitle>
          <DialogDescription>
            Compartilhe sua ideia para melhorar a plataforma. Outros usuários poderão votar na sua sugestão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Adicionar exportação para Excel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva sua sugestão em detalhes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>

          {/* Screenshot Upload Section */}
          <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/30 p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Anexar Print da Tela</Label>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Ajude-nos a entender melhor sua sugestão com uma imagem do que precisa ser modificado ou corrigido.
            </p>

            {/* Help Instructions */}
            <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground">
                  <Info className="h-3 w-3" />
                  Como tirar print da tela?
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-md bg-background p-3 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-medium min-w-[60px]">Windows:</span>
                    <span className="text-muted-foreground">
                      Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Win + Shift + S</kbd> para selecionar área
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium min-w-[60px]">Mac:</span>
                    <span className="text-muted-foreground">
                      Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Cmd + Shift + 4</kbd> para selecionar área
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium min-w-[60px]">Celular:</span>
                    <span className="text-muted-foreground">
                      Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Energia + Volume</kbd> simultaneamente
                    </span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Upload Area */}
            {screenshot ? (
              <div className="space-y-2">
                <div className="relative group">
                  <img 
                    src={screenshot} 
                    alt="Screenshot anexado" 
                    className="w-full h-40 object-cover rounded-md border"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 flex-1"
                    onClick={() => setAnnotatorOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Adicionar Marcações
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                    onClick={handleRemoveScreenshot}
                  >
                    <X className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="relative border-2 border-dashed border-muted-foreground/20 rounded-md p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Clique para selecionar uma imagem
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      PNG, JPG ou GIF até 5MB
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SuggestionCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                  <SelectItem value="bug">Correção de Bug</SelectItem>
                  <SelectItem value="nova_funcionalidade">Nova Funcionalidade</SelectItem>
                  <SelectItem value="integracao">Integração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade Sugerida</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as SuggestionPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || isLoading || isUploading}>
              {isLoading ? "Enviando..." : "Enviar Sugestão"}
            </Button>
          </DialogFooter>
        </form>

        {/* Image Annotator Modal */}
        {screenshot && (
          <ImageAnnotator
            imageSrc={screenshot}
            open={annotatorOpen}
            onOpenChange={setAnnotatorOpen}
            onApply={handleAnnotatedImage}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
