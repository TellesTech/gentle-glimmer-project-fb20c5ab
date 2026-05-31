import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

// Helper function to format Brazilian phone numbers to international format
function formatBrazilianPhone(phone: string): string {
  // Remove everything except digits and +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with +, assume already international format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Remove leading 0 if present (e.g., 027999408663 -> 27999408663)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // 10-11 digits = Brazilian number without country code
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '+55' + cleaned;
  }
  
  // 12-13 digits starting with 55 = Brazilian number without +
  if (cleaned.length >= 12 && cleaned.startsWith('55')) {
    return '+' + cleaned;
  }
  
  // Return with + prefix as fallback
  return '+' + cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AUTENTIQUE_API_TOKEN = Deno.env.get("AUTENTIQUE_API_TOKEN");
    if (!AUTENTIQUE_API_TOKEN) {
      throw new Error("AUTENTIQUE_API_TOKEN não configurado");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log(`Autentique action: ${action}`, params);

    switch (action) {
      case "create_document": {
        const { reportId, signers, documentName, fileBase64, fileName, sandbox = false } = params;

        if (!reportId || !signers || !fileBase64 || !fileName) {
          throw new Error("Parâmetros obrigatórios: reportId, signers, fileBase64, fileName");
        }

        // Verificar se já existe documento pendente para este relatório
        const { data: existingPending } = await supabase
          .from("autentique_documents")
          .select("id, document_name")
          .eq("report_id", reportId)
          .eq("status", "pending")
          .is("archived_at", null)
          .maybeSingle();

        if (existingPending) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Já existe um documento pendente para este RDO. Cancele ou aguarde a assinatura antes de enviar novamente.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Build signers input for GraphQL - normalize action to uppercase
        // IMPORTANT: Autentique API only allows email OR phone, not both
        // For WhatsApp delivery, use phone with delivery_method
        const validActions = ["SIGN", "APPROVE"];
        const signersInput = signers.map((s: any) => {
          const normalizedAction = (s.action || "SIGN").toUpperCase();
          if (!validActions.includes(normalizedAction)) {
            throw new Error(`Ação inválida para signatário: ${s.action}. Use "SIGN" ou "APPROVE".`);
          }
          
          // Build signer data based on delivery method
          const signerData: any = {
            action: normalizedAction,
            name: s.name,
          };
          
          // WhatsApp delivery: use phone with delivery_method
          if (s.deliveryMethod === 'whatsapp' && s.phone) {
            signerData.phone = formatBrazilianPhone(s.phone);
            signerData.delivery_method = 'DELIVERY_METHOD_WHATSAPP';
            console.log(`Formatted phone for ${s.name}: ${s.phone} -> ${signerData.phone}`);
          } else {
            // Default: email delivery
            signerData.email = s.email;
          }
          
          return signerData;
        });

        // GraphQL mutation for creating document
        const mutation = `
          mutation CreateDocument(
            $document: DocumentInput!,
            $signers: [SignerInput!]!,
            $file: Upload!
          ) {
            createDocument(
              sandbox: ${sandbox},
              document: $document,
              signers: $signers,
              file: $file
            ) {
              id
              name
              refusable
              sortable
              created_at
              signatures {
                public_id
                name
                email
                created_at
                action { name }
                link { short_link }
                user { id name email }
              }
            }
          }
        `;

        const variables = {
          document: {
            name: documentName || fileName,
          },
          signers: signersInput,
        };

        // Convert base64 to blob for upload
        const fileBlob = base64ToBlob(fileBase64, getMimeType(fileName));

        // Create multipart form data
        const formData = new FormData();
        
        const operations = JSON.stringify({
          query: mutation,
          variables: variables,
        });
        
        const map = JSON.stringify({
          "0": ["variables.file"],
        });

        formData.append("operations", operations);
        formData.append("map", map);
        formData.append("0", fileBlob, fileName);

        console.log("Sending request to Autentique API...");

        const response = await fetch(AUTENTIQUE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
          },
          body: formData,
        });

        const result = await response.json();
        console.log("Autentique response:", JSON.stringify(result));

        if (result.errors) {
          throw new Error(result.errors[0]?.message || "Erro na API Autentique");
        }

        const doc = result.data?.createDocument;
        if (!doc) {
          throw new Error("Documento não criado");
        }

        // ========== AUTO-SIGN FOR OWNER ==========
        // Check if any signer is marked as "owner" and auto-sign for them
        const hasOwnerSigner = signers.some((s: any) => s.signer_type === 'owner');
        let autoSignSuccess = false;

        if (hasOwnerSigner) {
          console.log("Auto-signing document for owner...");
          
          const signMutation = `
            mutation SignDocument($id: UUID!) {
              signDocument(id: $id)
            }
          `;

          try {
            const signResponse = await fetch(AUTENTIQUE_API_URL, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${AUTENTIQUE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: signMutation,
                variables: { id: doc.id },
              }),
            });

            const signResult = await signResponse.json();
            console.log("Auto-sign result:", JSON.stringify(signResult));

            if (signResult.errors) {
              console.error("Auto-sign failed:", signResult.errors[0]?.message);
            } else if (signResult.data?.signDocument) {
              autoSignSuccess = true;
              console.log("Document auto-signed successfully for owner");
            }
          } catch (signError) {
            console.error("Auto-sign error:", signError);
          }
        }
        // ========== END AUTO-SIGN ==========

        // Save document to database
        const { data: docData, error: docError } = await supabase
          .from("autentique_documents")
          .insert({
            report_id: reportId,
            document_id: doc.id,
            document_name: doc.name,
            status: "pending",
            sandbox: sandbox,
            metadata: { refusable: doc.refusable, sortable: doc.sortable },
          })
          .select()
          .single();

        if (docError) {
          console.error("Error saving document:", docError);
          throw new Error("Erro ao salvar documento no banco");
        }

        // Save signers (only the signers we actually sent)
        if (doc.signatures && doc.signatures.length > 0) {
          // Build maps from email, phone, and name to original signer input (includes signer_type)
          // This allows matching signers sent via WhatsApp (no email) by name or phone
          const signersInputByKey: Record<string, any> = {};
          signers.forEach((s: any) => {
            if (s?.email) {
              signersInputByKey[`email:${String(s.email).toLowerCase().trim()}`] = s;
            }
            if (s?.phone) {
              signersInputByKey[`phone:${String(s.phone).replace(/\D/g, '')}`] = s;
            }
            if (s?.name) {
              signersInputByKey[`name:${String(s.name).toLowerCase().trim()}`] = s;
            }
          });
          
          console.log(`[Autentique] Signers input keys: ${Object.keys(signersInputByKey).join(', ')}`);

          const signersToInsert: any[] = [];

          for (const sig of doc.signatures) {
            // Try to find matching input signer by email first, then by name
            let inputSigner = null;
            
            if (sig.email) {
              const emailKey = `email:${String(sig.email).toLowerCase().trim()}`;
              inputSigner = signersInputByKey[emailKey];
            }
            
            if (!inputSigner && sig.name) {
              const nameKey = `name:${String(sig.name).toLowerCase().trim()}`;
              inputSigner = signersInputByKey[nameKey];
            }
            
            if (!inputSigner && sig.user?.name) {
              const userNameKey = `name:${String(sig.user.name).toLowerCase().trim()}`;
              inputSigner = signersInputByKey[userNameKey];
            }
            
            // Skip if no public_id (required for tracking)
            if (!sig.public_id) {
              console.log(`[Autentique] Skipping signer without public_id: ${sig.name || sig.email}`);
              continue;
            }
            
            // If we still can't match, save anyway with default values (for WhatsApp signers)
            if (!inputSigner) {
              console.log(`[Autentique] No input match for signer: ${sig.name || sig.email}, saving with defaults`);
            }

            // Fallback chain for name: sig.name -> sig.user?.name -> input signer name -> "Signatário"
            const signerName = sig.name || sig.user?.name || inputSigner?.name || "Signatário";
            const actionName = (sig.action?.name || inputSigner?.action || "SIGN").toUpperCase();

            // For signers with email, Autentique sends the link directly to their email
            // and does NOT return a short_link. The createLinkToSignature mutation is only
            // for signers added without email. So we just store whatever link is returned.
            const signLink: string | null = sig.link?.short_link ?? null;
            
            // If owner and auto-sign was successful, mark as signed
            const isOwnerAndSigned = inputSigner?.signer_type === 'owner' && autoSignSuccess;
            console.log(`[Autentique] Signer ${sig.name || sig.email}: link=${signLink ? 'available' : 'sent via email/whatsapp'}, type=${inputSigner?.signer_type || 'client'}, autoSigned=${isOwnerAndSigned}`);

            signersToInsert.push({
              document_id: docData.id,
              signer_id: sig.public_id,
              name: signerName,
              email: sig.email || inputSigner?.email || null,
              phone: inputSigner?.phone || null,
              action: actionName,
              sign_link: signLink,
              status: isOwnerAndSigned ? "signed" : "pending",
              signed_at: isOwnerAndSigned ? new Date().toISOString() : null,
              signer_type: inputSigner?.signer_type || "client",
              delivery_method: inputSigner?.deliveryMethod || (sig.email ? "email" : "whatsapp"),
            });
          }

          if (signersToInsert.length > 0) {
            const { error: signersError } = await supabase
              .from("autentique_signers")
              .insert(signersToInsert);

            if (signersError) {
              console.error("Error saving signers:", signersError);
            }
          }
        }


        return new Response(
          JSON.stringify({
            success: true,
            document: docData,
            autentiqueDocument: doc,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_document": {
        const { documentId } = params;

        // Use GraphQL variables to prevent injection
        const query = `
          query GetDocument($id: UUID!) {
            document(id: $id) {
              id
              name
              refusable
              sortable
              created_at
              files {
                original
                signed
              }
              signatures {
                public_id
                name
                email
                action { name }
                link { short_link }
                viewed { created_at }
                signed { created_at ip_address }
                rejected { reason created_at }
              }
            }
          }
        `;

        const response = await fetch(AUTENTIQUE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables: { id: documentId } }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0]?.message || "Erro ao buscar documento");
        }

        return new Response(
          JSON.stringify({ success: true, document: result.data?.document }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_document": {
        const { documentId } = params;

        // Use GraphQL variables to prevent injection
        const mutation = `
          mutation DeleteDocument($id: UUID!) {
            deleteDocument(id: $id)
          }
        `;

        const response = await fetch(AUTENTIQUE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: mutation, variables: { id: documentId } }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0]?.message || "Erro ao cancelar documento");
        }

        // Update local database
        await supabase
          .from("autentique_documents")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("document_id", documentId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "resend_signature": {
        const { signerId } = params;

        if (!signerId) {
          throw new Error("signerId é obrigatório para resend_signature");
        }

        // Use GraphQL variables to prevent injection - Autentique expects UUID type
        const mutation = `
          mutation ResendSignatures($publicIds: [UUID]!) {
            resendSignatures(public_ids: $publicIds)
          }
        `;
        await autentiqueGraphqlRequest(AUTENTIQUE_API_TOKEN, mutation, { publicIds: [signerId] });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync_document": {
        const { documentId, internalDocId, reportId } = params;

        if (!documentId) {
          throw new Error("documentId é obrigatório para sync_document");
        }

        // Fetch document from Autentique API using GraphQL variables
        const query = `
          query GetDocument($id: UUID!) {
            document(id: $id) {
              id
              name
              refusable
              sortable
              created_at
              files {
                original
                signed
              }
              signatures {
                public_id
                name
                email
                action { name }
                link { short_link }
                viewed { created_at }
                signed { created_at }
                rejected { reason created_at }
              }
            }
          }
        `;

        const response = await fetch(AUTENTIQUE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables: { id: documentId } }),
        });

        const result = await response.json();
        console.log("Sync document response:", JSON.stringify(result));

        if (result.errors) {
          const errorMessage = result.errors[0]?.message || "Erro ao buscar documento";
          console.log("Autentique API error:", errorMessage);
          
          // Check if document not found - update local status instead of throwing
          if (errorMessage.includes("not found") || errorMessage.includes("não encontrado") || errorMessage.includes("document_not_found")) {
            const { data: localDoc } = await supabase
              .from("autentique_documents")
              .select("id")
              .eq("document_id", documentId)
              .maybeSingle();

            if (localDoc) {
              await supabase
                .from("autentique_documents")
                .update({ 
                  status: "not_found",
                  updated_at: new Date().toISOString()
                })
                .eq("id", localDoc.id);
            }

            return new Response(
              JSON.stringify({ 
                success: true, 
                status: "not_found",
                message: "Documento não encontrado na Autentique (pode ter expirado ou sido deletado)"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          throw new Error(errorMessage);
        }

        const docData = result.data?.document;
        if (!docData) {
          // Document returned null - also mark as not found
          const { data: localDoc } = await supabase
            .from("autentique_documents")
            .select("id")
            .eq("document_id", documentId)
            .maybeSingle();

          if (localDoc) {
            await supabase
              .from("autentique_documents")
              .update({ 
                status: "not_found",
                updated_at: new Date().toISOString()
              })
              .eq("id", localDoc.id);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              status: "not_found",
              message: "Documento não encontrado na Autentique (pode ter expirado ou sido deletado)"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find the document in our database
        const { data: localDoc, error: findError } = await supabase
          .from("autentique_documents")
          .select("*")
          .eq("document_id", documentId)
          .maybeSingle();

        if (findError || !localDoc) {
          throw new Error("Documento não encontrado no banco local");
        }

        // Only process signatures that exist in our local DB for this document
        const { data: localSigners, error: localSignersError } = await supabase
          .from("autentique_signers")
          .select("signer_id")
          .eq("document_id", localDoc.id);

        if (localSignersError) {
          console.error("Error fetching local signers:", localSignersError);
        }

        const localSignerIdSet = new Set(
          (localSigners || [])
            .map((s: any) => s.signer_id)
            .filter((id: any): id is string => typeof id === "string" && id.length > 0)
        );

        // Process each signature to determine status
        const signatures = docData.signatures || [];
        let allSigned = signatures.length > 0; // Start true only if there are signers
        let anyRejected = false;
        let processedCount = 0;

        for (const sig of signatures) {
          if (!sig.public_id) {
            continue;
          }

          // Check if signer exists locally
          const signerExistsLocally = localSignerIdSet.has(sig.public_id);

          // Determine signer status
          let status = "pending";
          let signed_at = null;
          let ip_address = null;

          if (sig.rejected?.created_at) {
            status = "rejected";
            anyRejected = true;
            allSigned = false;
          } else if (sig.signed?.created_at) {
            status = "signed";
            signed_at = sig.signed.created_at;
            ip_address = sig.signed.ip_address;
          } else if (sig.viewed?.created_at) {
            status = "viewed";
            allSigned = false;
          } else {
            allSigned = false;
          }

          // For signers with email, Autentique sends the link directly to their email
          const signLink: string | null = sig.link?.short_link ?? null;
          console.log(`Sync signer ${sig.email}: status=${status}, existsLocally=${signerExistsLocally}, link=${signLink ? 'available' : 'sent via email'}`);

          // If signer doesn't exist locally, add them to the database
          if (!signerExistsLocally) {
            console.log(`[Autentique Sync] Adding missing signer: ${sig.name || sig.email}`);
            
            // Infer delivery method: if no email, assume WhatsApp
            const hasEmail = sig.email && sig.email.trim().length > 0;
            const inferredDeliveryMethod = hasEmail ? "email" : "whatsapp";
            
            const { error: insertError } = await supabase
              .from("autentique_signers")
              .insert({
                document_id: localDoc.id,
                signer_id: sig.public_id,
                name: sig.name || sig.user?.name || "Signatário",
                email: hasEmail ? sig.email : null,
                action: (sig.action?.name || "SIGN").toUpperCase(),
                status,
                signed_at,
                ip_address,
                sign_link: signLink,
                signer_type: "client", // Missing signers are typically clients
                delivery_method: inferredDeliveryMethod,
              });

            if (insertError) {
              console.error("Error inserting missing signer:", insertError);
            } else {
              processedCount++;
            }
          } else {
            // Update existing signer in database
            const updatePayload: Record<string, unknown> = {
              status,
              signed_at,
              ip_address,
              name: sig.name || "Signatário",
            };
            if (signLink) updatePayload.sign_link = signLink;

            const { error: updateSignerError } = await supabase
              .from("autentique_signers")
              .update(updatePayload)
              .eq("document_id", localDoc.id)
              .eq("signer_id", sig.public_id);

            if (updateSignerError) {
              console.error("Error updating signer:", updateSignerError);
            } else {
              processedCount++;
            }
          }
        }

        if (signatures.length === 0) {
          allSigned = false;
        }


        // Determine document status
        let docStatus = "pending";
        if (anyRejected) {
          docStatus = "rejected";
        } else if (allSigned) {
          docStatus = "signed";
        }

        // Update document status
        const updateData: any = { status: docStatus };
        if (docStatus === "signed") {
          updateData.signed_at = new Date().toISOString();
          // Save the signed file URL if available
          if (docData.files?.signed) {
            updateData.signed_file_url = docData.files.signed;
          }
        }

        await supabase
          .from("autentique_documents")
          .update(updateData)
          .eq("id", localDoc.id);

        // Update report status when document is signed
        if (docStatus === "signed" && localDoc.report_id) {
          console.log(`Updating report ${localDoc.report_id} status to 'signed'`);
          await supabase
            .from("reports")
            .update({ status: "signed" })
            .eq("id", localDoc.report_id);
        }

        // If all signed, insert into report_signatures (avoid duplicates)
        if (allSigned && localDoc.report_id) {
          for (const sig of signatures) {
            if (sig.signed?.created_at) {
              // Check if already exists
              const { data: existing } = await supabase
                .from("report_signatures")
                .select("id")
                .eq("report_id", localDoc.report_id)
                .eq("signature_data", `autentique:${sig.public_id}`)
                .maybeSingle();

              if (!existing) {
                await supabase
                  .from("report_signatures")
                  .insert({
                    report_id: localDoc.report_id,
                    signer_name: sig.name || "Signatário",
                    signer_role: "Cliente",
                    signature_data: `autentique:${sig.public_id}`,
                    ip_address: sig.signed.ip_address,
                    signed_at: sig.signed.created_at,
                  });
              }
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: docStatus,
            document: docData,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "download_signed_pdf": {
        const { documentId } = params;

        if (!documentId) {
          throw new Error("documentId é obrigatório para download_signed_pdf");
        }

        console.log("Downloading signed PDF for document:", documentId);

        // Fetch document from Autentique API to get signed PDF URL
        const query = `
          query GetDocument($id: UUID!) {
            document(id: $id) {
              id
              name
              files {
                signed
              }
            }
          }
        `;

        const response = await fetch(AUTENTIQUE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables: { id: documentId } }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0]?.message || "Erro ao buscar documento");
        }

        const docData = result.data?.document;
        if (!docData?.files?.signed) {
          throw new Error("URL do PDF assinado não encontrada");
        }

        const signedUrl = docData.files.signed;
        console.log("Fetching PDF from:", signedUrl);

        // Download the PDF from Autentique
        const pdfResponse = await fetch(signedUrl);
        
        if (!pdfResponse.ok) {
          throw new Error(`Erro ao baixar PDF: ${pdfResponse.status}`);
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);
        
        // Convert to base64
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < pdfBytes.length; i += chunkSize) {
          const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const pdfBase64 = btoa(binary);

        console.log("PDF downloaded successfully, size:", pdfBytes.length, "bytes");

        return new Response(
          JSON.stringify({
            success: true,
            fileName: `${docData.name || "documento-assinado"}.pdf`,
            fileBase64: pdfBase64,
            contentType: "application/pdf",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      case "sync_all_pending": {
        // Fetch all pending documents and sync each one
        const { data: pendingDocs, error: pendingError } = await supabase
          .from("autentique_documents")
          .select("id, document_id, report_id")
          .eq("status", "pending")
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (pendingError) {
          throw new Error("Erro ao buscar documentos pendentes: " + pendingError.message);
        }

        const results: Array<{ documentId: string; status: string; error?: string }> = [];

        for (const doc of pendingDocs || []) {
          try {
            // Fetch document from Autentique API
            const syncQuery = `
              query GetDocument($id: UUID!) {
                document(id: $id) {
                  id
                  name
                  files { signed }
                  signatures {
                    public_id
                    name
                    email
                    action { name }
                    link { short_link }
                    viewed { created_at }
                    signed { created_at ip_address }
                    rejected { reason created_at }
                  }
                }
              }
            `;

            const syncResponse = await fetch(AUTENTIQUE_API_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: syncQuery, variables: { id: doc.document_id } }),
            });

            const syncResult = await syncResponse.json();

            if (syncResult.errors) {
              const errMsg = syncResult.errors[0]?.message || "API error";
              console.log(`Sync failed for ${doc.document_id}: ${errMsg}`);
              
              // Mark as not_found if document doesn't exist
              if (errMsg.includes("not found") || errMsg.includes("não encontrado")) {
                await supabase
                  .from("autentique_documents")
                  .update({ status: "not_found", updated_at: new Date().toISOString() })
                  .eq("id", doc.id);
              }
              
              results.push({ documentId: doc.document_id, status: "error", error: errMsg });
              continue;
            }

            const docData = syncResult.data?.document;
            if (!docData) {
              await supabase
                .from("autentique_documents")
                .update({ status: "not_found", updated_at: new Date().toISOString() })
                .eq("id", doc.id);
              results.push({ documentId: doc.document_id, status: "not_found" });
              continue;
            }

            // Get local signers
            const { data: localSigners } = await supabase
              .from("autentique_signers")
              .select("signer_id")
              .eq("document_id", doc.id);

            const localSignerIdSet = new Set(
              (localSigners || []).map((s: any) => s.signer_id).filter(Boolean)
            );

            // Process signatures
            const signatures = docData.signatures || [];
            let allSigned = signatures.length > 0;
            let anyRejected = false;

            for (const sig of signatures) {
              if (!sig.public_id) continue;

              let sigStatus = "pending";
              let signed_at = null;
              let ip_address = null;

              if (sig.rejected?.created_at) {
                sigStatus = "rejected";
                anyRejected = true;
                allSigned = false;
              } else if (sig.signed?.created_at) {
                sigStatus = "signed";
                signed_at = sig.signed.created_at;
                ip_address = sig.signed.ip_address;
              } else if (sig.viewed?.created_at) {
                sigStatus = "viewed";
                allSigned = false;
              } else {
                allSigned = false;
              }

              if (!localSignerIdSet.has(sig.public_id)) {
                // Insert missing signer
                await supabase.from("autentique_signers").insert({
                  document_id: doc.id,
                  signer_id: sig.public_id,
                  name: sig.name || "Signatário",
                  email: sig.email || null,
                  action: (sig.action?.name || "SIGN").toUpperCase(),
                  status: sigStatus,
                  signed_at,
                  ip_address,
                  sign_link: sig.link?.short_link || null,
                  signer_type: "client",
                  delivery_method: sig.email ? "email" : "whatsapp",
                });
              } else {
                // Update existing signer
                const updatePayload: Record<string, unknown> = {
                  status: sigStatus, signed_at, ip_address,
                  name: sig.name || "Signatário",
                };
                if (sig.link?.short_link) updatePayload.sign_link = sig.link.short_link;

                await supabase
                  .from("autentique_signers")
                  .update(updatePayload)
                  .eq("document_id", doc.id)
                  .eq("signer_id", sig.public_id);
              }
            }

            if (signatures.length === 0) allSigned = false;

            // Update document status
            let docStatus = "pending";
            if (anyRejected) docStatus = "rejected";
            else if (allSigned) docStatus = "signed";

            const updateData: any = { status: docStatus, updated_at: new Date().toISOString() };
            if (docStatus === "signed") {
              updateData.signed_at = new Date().toISOString();
              if (docData.files?.signed) updateData.signed_file_url = docData.files.signed;
            }

            await supabase.from("autentique_documents").update(updateData).eq("id", doc.id);

            // Update report status
            if (docStatus === "signed" && doc.report_id) {
              await supabase.from("reports").update({ status: "signed" }).eq("id", doc.report_id);
            }

            results.push({ documentId: doc.document_id, status: docStatus });
          } catch (syncErr: any) {
            console.error(`Error syncing doc ${doc.document_id}:`, syncErr);
            results.push({ documentId: doc.document_id, status: "error", error: syncErr.message });
          }
        }

        const synced = results.filter(r => r.status === "signed").length;
        const pending = results.filter(r => r.status === "pending").length;

        return new Response(
          JSON.stringify({ 
            success: true, 
            total: results.length,
            synced,
            pending,
            results 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Autentique function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function autentiqueGraphqlRequest(
  token: string,
  query: string,
  variables?: Record<string, unknown>
) {
  const response = await fetch(AUTENTIQUE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Erro HTTP Autentique: ${response.status}`);
  }

  if (result?.errors?.length) {
    throw new Error(result.errors[0]?.message || "Erro na API Autentique");
  }

  return result?.data;
}

async function createAutentiqueSignatureLink(token: string, signaturePublicId: string) {
  // Use GraphQL variables to prevent injection
  const mutation = `
    mutation CreateSignatureLink($publicId: String!) {
      createLinkToSignature(public_id: $publicId) {
        short_link
      }
    }
  `;

  const data = await autentiqueGraphqlRequest(token, mutation, { publicId: signaturePublicId });
  return data?.createLinkToSignature?.short_link ?? null;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    html: "text/html",
  };
  return mimeTypes[ext || "pdf"] || "application/octet-stream";
}
