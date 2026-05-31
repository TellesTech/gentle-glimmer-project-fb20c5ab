import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChatStep = 'welcome' | 'ask_name' | 'ask_email' | 'ask_pin' | 'validating' | 'success';

interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  displayedContent?: string;
  isTyping?: boolean;
}

interface ChatOnboardingProps {
  companyName: string;
  companyId: string;
  siteId?: string;
  primaryColor: string;
  logoUrl?: string | null;
}

const WESLEY_AVATAR = '/images/wesley-avatar.png';
const CHAR_DELAY = 25;

const FALLBACK = {
  welcome: [
    'Olá! 👋 Sou o Wesley, da equipe WEES.',
    'Vou ajudá-lo a configurar seu acesso ao portal.',
    'Para começar, poderia me informar seu **nome completo**?',
  ],
  name_received: (name: string) => `Prazer, **${name.split(' ')[0]}**. Agora preciso do seu **e-mail cadastrado**.`,
  email_received: 'Anotado. Agora, crie um **PIN de 4 dígitos**. Esse código será sua senha rápida para acessar o portal nas próximas vezes.',
  pin_success: (name: string) => `Pronto, **${name.split(' ')[0]}**. Seu cadastro foi concluído com sucesso! Agora você já pode acessar o portal usando seu PIN.`,
  pin_error: 'Ocorreu um erro ao salvar seus dados. Poderia tentar novamente?',
  email_invalid: 'O e-mail informado parece estar incompleto. Poderia verificar e digitar novamente?',
};

export function ChatOnboarding({ companyName, companyId, siteId, primaryColor }: ChatOnboardingProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<ChatStep>('welcome');
  const [inputValue, setInputValue] = useState('');
  
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const scrollToBottom = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const typeMessage = useCallback((content: string): Promise<void> => {
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      setIsTyping(true);

      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { id, role: 'agent', content, displayedContent: '', isTyping: true }]);

        let charIndex = 0;
        const interval = setInterval(() => {
          charIndex++;
          if (charIndex <= content.length) {
            setMessages(prev =>
              prev.map(m =>
                m.id === id ? { ...m, displayedContent: content.slice(0, charIndex) } : m
              )
            );
            scrollToBottom();
          } else {
            clearInterval(interval);
            setMessages(prev =>
              prev.map(m =>
                m.id === id ? { ...m, displayedContent: content, isTyping: false } : m
              )
            );
            resolve();
          }
        }, CHAR_DELAY);
      }, 600);
    });
  }, [scrollToBottom]);

  const typeMultipleMessages = useCallback(async (msgs: string[]) => {
    for (const msg of msgs) {
      await typeMessage(msg);
    }
  }, [typeMessage]);

  const addUserMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, displayedContent: content }]);
  }, []);

  const fetchAIResponse = useCallback(async (aiStep: string, name?: string, extraParams?: Record<string, string>): Promise<string[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-onboarding', {
        body: { step: aiStep, companyName, userName: name, ...extraParams }
      });
      if (error || !data?.messages?.length) return null;
      return data.messages;
    } catch {
      return null;
    }
  }, [companyName]);

  // Welcome sequence
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const aiMsgs = await fetchAIResponse('welcome');
      if (cancelled) return;
      const msgs = aiMsgs || FALLBACK.welcome;
      await typeMultipleMessages(msgs);
      if (cancelled) return;
      setStep('ask_name');
    };
    run();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendName = async () => {
    const name = inputValue.trim();
    if (!name) return;
    setUserName(name);
    setInputValue('');
    addUserMessage(name);

    const msg = FALLBACK.name_received(name);
    await typeMessage(msg);
    setStep('ask_email');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const CORRECTION_REGEX = /(errei|errado|errada|corrigir|mudar|trocar|alterar|engane)/i;

  const handleSendEmail = async () => {
    const rawInput = inputValue.trim();
    if (!rawInput) return;

    if (CORRECTION_REGEX.test(rawInput)) {
      addUserMessage(rawInput);
      setInputValue('');
      const isNameCorrection = /nom/i.test(rawInput);
      const fallback = isNameCorrection
        ? 'Sem problema. Informe o **nome completo** correto.'
        : 'Sem problema. Informe o **e-mail** correto.';
      await typeMessage(fallback);
      setStep(isNameCorrection ? 'ask_name' : 'ask_email');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    const emailVal = rawInput.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      addUserMessage(rawInput);
      setInputValue('');
      await typeMessage(FALLBACK.email_invalid);
      return;
    }
    setUserEmail(emailVal);
    setInputValue('');
    addUserMessage(emailVal);

    await typeMessage(FALLBACK.email_received);
    setStep('ask_pin');
  };

  const handlePinComplete = async (pinValue: string) => {
    if (pinValue.length !== 4 || submitting) return;
    setSubmitting(true);
    setStep('validating');
    addUserMessage('••••');

    try {
      const { data, error } = await supabase.functions.invoke('register-client-contact', {
        body: { companyId, siteId, name: userName, email: userEmail, pin: pinValue }
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro ao cadastrar');

      setStep('success');
      await typeMessage(FALLBACK.pin_success(userName));
      // Reload page so the traditional login UI appears with the new contact
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setStep('ask_pin');
      setInputValue('');
      await typeMessage(FALLBACK.pin_error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPin = async () => {
    const val = inputValue.trim();
    if (!/^\d{4}$/.test(val)) return;
    setInputValue('');
    await handlePinComplete(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (step === 'ask_name') handleSendName();
      else if (step === 'ask_email') handleSendEmail();
      else if (step === 'ask_pin') handleSendPin();
    }
  };

  const renderMarkdown = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div className="flex flex-col h-[520px] max-h-[70vh] bg-background rounded-2xl border border-border/50 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-card">
        <img src={WESLEY_AVATAR} alt="Wesley" className="h-10 w-10 rounded-full object-cover border-2 border-border/30" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Wesley</p>
          <p className="text-xs text-muted-foreground">
            {isTyping ? 'digitando...' : step === 'success' ? '✅ Cadastro concluído' : 'Assistente WEES • Online'}
          </p>
        </div>
        {step === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-2.5 max-w-[85%] animate-fade-in', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
            >
              {msg.role === 'agent' && (
                <img src={WESLEY_AVATAR} alt="Wesley" className="h-7 w-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
              )}
              <div
                className={cn(
                  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                  msg.role === 'agent' ? 'bg-muted text-foreground rounded-tl-md' : 'text-white rounded-tr-md'
                )}
                style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}
              >
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.displayedContent || msg.content) }} />
                {msg.isTyping && <span className="inline-block w-0.5 h-4 bg-foreground/70 ml-0.5 align-middle animate-pulse" />}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5 max-w-[85%]">
              <img src={WESLEY_AVATAR} alt="Wesley" className="h-7 w-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
              <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-md">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
                </div>
              </div>
            </div>
          )}
          <div />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border/50 bg-card">
        {(step === 'ask_name' || step === 'ask_email' || step === 'ask_pin') && (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type={step === 'ask_pin' ? 'password' : step === 'ask_email' ? 'email' : 'text'}
              inputMode={step === 'ask_pin' ? 'numeric' : undefined}
              maxLength={step === 'ask_pin' ? 4 : undefined}
              placeholder={
                step === 'ask_name' ? 'Digite seu nome completo...' :
                step === 'ask_email' ? 'Digite seu email...' :
                'Crie seu PIN de 4 dígitos...'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-border/50 bg-background"
              autoFocus
            />
            <Button
              size="icon"
              onClick={step === 'ask_name' ? handleSendName : step === 'ask_email' ? handleSendEmail : handleSendPin}
              disabled={!inputValue.trim() || (step === 'ask_pin' && !/^\d{4}$/.test(inputValue.trim()))}
              style={{ backgroundColor: primaryColor }}
              className="text-white shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'validating' && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cadastrando...
          </div>
        )}

        {step === 'success' && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Cadastro concluído
          </div>
        )}

        {step === 'welcome' && (
          <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">Aguarde...</div>
        )}
      </div>
    </div>
  );
}
