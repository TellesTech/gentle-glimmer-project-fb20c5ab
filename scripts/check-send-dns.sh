#!/usr/bin/env bash
# Verifica os registros DNS de send.wees.com.br exigidos pelo Resend.
set -u
D="send.wees.com.br"
q() { curl -s "https://dns.google/resolve?name=$1&type=$2" | python3 -c "import sys,json;d=json.load(sys.stdin);[print('  ',a['data']) for a in d.get('Answer',[])] or print('   (ausente)')"; }
echo "MX  $D";                 q "$D" MX
echo "TXT $D (SPF)";           q "$D" TXT
echo "TXT resend._domainkey.$D (DKIM)"; q "resend._domainkey.$D" TXT
echo "TXT _dmarc.wees.com.br"; q "_dmarc.wees.com.br" TXT
