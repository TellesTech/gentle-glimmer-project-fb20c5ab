// Envia texto pelo WhatsApp que captura os RDOs (instância UAZAPI).
import { getUazapiConfig, getUazapiToken } from "./uazapiConfig.ts";

export function normalizePhone(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

export async function sendWhatsAppText(phone: string, text: string): Promise<{ ok: boolean; status: number; body: string }> {
  const cfg = await getUazapiConfig();
  const { token } = await getUazapiToken(cfg);
  if (!token) return { ok: false, status: 400, body: "Token do WhatsApp não configurado" };
  const res = await fetch(`${cfg.baseUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: phone, text }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
