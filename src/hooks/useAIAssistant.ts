import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAIAlerts, formatAlertsForMessage } from './useAIAlerts';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const MAX_CONTEXT_MESSAGES = 20;

const getGreetingByTime = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'Bom dia';
  } else if (hour >= 12 && hour < 18) {
    return 'Boa tarde';
  } else {
    return 'Boa noite';
  }
};

const getBaseWelcomeMessage = (userName?: string) => {
  const firstName = userName?.split(' ')[0] || 'usuário';
  const greeting = getGreetingByTime();
  return `${greeting}, ${firstName}. Sou Wesley, seu assistente. Posso ajudar com informações sobre fábricas, projetos, colaboradores, RDOs e equipamentos.`;
};

export function useAIAssistant() {
  const { user, profile } = useAuth();
  const alerts = useAIAlerts();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Load or create conversation on mount
  useEffect(() => {
    if (user?.id) {
      loadOrCreateConversation();
    } else {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  const loadOrCreateConversation = async () => {
    if (!user?.id) return;
    
    setIsLoadingHistory(true);
    try {
      // Try to find existing conversation
      const { data: existingConversation, error: fetchError } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let convId = existingConversation?.id;

      // If no conversation exists, create one
      if (!convId) {
        const { data: newConversation, error: createError } = await supabase
          .from('ai_conversations')
          .insert({ user_id: user.id })
          .select('id')
          .single();

        if (createError) throw createError;
        convId = newConversation.id;
      }

      setConversationId(convId);

      // Load messages from this conversation
      const { data: existingMessages, error: messagesError } = await supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (existingMessages && existingMessages.length > 0) {
        // Filter out orphan welcome messages (only assistant messages, no user interaction)
        const hasUserMessage = existingMessages.some(msg => msg.role === 'user');
        if (hasUserMessage) {
          const loadedMessages: Message[] = existingMessages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.created_at),
          }));
          setMessages(loadedMessages);
        } else {
          // Conversation has only assistant messages (orphan greetings) - treat as empty
          setMessages([]);
        }
      } else {
        // Start with empty messages - the UI will show the initial view
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string): Promise<string | null> => {
    if (!conversationId) return null;

    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data.id;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to database
    const savedUserMsgId = await saveMessage('user', content.trim());
    if (savedUserMsgId) {
      setMessages(prev => prev.map(m => 
        m.id === userMessage.id ? { ...m, id: savedUserMsgId } : m
      ));
    }

    let assistantContent = '';
    let assistantMsgId = `temp-assistant-${Date.now()}`;

    const updateAssistantMessage = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantMsgId) {
          return prev.map((m, i) => 
            i === prev.length - 1 
              ? { ...m, content: assistantContent } 
              : m
          );
        }
        return [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date(),
          },
        ];
      });
    };

    try {
      // Prepare conversation messages for API (limit context)
      const conversationMessages = messages
        .filter(m => m.id !== 'welcome')
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(m => ({ role: m.role, content: m.content }));
      
      conversationMessages.push({ role: 'user', content: content.trim() });

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationMessages,
          userId: user?.id,
          userName: profile?.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Resposta vazia do servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              updateAssistantMessage(deltaContent);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) updateAssistantMessage(deltaContent);
          } catch { /* ignore */ }
        }
      }

      // Save assistant message to database
      if (assistantContent) {
        const savedAssistantMsgId = await saveMessage('assistant', assistantContent);
        if (savedAssistantMsgId) {
          setMessages(prev => prev.map(m => 
            m.id === assistantMsgId ? { ...m, id: savedAssistantMsgId } : m
          ));
        }
      }

    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao processar mensagem: ${errorMessage}`);
      
      const firstName = profile?.name?.split(' ')[0] || 'usuário';
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Peço desculpas, ${firstName}, ocorreu um erro ao processar sua solicitação: ${errorMessage}. Recomendo tentar novamente em alguns instantes.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, user?.id, conversationId]);

  const clearHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Delete current conversation (cascade will delete messages)
      if (conversationId) {
        await supabase
          .from('ai_conversations')
          .delete()
          .eq('id', conversationId);
      }

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();

      if (error) throw error;

      setConversationId(newConversation.id);
      setMessages([]);
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Erro ao limpar histórico');
    }
  }, [user?.id, conversationId]);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    sendMessage,
    clearHistory,
  };
}
