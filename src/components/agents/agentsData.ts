export type AgentType = 'ia' | 'automacao' | 'integracao';

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  department: string;
  type: AgentType;
  initials: string;
  gender: 'm' | 'f';
  avatarVariant: number;
}

export interface Department {
  id: string;
  label: string;
  color: string;
  colorFrom: string;
  colorTo: string;
  textColor: string;
  bgLight: string;
  agents: Agent[];
}

const typeLabel: Record<AgentType, string> = {
  ia: 'IA',
  automacao: 'Automação',
  integracao: 'Integração',
};
export { typeLabel };

export const departments: Department[] = [
  {
    id: 'ai',
    label: 'Inteligência Artificial',
    color: 'purple',
    colorFrom: '#8B5CF6',
    colorTo: '#A78BFA',
    textColor: 'text-purple-400',
    bgLight: 'bg-purple-500/10',
    agents: [
      { id: 'ai-assistant', name: 'Wesley', role: 'Consultor Sênior de IA', description: 'Responde perguntas, analisa dados de obra, gera insights preditivos e recomendações em tempo real.', department: 'ai', type: 'ia', initials: 'WS', gender: 'm', avatarVariant: 0 },
      { id: 'generate-report-summary', name: 'Clara', role: 'Analista de Resumos', description: 'Gera resumos executivos automáticos dos RDOs com pontos críticos e destaques do dia.', department: 'ai', type: 'ia', initials: 'CL', gender: 'f', avatarVariant: 0 },
      { id: 'magic-write', name: 'Rafael', role: 'Redator Técnico', description: 'Completa e aprimora textos de atividades, observações e descrições com linguagem técnica.', department: 'ai', type: 'ia', initials: 'RF', gender: 'm', avatarVariant: 1 },
      { id: 'parse-report-text', name: 'Helena', role: 'Especialista em Dados', description: 'Interpreta texto livre e imagens de RDOs, extraindo informações estruturadas automaticamente.', department: 'ai', type: 'ia', initials: 'HL', gender: 'f', avatarVariant: 1 },
      { id: 'chat-onboarding', name: 'Lucas', role: 'Assistente de Onboarding', description: 'Guia novos usuários na configuração inicial via chat interativo e personalizado.', department: 'ai', type: 'ia', initials: 'LC', gender: 'm', avatarVariant: 2 },
      { id: 'generate-service-report', name: 'Marina', role: 'Geradora de Relatórios', description: 'Cria relatórios de serviço profissionais no padrão ABNT com dados técnicos e fotográficos.', department: 'ai', type: 'ia', initials: 'MR', gender: 'f', avatarVariant: 2 },
    ],
  },
  {
    id: 'communication',
    label: 'Comunicação',
    color: 'blue',
    colorFrom: '#3B82F6',
    colorTo: '#60A5FA',
    textColor: 'text-blue-400',
    bgLight: 'bg-blue-500/10',
    agents: [
      { id: 'send-welcome-email', name: 'Beatriz', role: 'Coordenadora de Boas-Vindas', description: 'Envia e-mails de boas-vindas personalizados para novos usuários do sistema.', department: 'communication', type: 'automacao', initials: 'BT', gender: 'f', avatarVariant: 3 },
      { id: 'send-client-invitation', name: 'Thiago', role: 'Especialista em Convites', description: 'Gerencia envio de convites para clientes acessarem o portal de acompanhamento.', department: 'communication', type: 'automacao', initials: 'TG', gender: 'm', avatarVariant: 3 },
      { id: 'uazapi-webhook', name: 'Carla', role: 'Operadora de WhatsApp', description: 'Processa mensagens recebidas via WhatsApp (UAZAPI) e executa ações automatizadas.', department: 'communication', type: 'integracao', initials: 'CR', gender: 'f', avatarVariant: 4 },
      { id: 'uazapi-status', name: 'André', role: 'Monitor de Conexão', description: 'Verifica o status da conexão WhatsApp (UAZAPI) e reporta disponibilidade em tempo real.', department: 'communication', type: 'integracao', initials: 'AD', gender: 'm', avatarVariant: 4 },
      { id: 'uazapi-health-check', name: 'Priscila', role: 'Analista de Saúde', description: 'Monitora a saúde da integração WhatsApp (UAZAPI) e alerta sobre problemas de conectividade.', department: 'communication', type: 'integracao', initials: 'PR', gender: 'f', avatarVariant: 5 },
    ],
  },
  {
    id: 'signatures',
    label: 'Assinaturas Digitais',
    color: 'emerald',
    colorFrom: '#10B981',
    colorTo: '#34D399',
    textColor: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    agents: [
      { id: 'submit-signature', name: 'Gustavo', role: 'Coletor de Assinaturas', description: 'Processa assinaturas manuais de clientes com captura de IP e geolocalização.', department: 'signatures', type: 'automacao', initials: 'GS', gender: 'm', avatarVariant: 2 },
    ],
  },
  {
    id: 'hr',
    label: 'RH & Gestão',
    color: 'amber',
    colorFrom: '#F59E0B',
    colorTo: '#FBBF24',
    textColor: 'text-amber-400',
    bgLight: 'bg-amber-500/10',
    agents: [
      { id: 'admin-users', name: 'Daniela', role: 'Gestora de Usuários', description: 'Administra contas de usuários, permissões e acessos ao sistema.', department: 'hr', type: 'automacao', initials: 'DN', gender: 'f', avatarVariant: 2 },
      { id: 'import-collaborators', name: 'Marcos', role: 'Importador de Dados', description: 'Processa importação em massa de colaboradores via planilhas Excel.', department: 'hr', type: 'automacao', initials: 'MC', gender: 'm', avatarVariant: 3 },
      { id: 'save-client-profile', name: 'Vanessa', role: 'Gestora de Perfis', description: 'Salva e atualiza perfis de clientes no portal de acompanhamento.', department: 'hr', type: 'automacao', initials: 'VN', gender: 'f', avatarVariant: 3 },
      { id: 'register-client-contact', name: 'Eduardo', role: 'Registrador de Contatos', description: 'Cadastra novos contatos de clientes com vinculação automática à empresa.', department: 'hr', type: 'automacao', initials: 'ED', gender: 'm', avatarVariant: 4 },
      { id: 'process-workforce-data', name: 'Camila', role: 'Analista de HH', description: 'Processa e normaliza dados de mão de obra (homem-hora) para análises.', department: 'hr', type: 'ia', initials: 'CM', gender: 'f', avatarVariant: 4 },
    ],
  },
  {
    id: 'infra',
    label: 'Infraestrutura',
    color: 'slate',
    colorFrom: '#64748B',
    colorTo: '#94A3B8',
    textColor: 'text-slate-400',
    bgLight: 'bg-slate-500/10',
    agents: [
      { id: 'generate-backup', name: 'Roberto', role: 'Engenheiro de Backup', description: 'Gera backups completos dos dados com suporte a filtros por empresa e período.', department: 'infra', type: 'automacao', initials: 'RB', gender: 'm', avatarVariant: 0 },
      { id: 'scheduled-backup', name: 'Sandra', role: 'Agendadora de Backup', description: 'Executa backups automáticos conforme agendamento configurado pelo administrador.', department: 'infra', type: 'automacao', initials: 'SD', gender: 'f', avatarVariant: 5 },
      { id: 'restore-backup', name: 'Paulo', role: 'Especialista em Restauração', description: 'Restaura dados a partir de backups com validação de integridade.', department: 'infra', type: 'automacao', initials: 'PL', gender: 'm', avatarVariant: 5 },
      { id: 'get-storage-stats', name: 'Renata', role: 'Monitora de Storage', description: 'Coleta estatísticas de uso de armazenamento e reporta capacidade disponível.', department: 'infra', type: 'automacao', initials: 'RN', gender: 'f', avatarVariant: 0 },
      { id: 'health-check', name: 'Diego', role: 'Monitor de Sistemas', description: 'Verifica a saúde geral do sistema e reporta status dos serviços.', department: 'infra', type: 'automacao', initials: 'DG', gender: 'm', avatarVariant: 4 },
    ],
  },
  {
    id: 'security',
    label: 'Segurança & Dados',
    color: 'rose',
    colorFrom: '#F43F5E',
    colorTo: '#FB7185',
    textColor: 'text-rose-400',
    bgLight: 'bg-rose-500/10',
    agents: [
      { id: 'validate-pin', name: 'Alice', role: 'Validadora de Acesso', description: 'Valida PINs de segurança para autenticação de dois fatores.', department: 'security', type: 'automacao', initials: 'AL', gender: 'f', avatarVariant: 5 },
      { id: 'set-pin', name: 'Bruno', role: 'Configurador de PIN', description: 'Gerencia criação e atualização de PINs de segurança dos usuários.', department: 'security', type: 'automacao', initials: 'BR', gender: 'm', avatarVariant: 1 },
      { id: 'set-super-admin', name: 'Isabela', role: 'Gestora de Privilégios', description: 'Gerencia atribuição de privilégios de super administrador.', department: 'security', type: 'automacao', initials: 'IS', gender: 'f', avatarVariant: 2 },
      { id: 'data-validation', name: 'Felipe', role: 'Auditor de Dados', description: 'Valida integridade e consistência dos dados em todas as tabelas do sistema.', department: 'security', type: 'automacao', initials: 'FP', gender: 'm', avatarVariant: 2 },
      { id: 'log-client-error', name: 'Tatiana', role: 'Registradora de Erros', description: 'Captura e registra erros do cliente para análise e correção proativa.', department: 'security', type: 'automacao', initials: 'TT', gender: 'f', avatarVariant: 3 },
      { id: 'get-client-report', name: 'Leonardo', role: 'Provedor de Relatórios', description: 'Fornece acesso seguro a relatórios para clientes externos via token.', department: 'security', type: 'automacao', initials: 'LN', gender: 'm', avatarVariant: 3 },
      
      { id: 'pending-signatures-notification', name: 'Rodrigo', role: 'Notificador de Pendências', description: 'Envia alertas sobre assinaturas pendentes para manter o fluxo em dia.', department: 'security', type: 'automacao', initials: 'RD', gender: 'm', avatarVariant: 0 },
      { id: 'critical-activities-notification', name: 'Fernanda', role: 'Sentinela de Atividades', description: 'Monitora atividades críticas e envia notificações preventivas.', department: 'security', type: 'automacao', initials: 'FD', gender: 'f', avatarVariant: 1 },
    ],
  },
];

export const allAgents = departments.flatMap(d => d.agents);
export const totalAgents = allAgents.length;
export const totalDepartments = departments.length;
export const totalByType: Record<AgentType, number> = allAgents.reduce((acc, a) => {
  acc[a.type] = (acc[a.type] || 0) + 1;
  return acc;
}, { ia: 0, automacao: 0, integracao: 0 } as Record<AgentType, number>);
