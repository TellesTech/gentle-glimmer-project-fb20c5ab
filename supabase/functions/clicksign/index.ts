import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ClickSign API Base URL (use sandbox for testing, production for live)
const CLICKSIGN_BASE_URL = Deno.env.get('CLICKSIGN_SANDBOX') === 'true' 
  ? 'https://sandbox.clicksign.com/api/v1'
  : 'https://app.clicksign.com/api/v1';

interface CreateDocumentRequest {
  action: 'create_document';
  reportId: string;
  documentContent: string; // Base64 PDF or HTML content
  fileName: string;
  signers: Array<{
    email: string;
    name: string;
    role?: string;
    phone?: string;
    authMethod?: 'email' | 'sms' | 'whatsapp' | 'api';
    signAs?: 'sign' | 'approve' | 'witness' | 'party';
  }>;
  deadline?: string; // ISO date for signature deadline
  message?: string; // Custom message to signers
}

interface AddSignerRequest {
  action: 'add_signer';
  documentKey: string;
  signer: {
    email: string;
    name: string;
    role?: string;
    phone?: string;
    authMethod?: 'email' | 'sms' | 'whatsapp' | 'api';
    signAs?: 'sign' | 'approve' | 'witness' | 'party';
  };
}

interface GetDocumentStatusRequest {
  action: 'get_status';
  documentKey: string;
}

interface CancelDocumentRequest {
  action: 'cancel_document';
  documentKey: string;
}

interface NotifySignersRequest {
  action: 'notify_signers';
  documentKey: string;
  signerKeys?: string[];
  message?: string;
}

type RequestBody = 
  | CreateDocumentRequest 
  | AddSignerRequest 
  | GetDocumentStatusRequest 
  | CancelDocumentRequest
  | NotifySignersRequest;

async function clickSignRequest(endpoint: string, method: string, body?: any) {
  const apiKey = Deno.env.get('CLICKSIGN_API_KEY');
  
  if (!apiKey) {
    console.warn('CLICKSIGN_API_KEY not configured - running in mock mode');
    return { mock: true, message: 'API key not configured. Integration prepared for when key is added.' };
  }

  const url = `${CLICKSIGN_BASE_URL}${endpoint}?access_token=${apiKey}`;
  
  console.log(`ClickSign API Request: ${method} ${endpoint}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('ClickSign API Error:', data);
    throw new Error(data.errors?.[0]?.message || 'ClickSign API error');
  }

  return data;
}

// Generate a document hash for audit trail
function generateDocumentHash(content: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  // Using a simple hash for now - in production would use proper SHA256
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    
    console.log(`ClickSign function called with action: ${body.action}`);

    switch (body.action) {
      case 'create_document': {
        const { reportId, documentContent, fileName, signers, deadline, message } = body as CreateDocumentRequest;
        
        if (!reportId || !documentContent || !fileName || !signers?.length) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: reportId, documentContent, fileName, signers' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate document hash for audit
        const documentHash = generateDocumentHash(documentContent);

        // Calculate expiration (default 30 days)
        const expiresAt = deadline 
          ? new Date(deadline) 
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Check if ClickSign API is configured
        const apiKey = Deno.env.get('CLICKSIGN_API_KEY');
        
        let clickSignDocument: any = null;
        let documentKey = `mock_${crypto.randomUUID()}`;
        let documentUrl = null;

        if (apiKey) {
          // Create document in ClickSign
          clickSignDocument = await clickSignRequest('/documents', 'POST', {
            document: {
              path: `/${fileName}`,
              content_base64: documentContent,
              deadline_at: expiresAt.toISOString(),
              auto_close: true,
              locale: 'pt-BR',
              sequence_enabled: false,
            }
          });
          
          documentKey = clickSignDocument.document.key;
          documentUrl = clickSignDocument.document.download?.url;
        }

        // Get user ID from auth token
        const { data: { user }, error: authError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        
        if (authError) {
          console.error('Auth error:', authError);
        }

        // Save document to database
        const { data: dbDocument, error: dbError } = await supabase
          .from('clicksign_documents')
          .insert({
            report_id: reportId,
            document_key: documentKey,
            document_url: documentUrl,
            document_hash: documentHash,
            status: apiKey ? 'sent' : 'pending',
            created_by: user?.id,
            expires_at: expiresAt.toISOString(),
            metadata: {
              fileName,
              signersCount: signers.length,
              message,
              mockMode: !apiKey,
            }
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          return new Response(
            JSON.stringify({ error: 'Failed to save document to database' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Add signers
        const signerResults = [];
        for (const signer of signers) {
          let signerKey = `mock_signer_${crypto.randomUUID()}`;
          let signatureUrl = null;

          if (apiKey && clickSignDocument) {
            // Create signer in ClickSign
            const clickSignSigner = await clickSignRequest('/signers', 'POST', {
              signer: {
                email: signer.email,
                name: signer.name,
                phone_number: signer.phone,
                auths: [signer.authMethod || 'email'],
                communicate_by: signer.authMethod || 'email',
              }
            });
            
            signerKey = clickSignSigner.signer.key;

            // Add signer to document
            const signerList = await clickSignRequest('/lists', 'POST', {
              list: {
                document_key: documentKey,
                signer_key: signerKey,
                sign_as: signer.signAs || 'sign',
                message: message,
              }
            });

            signatureUrl = signerList.list.url;
          }

          // Find client profile by email
          const { data: clientProfile } = await supabase
            .from('client_profiles')
            .select('id')
            .eq('email', signer.email)
            .single();

          // Save signer to database
          const { data: dbSigner, error: signerDbError } = await supabase
            .from('clicksign_signers')
            .insert({
              document_id: dbDocument.id,
              signer_key: signerKey,
              client_id: clientProfile?.id || null,
              email: signer.email,
              name: signer.name,
              role: signer.role,
              phone: signer.phone,
              auth_method: signer.authMethod || 'email',
              sign_as: signer.signAs || 'sign',
              status: apiKey ? 'sent' : 'pending',
              signature_url: signatureUrl,
            })
            .select()
            .single();

          if (signerDbError) {
            console.error('Signer database error:', signerDbError);
          } else {
            signerResults.push(dbSigner);
          }
        }

        console.log(`Document created: ${documentKey} with ${signerResults.length} signers`);

        return new Response(
          JSON.stringify({
            success: true,
            document: {
              id: dbDocument.id,
              key: documentKey,
              hash: documentHash,
              status: dbDocument.status,
              url: documentUrl,
              expiresAt: expiresAt.toISOString(),
            },
            signers: signerResults.map(s => ({
              id: s.id,
              email: s.email,
              name: s.name,
              status: s.status,
              signatureUrl: s.signature_url,
            })),
            mockMode: !apiKey,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add_signer': {
        const { documentKey, signer } = body as AddSignerRequest;
        
        if (!documentKey || !signer?.email || !signer?.name) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get document from database
        const { data: document, error: docError } = await supabase
          .from('clicksign_documents')
          .select('id, status')
          .eq('document_key', documentKey)
          .single();

        if (docError || !document) {
          return new Response(
            JSON.stringify({ error: 'Document not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const apiKey = Deno.env.get('CLICKSIGN_API_KEY');
        let signerKey = `mock_signer_${crypto.randomUUID()}`;
        let signatureUrl = null;

        if (apiKey) {
          // Create signer in ClickSign
          const clickSignSigner = await clickSignRequest('/signers', 'POST', {
            signer: {
              email: signer.email,
              name: signer.name,
              phone_number: signer.phone,
              auths: [signer.authMethod || 'email'],
            }
          });
          
          signerKey = clickSignSigner.signer.key;

          // Add signer to document
          const signerList = await clickSignRequest('/lists', 'POST', {
            list: {
              document_key: documentKey,
              signer_key: signerKey,
              sign_as: signer.signAs || 'sign',
            }
          });

          signatureUrl = signerList.list.url;
        }

        // Find client profile
        const { data: clientProfile } = await supabase
          .from('client_profiles')
          .select('id')
          .eq('email', signer.email)
          .single();

        // Save signer to database
        const { data: dbSigner, error: signerDbError } = await supabase
          .from('clicksign_signers')
          .insert({
            document_id: document.id,
            signer_key: signerKey,
            client_id: clientProfile?.id || null,
            email: signer.email,
            name: signer.name,
            role: signer.role,
            phone: signer.phone,
            auth_method: signer.authMethod || 'email',
            sign_as: signer.signAs || 'sign',
            status: apiKey ? 'sent' : 'pending',
            signature_url: signatureUrl,
          })
          .select()
          .single();

        if (signerDbError) {
          return new Response(
            JSON.stringify({ error: 'Failed to save signer' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            signer: {
              id: dbSigner.id,
              key: signerKey,
              email: dbSigner.email,
              name: dbSigner.name,
              status: dbSigner.status,
              signatureUrl,
            },
            mockMode: !apiKey,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_status': {
        const { documentKey } = body as GetDocumentStatusRequest;
        
        if (!documentKey) {
          return new Response(
            JSON.stringify({ error: 'Missing documentKey' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get document from database with signers
        const { data: document, error: docError } = await supabase
          .from('clicksign_documents')
          .select(`
            *,
            signers:clicksign_signers(*)
          `)
          .eq('document_key', documentKey)
          .single();

        if (docError || !document) {
          return new Response(
            JSON.stringify({ error: 'Document not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const apiKey = Deno.env.get('CLICKSIGN_API_KEY');
        let clickSignStatus = null;

        if (apiKey) {
          try {
            clickSignStatus = await clickSignRequest(`/documents/${documentKey}`, 'GET');
            
            // Update local status if different
            const newStatus = clickSignStatus.document.status;
            if (newStatus !== document.status) {
              await supabase
                .from('clicksign_documents')
                .update({ 
                  status: newStatus,
                  signed_at: newStatus === 'signed' ? new Date().toISOString() : null,
                })
                .eq('document_key', documentKey);
            }
          } catch (error) {
            console.error('Error fetching ClickSign status:', error);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            document: {
              id: document.id,
              key: document.document_key,
              hash: document.document_hash,
              status: clickSignStatus?.document?.status || document.status,
              url: document.document_url,
              expiresAt: document.expires_at,
              signedAt: document.signed_at,
              createdAt: document.created_at,
            },
            signers: document.signers.map((s: any) => ({
              id: s.id,
              email: s.email,
              name: s.name,
              role: s.role,
              status: s.status,
              signatureUrl: s.signature_url,
              signedAt: s.signed_at,
            })),
            mockMode: !apiKey,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel_document': {
        const { documentKey } = body as CancelDocumentRequest;
        
        if (!documentKey) {
          return new Response(
            JSON.stringify({ error: 'Missing documentKey' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const apiKey = Deno.env.get('CLICKSIGN_API_KEY');

        if (apiKey) {
          await clickSignRequest(`/documents/${documentKey}/cancel`, 'PATCH');
        }

        // Update database
        const { error: updateError } = await supabase
          .from('clicksign_documents')
          .update({ 
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('document_key', documentKey);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to update document status' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Document cancelled successfully',
            mockMode: !apiKey,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'notify_signers': {
        const { documentKey, signerKeys, message } = body as NotifySignersRequest;
        
        if (!documentKey) {
          return new Response(
            JSON.stringify({ error: 'Missing documentKey' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const apiKey = Deno.env.get('CLICKSIGN_API_KEY');

        if (apiKey) {
          await clickSignRequest(`/documents/${documentKey}/resend`, 'POST', {
            message,
            signer_keys: signerKeys,
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Notification sent to signers',
            mockMode: !apiKey,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    console.error('Error in clicksign function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
