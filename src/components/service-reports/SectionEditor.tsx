import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, GripVertical, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'list';
  text: string;
}

interface SectionEditorProps {
  id: string;
  title: string;
  sectionType: string;
  content: ContentBlock[];
  onTitleChange: (title: string) => void;
  onContentChange: (content: ContentBlock[]) => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

export function SectionEditor({
  id,
  title,
  sectionType,
  content,
  onTitleChange,
  onContentChange,
  onDelete,
  canDelete = true,
}: SectionEditorProps) {
  const [isOpen, setIsOpen] = useState(true);

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      text: '',
    };
    onContentChange([...content, newBlock]);
  };

  const updateBlock = (blockId: string, text: string) => {
    onContentChange(content.map((b) => (b.id === blockId ? { ...b, text } : b)));
  };

  const removeBlock = (blockId: string) => {
    onContentChange(content.filter((b) => b.id !== blockId));
  };

  const sectionTypeLabels: Record<string, string> = {
    scope: 'Escopo',
    safety: 'Segurança',
    execution: 'Execução',
    conclusion: 'Conclusão',
    custom: 'Personalizada',
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border rounded-lg bg-card">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <GripVertical className="w-4 h-4 text-muted-foreground/50" />
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm flex-1">{title || sectionTypeLabels[sectionType] || 'Seção'}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {sectionTypeLabels[sectionType] || sectionType}
            </span>
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-3">
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Título da seção"
              className="font-medium"
            />

            {content.map((block) => (
              <div key={block.id} className="flex gap-2">
                <div className="flex-1">
                  {block.type === 'heading' ? (
                    <Input
                      value={block.text}
                      onChange={(e) => updateBlock(block.id, e.target.value)}
                      placeholder="Subtítulo..."
                      className="font-semibold"
                    />
                  ) : (
                    <Textarea
                      value={block.text}
                      onChange={(e) => updateBlock(block.id, e.target.value)}
                      placeholder={block.type === 'list' ? 'Item da lista (um por linha)...' : 'Escreva o texto...'}
                      className="min-h-[80px] resize-y"
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0 mt-1"
                  onClick={() => removeBlock(block.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => addBlock('paragraph')} className="text-xs gap-1">
                <Plus className="w-3 h-3" /> Parágrafo
              </Button>
              <Button variant="outline" size="sm" onClick={() => addBlock('heading')} className="text-xs gap-1">
                <Plus className="w-3 h-3" /> Subtítulo
              </Button>
              <Button variant="outline" size="sm" onClick={() => addBlock('list')} className="text-xs gap-1">
                <Plus className="w-3 h-3" /> Lista
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
