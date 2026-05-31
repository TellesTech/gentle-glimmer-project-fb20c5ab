import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  password: string;
  loginUrl: string;
}

const generateEmailHtml = (name: string, email: string, password: string, loginUrl: string): string => {
  // Logo WEES em base64 (versão light para fundo escuro)
  const weesLogoBase64 = `data:image/png;base64,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`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Sistema RDO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #720808 0%, #9a1c1c 100%); padding: 40px 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="${weesLogoBase64}" alt="WEES Soluções" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 14px;">Sistema RDO - Gestão de Atividades</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Welcome Icon -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #720808 0%, #9a1c1c 100%); border-radius: 50%; line-height: 80px;">
                  <span style="font-size: 36px; color: white;">🎉</span>
                </div>
              </div>
              
              <h2 style="color: #333333; margin: 0 0 20px; font-size: 24px; text-align: center; font-weight: 600;">
                Bem-vindo ao Sistema RDO!
              </h2>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Olá, <strong style="color: #720808;">${name}</strong>!
              </p>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                Sua conta foi criada com sucesso no Sistema RDO. Abaixo estão suas credenciais de acesso:
              </p>
              
              <!-- Credentials Box -->
              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                      <span style="color: #666666; font-size: 14px;">📧 Email:</span>
                      <span style="color: #333333; font-size: 16px; font-weight: 600; float: right;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="color: #666666; font-size: 14px;">🔐 Senha:</span>
                      <span style="color: #333333; font-size: 16px; font-weight: 600; float: right; font-family: 'Courier New', monospace; background-color: #fff3cd; padding: 4px 8px; border-radius: 4px;">${password}</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Warning -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  ⚠️ <strong>Importante:</strong> Recomendamos que você altere sua senha no primeiro acesso para garantir a segurança da sua conta.
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #720808 0%, #9a1c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(114, 8, 8, 0.3);">
                  Acessar o Sistema
                </a>
              </div>
              
              <p style="color: #888888; font-size: 14px; text-align: center; margin: 0;">
                Se você não solicitou esta conta, por favor ignore este email ou entre em contato conosco.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e9ecef;">
              <img src="${weesLogoBase64}" alt="WEES Soluções" style="max-width: 100px; height: auto; margin-bottom: 10px; filter: grayscale(100%) brightness(0.5);" />
              <p style="color: #888888; margin: 0; font-size: 13px;">
                Sistema RDO - Gestão de Atividades
              </p>
              <p style="color: #aaaaaa; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} WEES Soluções. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Encode string to base64
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Simple SMTP client using raw TLS connection
async function sendEmailViaSMTP(
  host: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  console.log(`Connecting to ${host}:${port}...`);
  
  const conn = await Deno.connectTls({
    hostname: host,
    port: port,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Read until we get a complete SMTP response (may be multiline)
  async function readFullResponse(): Promise<string> {
    let fullResponse = '';
    const buffer = new Uint8Array(4096);
    
    while (true) {
      const n = await conn.read(buffer);
      if (n === null) throw new Error("Connection closed unexpectedly");
      
      const chunk = decoder.decode(buffer.subarray(0, n));
      fullResponse += chunk;
      
      // SMTP responses end when we see a line starting with 3 digits followed by a space
      const lines = fullResponse.split('\r\n');
      const lastNonEmptyLine = lines.filter(l => l.length > 0).pop() || '';
      
      // Check if the last line is a final response (digit digit digit space)
      if (/^\d{3} /.test(lastNonEmptyLine) || /^\d{3}$/.test(lastNonEmptyLine)) {
        break;
      }
      
      // Also break if we've received enough data
      if (fullResponse.length > 8192) {
        break;
      }
    }
    
    return fullResponse;
  }

  async function sendCommand(cmd: string): Promise<string> {
    const logCmd = cmd.startsWith('AUTH') ? 'AUTH LOGIN' : 
                   cmd.length > 100 ? cmd.substring(0, 50) + '...' : cmd.trim();
    console.log(`SMTP > ${logCmd}`);
    await conn.write(encoder.encode(cmd + "\r\n"));
    const response = await readFullResponse();
    console.log(`SMTP < ${response.substring(0, 150).trim().replace(/\r?\n/g, ' | ')}`);
    return response;
  }

  // Get the status code from the last line of response
  function getStatusCode(response: string): string {
    const lines = response.trim().split(/\r?\n/).filter(l => l.length > 0);
    const lastLine = lines[lines.length - 1] || '';
    return lastLine.substring(0, 3);
  }

  try {
    // Read server greeting
    const greeting = await readFullResponse();
    console.log(`SMTP < ${greeting.substring(0, 150).trim().replace(/\r?\n/g, ' | ')}`);

    // EHLO - may return multiline response
    let response = await sendCommand(`EHLO wees.com.br`);
    if (!getStatusCode(response).startsWith('2')) {
      throw new Error(`EHLO failed: ${response}`);
    }

    // AUTH LOGIN
    response = await sendCommand(`AUTH LOGIN`);
    if (!getStatusCode(response).startsWith('3')) {
      throw new Error(`AUTH LOGIN failed: ${response}`);
    }

    // Username (base64)
    response = await sendCommand(encodeBase64(username));
    if (!getStatusCode(response).startsWith('3')) {
      throw new Error(`Username rejected: ${response}`);
    }

    // Password (base64)
    response = await sendCommand(encodeBase64(password));
    if (!getStatusCode(response).startsWith('2')) {
      throw new Error(`Authentication failed: ${response}`);
    }

    console.log('SMTP authentication successful');

    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${username}>`);
    if (!getStatusCode(response).startsWith('2')) {
      throw new Error(`MAIL FROM failed: ${response}`);
    }

    // RCPT TO
    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!getStatusCode(response).startsWith('2')) {
      throw new Error(`RCPT TO failed: ${response}`);
    }

    // DATA
    response = await sendCommand('DATA');
    if (!getStatusCode(response).startsWith('3')) {
      throw new Error(`DATA failed: ${response}`);
    }

    // Build email message
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const date = new Date().toUTCString();
    
    const emailLines = [
      `Date: ${date}`,
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${encodeBase64(subject)}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      encodeBase64(html),
      ``,
      `--${boundary}--`,
      `.`
    ];

    const emailContent = emailLines.join('\r\n');
    await conn.write(encoder.encode(emailContent + "\r\n"));
    
    response = await readFullResponse();
    console.log(`SMTP < ${response.substring(0, 100).trim()}`);
    if (!getStatusCode(response).startsWith('2')) {
      throw new Error(`Message rejected: ${response}`);
    }

    console.log('Email sent successfully');

    // QUIT
    await sendCommand('QUIT');
  } finally {
    try {
      conn.close();
    } catch {
      // Ignore close errors
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, password, loginUrl }: WelcomeEmailRequest = await req.json();

    if (!email || !name || !password || !loginUrl) {
      console.error('Missing required fields:', { email: !!email, name: !!name, password: !!password, loginUrl: !!loginUrl });
      return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    if (!smtpPassword) {
      console.error('SMTP_PASSWORD not configured');
      return new Response(JSON.stringify({ error: 'Configuração de email não encontrada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Sending welcome email to:', email);

    const htmlContent = generateEmailHtml(name, email, password, loginUrl);

    await sendEmailViaSMTP(
      'smtppro.zoho.com',
      465,
      'noreply@wees.com.br',
      smtpPassword,
      'WEES Soluções <noreply@wees.com.br>',
      email,
      'Bem-vindo ao Sistema RDO - Suas credenciais de acesso',
      htmlContent
    );

    console.log('Welcome email sent successfully to:', email);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send welcome email error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar email';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
