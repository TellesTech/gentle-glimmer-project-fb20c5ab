// Logo do sistema para uso no PDF — busca dinamicamente da configuração
import { supabase } from '@/integrations/supabase/loose-client';

// Cache para armazenar a logo convertida
let cachedLogoBase64: string | null = null;
let cachedLogoUrl: string | null = null;

// Função para obter a logo em base64 (busca pdf_logo_url ou logo_url do system_settings)
export async function getLogoBase64(): Promise<string | null> {
  try {
    // Busca URL da logo do sistema
    const { data } = await supabase.rpc('get_public_branding');
    const settings = data?.[0];
    const logoUrl = settings?.pdf_logo_url || settings?.logo_url;

    if (!logoUrl) return null;

    // Retorna cache se a URL não mudou
    if (cachedLogoBase64 && cachedLogoUrl === logoUrl) {
      return cachedLogoBase64;
    }

    const response = await fetch(logoUrl);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        cachedLogoUrl = logoUrl;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
    return null;
  }
}
