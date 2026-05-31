import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidatePinResponse {
  success: boolean;
  token_hash?: string;
  email?: string;
  error?: string;
  retryable?: boolean;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function respond(payload: ValidatePinResponse) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRetryableAuthError(error: unknown) {
  const message = `${(error as { message?: string } | null)?.message ?? ''}`.toLowerCase();

  return (
    message.includes('remaining connection slots') ||
    message.includes('database error finding user') ||
    message.includes('unexpected_failure') ||
    message.includes('temporarily unavailable') ||
    message.includes('temporariamente indisponível')
  );
}

async function generateLinkWithRetry(supabase: any, email: string) {
  const delays = [300, 700, 1500, 3000, 5000];
  let linkData: any = null;
  let linkError: any = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    const result = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    linkData = result.data;
    linkError = result.error;

    if (!linkError && linkData?.properties?.hashed_token) {
      return { linkData, linkError: null };
    }

    console.warn(`generateLink attempt ${attempt + 1} failed for ${email}:`, linkError?.message);

    if (attempt < delays.length - 1) {
      await wait(delays[attempt]);
    }
  }

  return { linkData, linkError };
}

// Verify PIN against stored hash using Web Crypto API
// Supports both formats: new (saltBase64:hashBase64) and legacy (single base64 with salt+hash concatenated)
async function verifyPin(pin: string, storedHash: string): Promise<{ valid: boolean; isLegacy: boolean; newHash?: string }> {
  try {
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);

    if (storedHash.includes(':')) {
      console.log('Verifying PIN with new format (salt:hash)');
      const [saltBase64, hashBase64] = storedHash.split(':');
      if (!saltBase64 || !hashBase64) return { valid: false, isLegacy: false };

      const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));
      const combined = new Uint8Array(salt.length + pinData.length);
      combined.set(salt);
      combined.set(pinData, salt.length);

      const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
      const hashArray = new Uint8Array(hashBuffer);
      const computedHash = btoa(String.fromCharCode(...hashArray));

      return { valid: computedHash === hashBase64, isLegacy: false };
    }

    console.log('Verifying PIN with legacy format (concatenated base64)');
    const decoded = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));

    if (decoded.length !== 48) {
      console.error('Invalid legacy hash length:', decoded.length);
      return { valid: false, isLegacy: true };
    }

    const salt = decoded.slice(0, 16);
    const expectedHash = decoded.slice(16, 48);

    const combined = new Uint8Array(salt.length + pinData.length);
    combined.set(salt);
    combined.set(pinData, salt.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const computedHashArray = new Uint8Array(hashBuffer);

    let isValid = true;
    for (let i = 0; i < expectedHash.length; i++) {
      if (computedHashArray[i] !== expectedHash[i]) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      const newSaltBase64 = btoa(String.fromCharCode(...salt));
      const newHashBase64 = btoa(String.fromCharCode(...computedHashArray));
      return { valid: true, isLegacy: true, newHash: `${newSaltBase64}:${newHashBase64}` };
    }

    return { valid: false, isLegacy: true };
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return { valid: false, isLegacy: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, email, pin } = body;

    if (!userId && !email) {
      return respond({ success: false, error: 'userId ou email são obrigatórios' });
    }

    if (!pin) {
      return respond({ success: false, error: 'PIN é obrigatório' });
    }

    if (!/^\d{4}$/.test(pin)) {
      return respond({ success: false, error: 'PIN deve ter exatamente 4 dígitos' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (email) {
      console.log('Looking up PIN by email in company_contacts:', email);
      const { data: contact, error: contactError } = await supabase
        .from('company_contacts')
        .select('id, email, pin_hash, user_id')
        .eq('email', email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (contactError) {
        console.error('Contact lookup error:', contactError);
        return respond({ success: false, error: 'Erro ao buscar contato' });
      }

      if (!contact) {
        return respond({ success: false, error: 'Contato não encontrado' });
      }

      if (!contact.pin_hash) {
        return respond({ success: false, error: 'PIN não configurado para este contato' });
      }

      const verifyResult = await verifyPin(pin, contact.pin_hash);
      if (!verifyResult.valid) {
        return respond({ success: false, error: 'PIN incorreto' });
      }

      if (verifyResult.isLegacy && verifyResult.newHash) {
        console.log('Migrating legacy PIN hash for contact:', contact.id);
        await supabase.from('company_contacts').update({ pin_hash: verifyResult.newHash }).eq('id', contact.id);
      }

      if (!contact.user_id) {
        return respond({ success: false, error: 'Usuário de autenticação não configurado para este contato' });
      }

      // Defensive guard: refuse PIN login if the linked auth user is an internal collaborator.
      // Avoids cross-contamination between client PIN flow and the WEES collaborator login.
      const { data: internalRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', contact.user_id)
        .maybeSingle();
      if (internalRole) {
        return respond({
          success: false,
          error: 'Este e-mail pertence a um colaborador interno. Acesse pelo login de colaborador.',
        });
      }

      const { linkData, linkError } = await generateLinkWithRetry(supabase, contact.email);
      if (linkError || !linkData?.properties?.hashed_token) {
        console.error('Error generating link after retries:', linkError);
        return respond({
          success: false,
          error: 'Servidor de autenticação temporariamente indisponível. Tente novamente em instantes.',
          retryable: isRetryableAuthError(linkError),
        });
      }

      console.log('PIN validated successfully for contact:', contact.id);
      return respond({
        success: true,
        token_hash: linkData.properties.hashed_token,
        email: contact.email,
      });
    }

    console.log('Looking up PIN by userId in profiles:', userId);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, pin_hash')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return respond({ success: false, error: 'Usuário não encontrado' });
    }

    if (!profile.pin_hash) {
      return respond({ success: false, error: 'PIN não configurado para este usuário' });
    }

    const verifyResult = await verifyPin(pin, profile.pin_hash);
    if (!verifyResult.valid) {
      return respond({ success: false, error: 'PIN incorreto' });
    }

    if (verifyResult.isLegacy && verifyResult.newHash) {
      console.log('Migrating legacy PIN hash for user:', userId);
      await supabase.from('profiles').update({ pin_hash: verifyResult.newHash }).eq('id', userId);
    }

    const { linkData, linkError } = await generateLinkWithRetry(supabase, profile.email);
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('Error generating link after retries:', linkError);
      return respond({
        success: false,
        error: 'Servidor de autenticação temporariamente indisponível. Tente novamente em instantes.',
        retryable: isRetryableAuthError(linkError),
      });
    }

    console.log('PIN validated successfully for user:', userId);
    return respond({
      success: true,
      token_hash: linkData.properties.hashed_token,
      email: profile.email,
    });
  } catch (error) {
    console.error('Error in validate-pin:', error);
    return respond({ success: false, error: 'Erro interno do servidor' });
  }
});