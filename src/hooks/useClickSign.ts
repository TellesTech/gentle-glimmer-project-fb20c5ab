import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Signer {
  email: string;
  name: string;
  role?: string;
  phone?: string;
  authMethod?: 'email' | 'sms' | 'whatsapp' | 'api';
  signAs?: 'sign' | 'approve' | 'witness' | 'party';
}

interface CreateDocumentParams {
  reportId: string;
  documentContent: string;
  fileName: string;
  signers: Signer[];
  deadline?: string;
  message?: string;
}

interface AddSignerParams {
  documentKey: string;
  signer: Signer;
}

interface DocumentInfo {
  id: string;
  key: string;
  hash: string;
  status: string;
  url?: string;
  expiresAt?: string;
  signedAt?: string;
  createdAt?: string;
}

interface SignerInfo {
  id: string;
  email: string;
  name: string;
  role?: string;
  status: string;
  signatureUrl?: string;
  signedAt?: string;
}

interface ClickSignResponse {
  success: boolean;
  document?: DocumentInfo;
  signers?: SignerInfo[];
  signer?: SignerInfo;
  mockMode?: boolean;
  error?: string;
  message?: string;
}

export function useClickSign() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Create a new document for signing
  const createDocumentMutation = useMutation({
    mutationFn: async (params: CreateDocumentParams): Promise<ClickSignResponse> => {
      const { data: { session } } = await (supabase as any).auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'create_document',
          ...params,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data.mockMode) {
        toast.info('Documento criado em modo de teste. Configure a API key para enviar assinaturas reais.');
      } else {
        toast.success('Documento enviado para assinatura!');
      }
      queryClient.invalidateQueries({ queryKey: ['clicksign-documents'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar documento');
    },
  });

  // Add a new signer to an existing document
  const addSignerMutation = useMutation({
    mutationFn: async (params: AddSignerParams): Promise<ClickSignResponse> => {
      const { data: { session } } = await (supabase as any).auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'add_signer',
          ...params,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Signatário adicionado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['clicksign-documents'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar signatário');
    },
  });

  // Get document status
  const getDocumentStatus = useCallback(async (documentKey: string): Promise<ClickSignResponse> => {
    const { data: { session } } = await (supabase as any).auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await supabase.functions.invoke('clicksign', {
      body: {
        action: 'get_status',
        documentKey,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  }, []);

  // Cancel a document
  const cancelDocumentMutation = useMutation({
    mutationFn: async (documentKey: string): Promise<ClickSignResponse> => {
      const { data: { session } } = await (supabase as any).auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'cancel_document',
          documentKey,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success('Documento cancelado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['clicksign-documents'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao cancelar documento');
    },
  });

  // Notify signers (send reminder)
  const notifySignersMutation = useMutation({
    mutationFn: async ({ documentKey, signerKeys, message }: { 
      documentKey: string; 
      signerKeys?: string[]; 
      message?: string;
    }): Promise<ClickSignResponse> => {
      const { data: { session } } = await (supabase as any).auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'notify_signers',
          documentKey,
          signerKeys,
          message,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Lembrete enviado aos signatários!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar lembrete');
    },
  });

  // Hook to get documents for a specific report
  const useReportDocuments = (reportId: string) => {
    return useQuery({
      queryKey: ['clicksign-documents', reportId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('clicksign_documents')
          .select(`
            *,
            signers:clicksign_signers(*)
          `)
          .eq('report_id', reportId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled: !!reportId,
    });
  };

  // Generate PDF content from report (placeholder - would integrate with your PDF generation)
  const generateReportPdfContent = useCallback(async (reportId: string): Promise<string> => {
    // This would integrate with your existing PDF generation (generateReportPdf)
    // For now, returning a placeholder
    // TODO: Integrate with actual PDF generation
    console.log('Generating PDF for report:', reportId);
    return 'base64_pdf_content_placeholder';
  }, []);

  // Send report for ClickSign signature
  const sendReportForSignature = useCallback(async (
    reportId: string,
    signers: Signer[],
    options?: { deadline?: string; message?: string }
  ) => {
    setIsLoading(true);
    try {
      // Generate PDF content
      const pdfContent = await generateReportPdfContent(reportId);
      
      // Create document in ClickSign
      const result = await createDocumentMutation.mutateAsync({
        reportId,
        documentContent: pdfContent,
        fileName: `RDO_${reportId}.pdf`,
        signers,
        deadline: options?.deadline,
        message: options?.message,
      });

      return result;
    } finally {
      setIsLoading(false);
    }
  }, [createDocumentMutation, generateReportPdfContent]);

  return {
    // Mutations
    createDocument: createDocumentMutation.mutate,
    createDocumentAsync: createDocumentMutation.mutateAsync,
    addSigner: addSignerMutation.mutate,
    addSignerAsync: addSignerMutation.mutateAsync,
    cancelDocument: cancelDocumentMutation.mutate,
    cancelDocumentAsync: cancelDocumentMutation.mutateAsync,
    notifySigners: notifySignersMutation.mutate,
    notifySignersAsync: notifySignersMutation.mutateAsync,
    
    // Query
    getDocumentStatus,
    useReportDocuments,
    
    // Helper
    sendReportForSignature,
    
    // State
    isLoading: isLoading || createDocumentMutation.isPending || addSignerMutation.isPending,
    isCreating: createDocumentMutation.isPending,
    isAddingSigner: addSignerMutation.isPending,
    isCancelling: cancelDocumentMutation.isPending,
    isNotifying: notifySignersMutation.isPending,
  };
}

// Types export for use in components
export type { Signer, CreateDocumentParams, DocumentInfo, SignerInfo, ClickSignResponse };
