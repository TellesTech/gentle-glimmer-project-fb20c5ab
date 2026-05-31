import { useEffect } from 'react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { hexToHsl, getForegroundColor } from '@/lib/colorUtils';

export function ThemeApplicator() {
  const { settings, isLoading } = useSystemSettings();

  useEffect(() => {
    if (isLoading || !settings) return;

    const root = document.documentElement;

    // Aplica cor primária
    if (settings.primary_color) {
      const primaryHsl = hexToHsl(settings.primary_color);
      const primaryForeground = getForegroundColor(settings.primary_color);
      
      root.style.setProperty('--primary', primaryHsl);
      root.style.setProperty('--primary-foreground', primaryForeground);
      root.style.setProperty('--ring', primaryHsl);
      root.style.setProperty('--sidebar-primary', primaryHsl);
      root.style.setProperty('--sidebar-primary-foreground', primaryForeground);
      root.style.setProperty('--chart-1', primaryHsl);
    }

    // Aplica cor de destaque (accent)
    if (settings.accent_color) {
      const accentHsl = hexToHsl(settings.accent_color);
      const accentForeground = getForegroundColor(settings.accent_color);
      
      root.style.setProperty('--accent', accentHsl);
      root.style.setProperty('--accent-foreground', accentForeground);
      root.style.setProperty('--sidebar-accent', accentHsl);
      root.style.setProperty('--sidebar-accent-foreground', accentForeground);
      root.style.setProperty('--chart-2', accentHsl);
    }

    // Aplica favicon dinamicamente
    if (settings.favicon_url) {
      const existingFavicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (existingFavicon) {
        existingFavicon.href = settings.favicon_url;
      } else {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.href = settings.favicon_url;
        document.head.appendChild(favicon);
      }
    }

    // Atualiza título da página com nome do sistema
    if (settings.system_name) {
      const currentTitle = document.title;
      // Mantém o título atual se já tiver algo, senão usa o nome do sistema
      if (!currentTitle || currentTitle === 'Vite + React + TS') {
        document.title = settings.system_name;
      }
    }
  }, [settings, isLoading]);

  // Componente invisível - apenas aplica estilos
  return null;
}
