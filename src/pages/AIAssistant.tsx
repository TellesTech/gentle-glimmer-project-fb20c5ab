import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAIAssistant, Message } from '@/hooks/useAIAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  SendIcon,
  Trash2,
  Loader2,
  ClipboardList,
  Users,
  Activity,
  BarChart3,
  ArrowUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const quickSuggestions = [
  { icon: ClipboardList, label: 'Resumo dos RDOs', prompt: 'Quais RDOs foram criados hoje? Me dê um resumo geral.' },
  { icon: Users, label: 'Colaboradores ativos', prompt: 'Quantos colaboradores estão ativos e em quais projetos estão alocados?' },
  { icon: Activity, label: 'Projetos com risco', prompt: 'Quais projetos estão em situação crítica ou com risco de atraso?' },
  { icon: BarChart3, label: 'Progresso geral', prompt: 'Qual o progresso geral das obras? Mostre os projetos com maior e menor avanço.' },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message, isUser }: { message: Message; isUser: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex gap-3 max-w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'rounded-2xl px-4 py-3 max-w-[85%] lg:max-w-[70%] text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <p className={cn(
          'text-[10px] mt-1.5',
          isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
        )}>
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
            EU
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

export default function AIAssistant() {
  const { messages, isLoading, isLoadingHistory, sendMessage, clearHistory } = useAIAssistant();
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const rootBgClass = isDark ? 'bg-[hsl(240_10%_4%)]' : 'bg-muted/40';
  const surfaceBgClass = isDark ? 'bg-background/80' : 'bg-background/80';
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasConversation = messages.length > 0;
  const showInitialView = !hasConversation && !isLoadingHistory;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const firstName = profile?.name?.split(' ')[0] || 'usuário';

  // ── Initial centered view (no messages) ──
  if (showInitialView) {
    return (
      <div className={cn(
        'flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4.5rem)] -m-3 sm:-m-4 lg:-m-6',
        rootBgClass
      )}>
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
          {/* Decorative glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/5 dark:bg-primary/[0.03] rounded-full blur-3xl pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 flex flex-col items-center w-full max-w-2xl"
          >
            {/* Title */}
            <h1 className={cn(
              "text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 pb-1",
              isDark
                ? "bg-gradient-to-b from-white to-white/80 bg-clip-text text-transparent"
                : "text-slate-900"
            )}>
              Como posso ajudar hoje?
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Pergunte sobre RDOs, colaboradores, projetos e atividades
            </p>

            {/* Decorative line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-16 h-px bg-border mb-8"
            />

            {/* Input card */}
            <div className="w-full bg-card border border-border rounded-xl p-3 shadow-sm">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    adjustTextarea();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo ao Wesley..."
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground min-h-[36px] max-h-[160px] py-1.5 px-1"
                  spellCheck
                  lang="pt-BR"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="h-8 w-8 rounded-lg shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Quick suggestions */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {quickSuggestions.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    onClick={() => handleSuggestionClick(s.prompt)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-card hover:bg-accent/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{s.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center pb-4">
          Wesley pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    );
  }

  // ── Active conversation view ──
  return (
    <div className={cn(
      'flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4.5rem)] -m-3 sm:-m-4 lg:-m-6',
      rootBgClass
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Wesley — Assistente IA</h1>
            <p className="text-xs text-muted-foreground">RDOs • Colaboradores • Projetos • Atividades</p>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
              <AlertDialogDescription>
                Todas as mensagens desta conversa serão excluídas permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={clearHistory}>Limpar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {isLoadingHistory ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isUser={msg.role === 'user'} />
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      <Sparkles className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 bg-card rounded-xl border border-border px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre RDOs, colaboradores, projetos..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground min-h-[36px] max-h-[160px] py-1.5"
              spellCheck
              lang="pt-BR"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 rounded-lg shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5">
            Wesley pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
}
