import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { departments, totalAgents, totalDepartments, totalByType } from "@/components/agents/agentsData";
import {
  FileText, PenTool, Users, Brain, HardHat, BarChart3,
  Calendar, MessageSquare, Shield, CheckCircle2, Zap, Star,
  ArrowRight, ChevronDown, Bot, Cpu, Link2, Globe,
  Clock, Building2, Layers, Phone, Mail, TrendingUp, Play,
  Factory, Smartphone, Send, ThumbsUp, Quote,
  AlertTriangle, XCircle, CheckCircle, CalendarCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Colors — Navy escuro ── */
const navy = {
  600: "hsl(215,50%,23%)",
  500: "hsl(215,50%,30%)",
  400: "hsl(215,50%,38%)",
  100: "hsl(215,40%,92%)",
  50:  "hsl(215,40%,96%)",
};

/* ── Glass card style — premium visibility ── */
const glassCard = "bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl hover:bg-white/90 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 rounded-2xl";

/* ── Animated counter hook ── */
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setCount(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { count, ref };
}

/* ── Fade-in on scroll ── */
function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Data ── */

const heroFeatures = [
  {
    icon: FileText,
    title: "RDO Digital com IA",
    desc: "Wizard inteligente com preenchimento assistido por IA, formulário simplificado e importação de texto/imagem. Gere RDOs profissionais em minutos, direto do canteiro.",
    bullets: [
      "Preenchimento automático com IA generativa",
      "Importação de texto livre e fotos",
      "Formulário simplificado para campo",
      "Histórico e versionamento completo",
    ],
  },
  {
    icon: PenTool,
    title: "Assinaturas Digitais",
    desc: "Assinatura interna nativa com captura de IP, geolocalização e user-agent. Validade jurídica garantida pela MP 2.200-2/2001.",
    bullets: [
      "Assinatura interna integrada ao RDO",
      "Captura de IP, geolocalização e user-agent",
      "Assinatura manual no dispositivo",
      "Rastreamento completo de status",
    ],
  },
  {
    icon: Users,
    title: "Portal do Cliente",
    desc: "Dashboard exclusivo para clientes acompanharem o progresso da obra, aprovarem relatórios e assinarem documentos — com login independente e white-label.",
    bullets: [
      "Dashboard personalizado por empresa",
      "Aprovação e rejeição de relatórios",
      "Assinatura digital integrada",
      "White-label com cores e logo do cliente",
    ],
  },
  {
    icon: BarChart3,
    title: "Relatórios de Serviço",
    desc: "Editor visual drag-and-drop, geração automática por IA, exportação em PDF no padrão ABNT com fotos, dados técnicos e gráficos de progresso.",
    bullets: [
      "Editor visual com blocos de conteúdo",
      "Geração automática via IA",
      "PDF padrão ABNT com fotos",
      "Gráficos de progresso integrados",
    ],
  },
];

const secondaryFeatures = [
  { icon: HardHat, title: "Gestão de Mão de Obra", desc: "Controle de HH, importação via Excel, planejamento de equipes e produtividade." },
  { icon: Calendar, title: "Calendário de Projetos", desc: "Cronograma completo, marcos, progresso planejado vs. realizado e alertas." },
  { icon: MessageSquare, title: "WhatsApp Integrado", desc: "Notificações automáticas de atividades críticas e assinaturas pendentes." },
  { icon: Shield, title: "Backup & Segurança", desc: "Backup automático, auditoria de dados, validação e PIN de segurança." },
  { icon: Brain, title: "7 Agentes de IA", desc: "Resumos executivos, redação técnica, parsing de dados e onboarding assistido." },
  { icon: TrendingUp, title: "Métricas de Impacto", desc: "Calcule economia de tempo, redução de custos e ROI do sistema automaticamente." },
];

const founders = [
  { name: "Sócio 1", role: "CEO", initials: "S1", desc: "Líder visionário com mais de 15 anos em engenharia civil e transformação digital." },
  { name: "Sócio 2", role: "CTO", initials: "S2", desc: "Arquiteto de software especializado em IA aplicada e cloud computing." },
  { name: "Sócio 3", role: "COO", initials: "S3", desc: "Especialista em operações e gestão de projetos de grande porte." },
  { name: "Sócio 4", role: "CPO", initials: "S4", desc: "Designer de produto com foco em experiência do usuário para campo." },
];

const allBenefits = [
  "RDO Digital com IA",
  "Exportação PDF padrão ABNT",
  "Gestão de equipes",
  "Portal do Cliente",
  "WhatsApp integrado",
  "Assinaturas digitais",
  "Backup automático",
  "IA Completa",
  "Comunidade exclusiva",
  "Onboarding personalizado",
  "Treinamento da equipe",
  "Personalização de relatórios",
  "API de integração",
  "Consultoria de implantação",
  "White-label",
  "Suporte dedicado",
  "SLA garantido",
];

const plans = [
  {
    name: "Starter",
    price: 5150,
    monthly: 429,
    rdos: "1.000",
    subtitle: "Assinatura anual / 1.000 RDOs",
    featured: false,
    included: ["RDO Digital com IA", "Exportação PDF padrão ABNT", "Gestão de equipes", "Portal do Cliente", "WhatsApp integrado", "Assinaturas digitais"],
  },
  {
    name: "Profissional",
    price: 10150,
    monthly: 846,
    rdos: "3.000",
    subtitle: "Assinatura anual / 3.000 RDOs",
    featured: true,
    included: [
      "RDO Digital com IA", "Exportação PDF padrão ABNT", "Gestão de equipes",
      "Portal do Cliente", "WhatsApp integrado", "Assinaturas digitais",
      "Backup automático", "IA Completa", "Comunidade exclusiva",
    ],
  },
  {
    name: "Business",
    price: 20150,
    monthly: 1679,
    rdos: "8.000",
    subtitle: "Assinatura anual / 8.000 RDOs",
    featured: false,
    included: [
      "RDO Digital com IA", "Exportação PDF padrão ABNT", "Gestão de equipes",
      "Portal do Cliente", "WhatsApp integrado", "Assinaturas digitais",
      "Backup automático", "IA Completa", "Comunidade exclusiva",
      "Onboarding personalizado", "Treinamento da equipe",
      "Personalização de relatórios", "API de integração",
    ],
  },
  {
    name: "Enterprise",
    price: 40150,
    monthly: 3346,
    rdos: "20.000",
    subtitle: "Assinatura anual / 20.000 RDOs",
    featured: false,
    included: allBenefits,
  },
];

const faqs = [
  { q: "O que é um RDO?", a: "RDO é o Relatório Diário de Obra, documento obrigatório que registra todas as atividades, condições climáticas, mão de obra e ocorrências de cada dia no canteiro." },
  { q: "Como funciona a cobrança por RDO?", a: "Cada plano inclui uma quantidade anual de RDOs. Você paga o valor fixo anual e pode gerar até o limite contratado. Precisa de mais? Fale conosco para um plano sob medida." },
  { q: "Posso testar antes de contratar?", a: "Sim! Oferecemos uma demonstração guiada para que você conheça todas as funcionalidades do RdoX antes de decidir." },
  { q: "As assinaturas digitais têm validade jurídica?", a: "Sim. Nossa assinatura interna captura IP, geolocalização e user-agent, atendendo à MP 2.200-2/2001, que garante validade jurídica das assinaturas eletrônicas no Brasil." },
  { q: "Como a IA ajuda no preenchimento do RDO?", a: "Nossa IA completa textos técnicos, gera resumos executivos, interpreta fotos e textos livres para extrair dados estruturados, e cria relatórios profissionais automaticamente." },
  { q: "Preciso instalar algum software?", a: "Não. O RdoX é 100% web, funciona em qualquer navegador e dispositivo — desktop, tablet ou smartphone, direto do canteiro de obras." },
];

const deptIcons: Record<string, React.ElementType> = {
  ai: Brain,
  communication: MessageSquare,
  signatures: PenTool,
  hr: Users,
  infra: Cpu,
  security: Shield,
};

/* ── MetricCard (separate component to avoid hook violation) ── */
function MetricCard({ target, prefix, suffix, label, icon: Icon }: { target: number; prefix?: string; suffix?: string; label: string; icon: React.ElementType }) {
  const { count, ref } = useCounter(target);
  return (
    <div ref={ref} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center">
      <Icon className="h-8 w-8 mx-auto mb-3 text-white/70" />
      <div className="text-3xl md:text-4xl font-extrabold text-white tabular-nums">
        {prefix}{count.toLocaleString("pt-BR")}{suffix}
      </div>
      <p className="text-sm text-white/60 mt-2">{label}</p>
    </div>
  );
}

/* ── Page ── */
const SalesPage = () => {
  const navigate = useNavigate();
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const c1 = useCounter(totalAgents);
  const c2 = useCounter(totalDepartments);
  const c3 = useCounter(totalByType.ia);
  const c4 = useCounter(9, 1500);

  return (
    <div className="min-h-screen bg-white text-[hsl(215,25%,15%)] overflow-x-hidden">
      {/* ━━ NAV ━━ */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/80 border-b border-[hsl(215,20%,90%)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <span className="text-2xl font-extrabold tracking-tight text-[hsl(215,25%,15%)]">
            Rdo<span style={{ color: navy[600] }}>X</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-[hsl(215,15%,45%)]">
            <button onClick={() => scrollTo("features")} className="hover:opacity-80 transition" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = navy[600])} onMouseLeave={e => (e.currentTarget.style.color = '')}>Funcionalidades</button>
            <button onClick={() => scrollTo("ai-team")} style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = navy[600])} onMouseLeave={e => (e.currentTarget.style.color = '')}>Equipe IA</button>
            <button onClick={() => scrollTo("founders")} style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = navy[600])} onMouseLeave={e => (e.currentTarget.style.color = '')}>Sócios</button>
            <button onClick={() => scrollTo("case-wees")} style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = navy[600])} onMouseLeave={e => (e.currentTarget.style.color = '')}>Caso Real</button>
            <button onClick={() => scrollTo("pricing")} style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = navy[600])} onMouseLeave={e => (e.currentTarget.style.color = '')}>Planos</button>
            <button onClick={() => scrollTo("faq")} style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = navy[600])} onMouseLeave={e => (e.currentTarget.style.color = '')}>FAQ</button>
          </div>
          <Button
            onClick={() => scrollTo("pricing")}
            style={{ backgroundColor: navy[600] }}
            className="hover:opacity-90 text-white rounded-xl px-6 text-sm font-semibold"
          >
            Começar agora
          </Button>
        </div>
      </nav>

      {/* ━━ HERO ━━ */}
      <section className="relative pt-24 pb-12 md:pt-32 md:pb-16 px-6 bg-gradient-to-br from-[hsl(210,40%,98%)] to-[hsl(220,30%,93%)]">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ background: `${navy[600]}10` }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full blur-[100px] pointer-events-none" style={{ background: `${navy[400]}08` }} />
        <div className="relative max-w-7xl mx-auto grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          {/* Left — Text */}
          <div className="text-left">
            <FadeIn>
              <span className="inline-block px-4 py-1.5 rounded-xl text-xs font-semibold tracking-wide uppercase mb-5" style={{ background: `${navy[600]}18`, color: navy[600], border: `1px solid ${navy[600]}30` }}>
                rdox.ai — Plug & Play para sua obra
              </span>
            </FadeIn>
            <FadeIn delay={100}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.08] tracking-tight mb-5 text-[hsl(215,25%,15%)]">
                O Diário de Obra com{" "}
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${navy[600]}, ${navy[400]})` }}>
                  Inteligência Artificial
                </span>
              </h1>
            </FadeIn>
            <FadeIn delay={200}>
              <p className="text-base md:text-lg text-[hsl(215,15%,50%)] max-w-lg mb-8 leading-relaxed">
                RDOs, assinaturas digitais, relatórios ABNT e gestão de mão de obra — tudo automatizado com IA. Sem instalação, direto do canteiro.
              </p>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => scrollTo("pricing")}
                  style={{ backgroundColor: navy[600], boxShadow: `0 10px 25px -5px ${navy[600]}40` }}
                  className="hover:opacity-90 text-white rounded-xl px-8 py-6 text-base font-bold"
                >
                  Ver planos <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => scrollTo("features")}
                  className="rounded-xl px-8 py-6 text-base border-[hsl(215,20%,85%)] text-[hsl(215,15%,45%)]"
                  style={{ transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = navy[600]; e.currentTarget.style.borderColor = `${navy[600]}60`; }}
                  onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = ''; }}
                >
                  Conhecer funcionalidades <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </FadeIn>
          </div>

          {/* Right — Video */}
          <FadeIn delay={400}>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-[0_20px_60px_hsl(215_50%_23%/0.2)] border border-white/40 bg-[hsl(215,25%,15%)] group cursor-pointer"
              onClick={() => {
                const el = document.getElementById('hero-video-iframe');
                if (el) {
                  el.setAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
                  el.style.display = 'block';
                  document.getElementById('hero-video-cover')!.style.display = 'none';
                }
              }}
            >
              {/* Video cover/placeholder */}
              <div id="hero-video-cover" className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gradient-to-br from-[hsl(215,50%,18%)] to-[hsl(215,50%,28%)]">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-[0_0_30px_hsl(215_50%_23%/0.3)]">
                  <Play className="h-7 w-7 md:h-8 md:w-8 text-white ml-1" fill="white" />
                </div>
                <p className="text-white/80 text-sm font-medium">Veja o RdoX em ação</p>
              </div>
              <iframe
                id="hero-video-iframe"
                className="absolute inset-0 w-full h-full hidden"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="RdoX Demo"
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━ METRICS ━━ */}
      <section className="py-12 border-y border-[hsl(215,20%,92%)] bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 px-6 text-center">
          {[
            { ref: c1.ref, count: c1.count, suffix: "+", label: "Agentes Digitais", icon: Bot },
            { ref: c2.ref, count: c2.count, suffix: "", label: "Departamentos", icon: Layers },
            { ref: c3.ref, count: c3.count, suffix: "", label: "Agentes de IA", icon: Brain },
            { ref: c4.ref, count: c4.count, suffix: "+", label: "Integrações", icon: Link2 },
          ].map((m, i) => (
            <div key={i} ref={m.ref} className="flex flex-col items-center gap-2">
              <m.icon className="h-6 w-6" style={{ color: navy[600] }} />
              <span className="text-3xl md:text-4xl font-extrabold tabular-nums text-[hsl(215,25%,15%)]">{m.count}{m.suffix}</span>
              <span className="text-sm text-[hsl(215,15%,55%)]">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ━━ FEATURES — HERO BENEFITS (alternating layout) ━━ */}
      <section id="features" className="py-16 px-6 bg-gradient-to-br from-[hsl(215,30%,92%)] to-[hsl(220,25%,86%)]">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: navy[600] }}>Funcionalidades</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3 text-[hsl(215,25%,15%)]">Tudo que sua obra precisa, em um só lugar</h2>
              <p className="text-[hsl(215,15%,50%)] mt-4 max-w-xl mx-auto">Digitalização completa do canteiro — do RDO à assinatura, da equipe ao relatório.</p>
            </div>
          </FadeIn>

          <div className="space-y-20">
            {heroFeatures.map((f, i) => {
              const isReversed = i % 2 !== 0;
              return (
                <FadeIn key={i} delay={i * 100}>
                  <div className={cn(
                    "flex flex-col gap-10 items-center",
                    isReversed ? "md:flex-row-reverse" : "md:flex-row"
                  )}>
                    {/* Text */}
                    <div className="flex-1 space-y-5">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `${navy[600]}18` }}>
                        <f.icon className="h-6 w-6" style={{ color: navy[600] }} />
                      </div>
                      <h3 className="text-2xl md:text-3xl font-extrabold text-[hsl(215,25%,15%)]">{f.title}</h3>
                      <p className="text-[hsl(215,15%,50%)] leading-relaxed">{f.desc}</p>
                      <ul className="space-y-2.5 pt-2">
                        {f.bullets.map((b, bi) => (
                          <li key={bi} className="flex items-start gap-3 text-sm text-[hsl(215,15%,45%)]">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: navy[600] }} />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Visual placeholder */}
                    <div className="flex-1 w-full">
                      <div className={cn("aspect-[4/3] rounded-2xl flex items-center justify-center", glassCard)} style={{ background: `linear-gradient(to bottom right, ${navy[600]}10, ${navy[600]}05)`, backdropFilter: 'blur(20px)' }}>
                        <f.icon className="h-20 w-20" style={{ color: `${navy[600]}30` }} />
                      </div>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>

          {/* Secondary features grid */}
          <div className="mt-16">
            <FadeIn>
              <h3 className="text-2xl font-extrabold text-center mb-10 text-[hsl(215,25%,15%)]">E muito mais</h3>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {secondaryFeatures.map((f, i) => (
                <FadeIn key={i} delay={i * 80}>
                  <Card className={cn(glassCard, "h-full rounded-2xl")}>
                    <CardHeader className="pb-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${navy[600]}18` }}>
                        <f.icon className="h-5 w-5" style={{ color: navy[600] }} />
                      </div>
                      <CardTitle className="text-base font-bold text-[hsl(215,25%,15%)]">{f.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-[hsl(215,15%,50%)] leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━ AI TEAM ━━ */}
      <section id="ai-team" className="py-16 px-6 bg-gradient-to-br from-[hsl(220,28%,90%)] to-[hsl(215,30%,85%)] border-y border-[hsl(215,20%,88%)]">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: navy[600] }}>Equipe de IA</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3 text-[hsl(215,25%,15%)]">{totalAgents} agentes trabalhando 24/7</h2>
              <p className="text-[hsl(215,15%,50%)] mt-4 max-w-xl mx-auto">
                {totalByType.ia} de Inteligência Artificial · {totalByType.automacao} de Automação · {totalByType.integracao} de Integração
              </p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept, di) => {
              const Icon = deptIcons[dept.id] || Cpu;
              return (
                <FadeIn key={dept.id} delay={di * 100}>
                  <Card className={cn(glassCard, "h-full rounded-2xl")} style={{ background: `hsl(210 40% 98% / 0.7)` }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${dept.colorFrom}15` }}>
                          <Icon className="h-4 w-4" style={{ color: dept.colorFrom }} />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold text-[hsl(215,25%,15%)]">{dept.label}</CardTitle>
                          <p className="text-xs text-[hsl(215,15%,55%)]">{dept.agents.length} agentes</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {dept.agents.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[hsl(215,20%,90%)] bg-white/80 text-[hsl(215,15%,45%)]"
                          >
                            <span className="font-semibold text-[hsl(215,25%,25%)]">{a.initials}</span>
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━ FOUNDERS ━━ */}
      <section id="founders" className="py-20 px-6 bg-[hsl(215,25%,15%)]">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: navy[400] }}>Quem faz acontecer</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3 text-white">Os Sócios</h2>
              <p className="text-white/60 mt-4 max-w-lg mx-auto">
                A equipe por trás do RdoX — unindo engenharia, tecnologia e design para transformar o canteiro de obras.
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {founders.map((f, i) => (
              <FadeIn key={i} delay={i * 120}>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-36 h-44 rounded-2xl bg-[hsl(215,20%,25%)] flex items-center justify-center overflow-hidden border border-white/10">
                    <span className="text-3xl font-extrabold text-white/30">{f.initials}</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{f.name}</h4>
                    <span className="text-sm font-semibold" style={{ color: navy[400] }}>{f.role}</span>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ CASO REAL — PROVA SOCIAL ━━ */}
      <section id="case-wees" className="py-20 px-6 text-white" style={{ background: `linear-gradient(135deg, ${navy[600]}, hsl(215,50%,18%))` }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest mb-5 bg-white/15 border border-white/25 text-white">
                📋 Estudo de Caso · Dados Reais
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3">195 horas economizadas em 3 meses</h2>
              <p className="text-white/60 mt-4 max-w-2xl mx-auto">
                Com projeção de 782 horas no primeiro ano — equivalente a quase 5 meses de trabalho de um colaborador
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                {["Engenharia Industrial", "650 RDOs em 3 meses", "109 Projetos"].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/20 text-white/80">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* O Desafio */}
          <FadeIn delay={100}>
            <div className={cn("max-w-4xl mx-auto mb-10 p-8 rounded-2xl", "bg-white/10 backdrop-blur-md border border-white/20")}>
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">O Desafio</h3>
                  <p className="text-sm text-white/50 mt-1">Engenharia Industrial · Múltiplos canteiros</p>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed mb-4">
                Empresa de engenharia industrial com 109 projetos ativos enfrentava gargalos severos: RDOs manuais levando 10 minutos cada, relatórios finais consumindo 1 hora por atividade, falta de padronização entre equipes e retrabalho constante para gestores.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "10min por RDO (papel/planilha)",
                  "1h por relatório final",
                  "Erros e dados incompletos",
                  "Retrabalho constante",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* A Solução */}
          <FadeIn delay={150}>
            <div className={cn("max-w-4xl mx-auto mb-14 p-8 rounded-2xl", "bg-white/10 backdrop-blur-md border border-white/20")}>
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">A Solução</h3>
                  <p className="text-sm text-white/50 mt-1">RdoX com automação via WhatsApp + IA</p>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed">
                O RdoX foi integrado ao WhatsApp — a ferramenta que os encarregados já usavam. Sem app novo, sem treinamento extenso. A IA processa mensagens automaticamente e gera RDOs padronizados. Assinaturas digitais internas com validade jurídica completam o fluxo.
              </p>
            </div>
          </FadeIn>

          {/* Resultados 3 Meses */}
          <FadeIn delay={200}>
            <h3 className="text-2xl font-extrabold text-center text-white mb-2">Resultados em 3 Meses</h3>
            <p className="text-center text-white/50 text-sm mb-8">Dados reais da operação</p>
          </FadeIn>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10">
            <FadeIn delay={250}><MetricCard target={5} suffix="x" label="Mais rápido que o manual" icon={Zap} /></FadeIn>
            <FadeIn delay={300}><MetricCard target={650} suffix="" label="RDOs processados" icon={FileText} /></FadeIn>
            <FadeIn delay={350}><MetricCard target={195} suffix="h" label="Horas economizadas" icon={Clock} /></FadeIn>
            <FadeIn delay={400}><MetricCard target={4888} prefix="R$ " suffix="" label="Economia em 3 meses" icon={Shield} /></FadeIn>
            <FadeIn delay={450}><MetricCard target={109} suffix="" label="Projetos gerenciados" icon={Factory} /></FadeIn>
            <FadeIn delay={500}><MetricCard target={3} suffix=" meses" label="Período de operação" icon={CalendarCheck} /></FadeIn>
          </div>

          {/* Projeção 1 Ano */}
          <FadeIn delay={550}>
            <h3 className="text-2xl font-extrabold text-center text-white mb-2">Projeção para 1 Ano</h3>
            <p className="text-center text-white/40 text-sm mb-8">Baseada nos resultados reais dos 3 primeiros meses</p>
          </FadeIn>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
            <FadeIn delay={600}><MetricCard target={2600} suffix="" label="RDOs projetados" icon={FileText} /></FadeIn>
            <FadeIn delay={650}><MetricCard target={782} suffix="h" label="Horas economizadas" icon={Clock} /></FadeIn>
            <FadeIn delay={700}><MetricCard target={19500} prefix="R$ " suffix="" label="Economia anual" icon={TrendingUp} /></FadeIn>
            <FadeIn delay={750}><MetricCard target={5} prefix="~" suffix=" meses" label="Equiv. salarial" icon={Users} /></FadeIn>
          </div>
        </div>
      </section>

      {/* Funcionalidades em Ação */}
      <section className="py-16 px-6 bg-gradient-to-br from-[hsl(215,30%,92%)] to-[hsl(220,25%,86%)]">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: navy[600] }}>Funcionalidades em ação</span>
              <h3 className="text-2xl md:text-3xl font-extrabold mt-3 text-[hsl(215,25%,15%)]">Funcionalidades em Ação</h3>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Smartphone, title: "WhatsApp Integrado", desc: "Encarregados enviam dados e fotos direto pelo grupo de WhatsApp. A IA processa automaticamente e gera RDOs estruturados.", color: "hsl(142,50%,36%)" },
              { icon: FileText, title: "RDO Digital", desc: "Preenchimento simplificado direto do canteiro, com wizard inteligente e importação de texto livre.", color: navy[600] },
              { icon: PenTool, title: "Assinaturas Digitais", desc: "Aprovações com assinatura interna, captura de IP e geolocalização. Validade jurídica garantida.", color: navy[600] },
              { icon: Users, title: "Portal do Cliente", desc: "Clientes acompanham a obra em tempo real, aprovam relatórios e assinam documentos.", color: navy[600] },
              { icon: BarChart3, title: "Relatórios de Serviço", desc: "Geração automática com IA, exportação em PDF padrão ABNT com fotos e gráficos.", color: navy[600] },
              { icon: HardHat, title: "Gestão de Mão de Obra", desc: "Controle de HH, produtividade e planejamento de equipes em 8 unidades simultâneas.", color: navy[600] },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 80}>
                <Card className={cn(glassCard, "h-full rounded-2xl")}>
                  <CardHeader className="pb-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${f.color}18` }}>
                      <f.icon className="h-5 w-5" style={{ color: f.color }} />
                    </div>
                    <CardTitle className="text-base font-bold text-[hsl(215,25%,15%)]">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[hsl(215,15%,50%)] leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Fluxo WhatsApp */}
      <section className="py-16 px-6" style={{ background: 'linear-gradient(135deg, hsl(142,40%,20%), hsl(142,35%,28%))' }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold tracking-widest uppercase text-white/60">Destaque</span>
              <h3 className="text-2xl md:text-3xl font-extrabold mt-3 text-white">Fluxo WhatsApp + IA</h3>
              <p className="text-white/50 mt-3 max-w-xl mx-auto">Do campo à aprovação digital em minutos — sem sair do WhatsApp.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { icon: Smartphone, title: "1. Campo", desc: "Encarregado envia texto e foto no grupo WhatsApp" },
              { icon: Brain, title: "2. IA Processa", desc: "IA extrai dados estruturados automaticamente" },
              { icon: FileText, title: "3. RDO Criado", desc: "RDO é gerado e salvo no sistema" },
              { icon: Send, title: "4. Resumo", desc: "Resumo IA enviado de volta ao grupo" },
              { icon: ThumbsUp, title: "5. Aprovação", desc: "Gestor aprova e assina digitalmente" },
            ].map((step, i) => (
              <FadeIn key={i} delay={i * 120}>
                <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{step.title}</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimento + CTA transição */}
      <section className="py-16 px-6" style={{ background: `linear-gradient(to bottom, ${navy[50]}, white)` }}>
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className={cn("p-8 rounded-2xl mb-10", glassCard)}>
              <Quote className="h-8 w-8 mb-4" style={{ color: `${navy[600]}40` }} />
              <blockquote className="text-lg md:text-xl italic text-[hsl(215,25%,20%)] leading-relaxed mb-4">
                "Com o RdoX, eliminamos completamente o papel dos nossos canteiros. O que levava 10 minutos agora é feito em 2 — e com muito mais qualidade. A integração com WhatsApp foi o divisor de águas para nossa operação."
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: navy[600] }}>GO</div>
                <div>
                  <p className="text-sm font-bold text-[hsl(215,25%,15%)]">Gestor de Operações</p>
                  <p className="text-xs text-[hsl(215,15%,55%)]">Engenharia Industrial</p>
                </div>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="text-center">
              <h3 className="text-2xl md:text-3xl font-extrabold mb-3 text-[hsl(215,25%,15%)]">
                Quer resultados como este?
              </h3>
              <p className="text-[hsl(215,15%,50%)] mb-6">Veja nossos planos abaixo e comece a transformar sua operação.</p>
              <Button
                onClick={() => scrollTo("pricing")}
                className="rounded-xl px-8 py-6 text-base font-bold text-white shadow-lg"
                style={{ backgroundColor: navy[600], boxShadow: `0 10px 25px -5px ${navy[600]}40` }}
              >
                Ver planos e preços <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━ PRICING ━━ */}
      <section id="pricing" className="py-16 px-6 bg-gradient-to-br from-[hsl(215,30%,92%)] to-[hsl(220,25%,86%)] border-y border-[hsl(215,20%,88%)]">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: navy[600] }}>Planos</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3 text-[hsl(215,25%,15%)]">Escolha o plano ideal para sua obra</h2>
              <p className="text-[hsl(215,15%,50%)] mt-4 max-w-lg mx-auto">Cobrança anual por volume de RDOs — escale conforme sua operação cresce.</p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {plans.map((plan, pi) => (
              <FadeIn key={plan.name} delay={pi * 100}>
                <Card
                  className={cn(
                    "relative h-full transition-all duration-300 rounded-2xl",
                    plan.featured
                      ? "scale-[1.02] bg-white/90 backdrop-blur-xl border-2 shadow-[0_20px_50px_hsl(215_50%_23%/0.15)]"
                      : glassCard
                  )}
                  style={plan.featured ? { borderColor: navy[600] } : undefined}
                >
                  {plan.featured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-xl text-white text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: navy[600] }}>
                      Mais popular
                    </div>
                  )}
                  <CardHeader className="text-center pt-8 pb-2">
                    <CardTitle className="text-2xl font-extrabold text-[hsl(215,25%,15%)]">{plan.name}</CardTitle>
                    <p className="text-xs text-[hsl(215,15%,55%)] mt-1">{plan.subtitle}</p>
                    <div className="mt-5">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-sm font-semibold text-[hsl(215,15%,45%)]">R$</span>
                        <span className="text-4xl font-extrabold text-[hsl(215,25%,15%)]">
                          {plan.monthly.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <span className="text-xs text-[hsl(215,15%,55%)]">/mês</span>
                    </div>
                    <p className="text-xs font-medium mt-2" style={{ color: navy[500] }}>
                      Plano anual
                    </p>
                  </CardHeader>
                  <CardContent className="pt-4 pb-8">
                    <Button
                      className="w-full rounded-xl py-5 font-bold mb-6 text-white"
                      style={
                        plan.name === "Enterprise"
                          ? { backgroundColor: navy[500], boxShadow: `0 10px 25px -5px ${navy[500]}40` }
                          : { backgroundColor: navy[600] }
                      }
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      onClick={() => navigate("/diagnostico")}
                    >
                      Conhecer agora
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <div className="border-t border-[hsl(215,20%,90%)] pt-5">
                      <p className="text-xs font-bold text-[hsl(215,25%,20%)] uppercase tracking-wide mb-4">O que está incluso:</p>
                      <ul className="space-y-2.5">
                        {allBenefits.map((benefit) => {
                          const isIncluded = plan.included.includes(benefit);
                          return (
                            <li key={benefit} className="flex items-center gap-2.5 text-sm">
                              {isIncluded ? (
                                <CheckCircle2 className="h-4 w-4 text-[hsl(142,71%,45%)] shrink-0" />
                              ) : (
                                <span className="h-4 w-4 rounded-full border-2 border-[hsl(215,15%,82%)] shrink-0" />
                              )}
                              <span className={cn(
                                isIncluded ? "text-[hsl(215,25%,20%)]" : "text-[hsl(215,15%,72%)] line-through"
                              )}>
                                {benefit}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ FAQ ━━ */}
      <section id="faq" className="py-16 px-6 bg-gradient-to-br from-[hsl(220,28%,90%)] to-[hsl(215,30%,85%)]">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className="text-center mb-10">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: navy[600] }}>FAQ</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3 text-[hsl(215,25%,15%)]">Perguntas frequentes</h2>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className={cn("rounded-xl px-5", glassCard)}
                >
                  <AccordionTrigger className="text-left text-sm font-semibold text-[hsl(215,25%,20%)] py-4 hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-[hsl(215,15%,50%)] leading-relaxed pb-4">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeIn>
        </div>
      </section>


      {/* ━━ CTA FINAL ━━ */}
      <section className="py-20 px-6 text-white" style={{ background: `linear-gradient(to bottom right, ${navy[600]}, hsl(215,50%,18%))` }}>
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Pronto para modernizar sua obra?
            </h2>
            <p className="text-white/70 mb-8 text-lg">
              Fale com nossa equipe e descubra como o RdoX pode transformar a gestão do seu canteiro.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                className="rounded-xl px-8 py-6 text-base font-bold shadow-lg"
                style={{ backgroundColor: 'white', color: navy[600] }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                onClick={() => window.open("https://wa.me/5511999999999?text=Olá! Quero saber mais sobre o RdoX.", "_blank")}
              >
                <Phone className="mr-2 h-5 w-5" /> Falar no WhatsApp
              </Button>
              <Button
                className="rounded-xl px-8 py-6 text-base font-bold bg-white/20 border border-white/50 text-white hover:bg-white/30 backdrop-blur-sm"
                onClick={() => window.open("mailto:contato@rdox.ai")}
              >
                <Mail className="mr-2 h-5 w-5" /> contato@rdox.ai
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ━━ FOOTER ━━ */}
      <footer className="bg-[hsl(215,25%,15%)] text-white/90 pt-16 pb-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="space-y-4">
              <span className="text-2xl font-extrabold tracking-tight text-white">
                Rdo<span style={{ color: navy[400] }}>X</span>
              </span>
              <p className="text-sm text-white/50 leading-relaxed">
                O diário de obra inteligente que automatiza RDOs, assinaturas digitais e relatórios com IA — direto do canteiro.
              </p>
            </div>
            {/* Menu */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Menu</h4>
              <ul className="space-y-2.5 text-sm text-white/50">
                <li><button onClick={() => scrollTo("features")} className="hover:text-white/80 transition">Funcionalidades</button></li>
                <li><button onClick={() => scrollTo("ai-team")} className="hover:text-white/80 transition">Equipe IA</button></li>
                <li><button onClick={() => scrollTo("pricing")} className="hover:text-white/80 transition">Planos</button></li>
                <li><button onClick={() => scrollTo("faq")} className="hover:text-white/80 transition">FAQ</button></li>
              </ul>
            </div>
            {/* Contact */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Contato</h4>
              <ul className="space-y-2.5 text-sm text-white/50">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /> contato@rdox.ai</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> (11) 99999-9999</li>
                <li className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0" /> São Paulo, SP</li>
              </ul>
            </div>
            {/* Social */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Redes Sociais</h4>
              <ul className="space-y-2.5 text-sm text-white/50">
                <li><a href="#" className="hover:text-white/80 transition flex items-center gap-2"><Globe className="h-4 w-4" /> Instagram</a></li>
                <li><a href="#" className="hover:text-white/80 transition flex items-center gap-2"><Globe className="h-4 w-4" /> LinkedIn</a></li>
              </ul>
            </div>
          </div>
          {/* Divider */}
          <div className="h-px w-full" style={{ background: `linear-gradient(to right, transparent, ${navy[400]}40, transparent)` }} />
          {/* Bottom */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/40">
            <span>© {new Date().getFullYear()} RdoX. Todos os direitos reservados.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white/60 transition">Política de Privacidade</a>
              <a href="#" className="hover:text-white/60 transition">Termos de Uso</a>
            </div>
          </div>
          <p className="text-[10px] text-white/25 text-center mt-6 max-w-2xl mx-auto leading-relaxed">
            *Os resultados podem variar. Os valores e métricas apresentados são estimativas baseadas em cenários reais de uso e não constituem garantia de resultados futuros.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SalesPage;
