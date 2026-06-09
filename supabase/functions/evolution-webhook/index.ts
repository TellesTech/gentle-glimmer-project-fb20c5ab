// Evolution API → Z-API adapter
// Recebe webhooks da Evolution API (Hostinger), normaliza o payload para o
// formato esperado pela função `zapi-webhook` (que já contém toda a lógica
// de processamento de RDOs) e encaminha a requisição.
//
// Eventos tratados: messages.upsert (mensagens recebidas).
// Outros eventos (connection.update, messages.update, qrcode.updated, ...) são ignorados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "";

const ZAPI_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/zapi-webhook`;

function extractText(message: any): string {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    ""
  );
}

function detectImage(message: any): boolean {
  if (!message) return false;
  return !!(
    message.imageMessage ||
    message.stickerMessage ||
    (message.documentMessage?.mimetype || "").startsWith("image/")
  );
}

// Faz download de mídia via Evolution API e faz upload pública para reutilizar no zapi-webhook
async function fetchMediaPublicUrl(rawData: any): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    console.error("Evolution credentials missing — cannot fetch media");
    return null;
  }

  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(EVOLUTION_INSTANCE_NAME)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          message: { key: rawData.key, message: rawData.message },
          convertToMp4: false,
        }),
      }
    );

    if (!res.ok) {
      const errTxt = await res.text();
      console.error(`Evolution getBase64 failed [${res.status}]: ${errTxt}`);
      return null;
    }

    const json = await res.json();
    const base64 = json.base64 || json.data?.base64;
    const mimetype = json.mimetype || json.data?.mimetype || "image/jpeg";
    if (!base64) {
      console.error("Evolution getBase64: no base64 in response", JSON.stringify(json).slice(0, 200));
      return null;
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ext = mimetype.includes("png") ? "png" : "jpg";
    const fileName = `evolution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("service-report-photos")
      .upload(fileName, bytes, { contentType: mimetype });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      return null;
    }

    const { data: pub } = supabase.storage.from("service-report-photos").getPublicUrl(fileName);
    return pub.publicUrl;
  } catch (err) {
    console.error("fetchMediaPublicUrl error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    console.log("Evolution webhook payload:", JSON.stringify(payload).slice(0, 1500));

    const event = payload.event || payload.type;
    if (event && event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
      return new Response(JSON.stringify({ status: "ignored", reason: `event=${event}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data || payload;
    const key = data.key;
    const message = data.message;

    if (!key || !message) {
      return new Response(JSON.stringify({ status: "ignored", reason: "no_key_or_message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (key.fromMe === true) {
      return new Response(JSON.stringify({ status: "ignored", reason: "from_me" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid: string = key.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");
    const chatId = remoteJid;
    const participantJid: string = key.participant || (isGroup ? "" : remoteJid);
    const senderPhone = (participantJid || remoteJid).split("@")[0] || null;
    const messageId = key.id;
    const senderName = data.pushName || data.notifyName || "";
    const text = extractText(message);
    const hasImage = detectImage(message);

    let mediaUrl: string | null = null;
    if (hasImage) {
      mediaUrl = await fetchMediaPublicUrl(data);
      if (!mediaUrl) console.warn("Image received but media download failed");
    }

    const zapiPayload: Record<string, unknown> = {
      messageId,
      chatId,
      phone: senderPhone,
      isGroup,
      participantPhone: senderPhone,
      senderName,
      notifyName: senderName,
      pushName: senderName,
      text: text ? { message: text } : undefined,
      body: text || undefined,
      isMedia: hasImage,
      messageType: hasImage ? "image" : "text",
      mediaUrl: mediaUrl || undefined,
      image: mediaUrl ? { imageUrl: mediaUrl, url: mediaUrl, caption: text } : undefined,
      _evolution: data,
    };

    const forwardRes = await fetch(ZAPI_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(zapiPayload),
    });

    const forwardText = await forwardRes.text();
    console.log(`Forwarded to zapi-webhook [${forwardRes.status}]: ${forwardText.slice(0, 300)}`);

    return new Response(
      JSON.stringify({
        status: "forwarded",
        upstream_status: forwardRes.status,
        upstream_body: forwardText.slice(0, 500),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("evolution-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});