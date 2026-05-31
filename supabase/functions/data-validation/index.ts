const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function validateCNPJ(cnpj: string): boolean {
  // Remove non-digits
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;

  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Validate first check digit
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleaned[12]) !== digit1) return false;

  // Validate second check digit
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleaned[13]) !== digit2) return false;

  return true;
}

function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj, type } = await req.json();

    if (type === 'cnpj' && cnpj) {
      const isValid = validateCNPJ(cnpj);
      const formatted = formatCNPJ(cnpj);

      let companyInfo = null;

      // Try ReceitaWS for additional info (only if valid)
      if (isValid) {
        try {
          const cleaned = cnpj.replace(/\D/g, '');
          const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleaned}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.status !== 'ERROR') {
              companyInfo = {
                company_name: data.nome || null,
                fantasy_name: data.fantasia || null,
                address: [data.logradouro, data.numero, data.complemento, data.bairro]
                  .filter(Boolean).join(', '),
                city: data.municipio || null,
                state: data.uf || null,
                zip_code: data.cep || null,
                situation: data.situacao || null,
              };
            }
          }
        } catch {
          // ReceitaWS unavailable, proceed with algorithmic validation only
        }
      }

      return new Response(JSON.stringify({
        valid: isValid,
        formatted,
        company_info: companyInfo,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid request. Provide cnpj and type.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
