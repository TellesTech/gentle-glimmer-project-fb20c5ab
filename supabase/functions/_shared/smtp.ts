// Envio de e-mail via SMTP (Zoho), compartilhado entre funções.
export async function sendEmailViaSMTP(
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
