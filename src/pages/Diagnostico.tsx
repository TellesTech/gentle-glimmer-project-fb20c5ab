import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MessageSquare, Clock, TrendingUp, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { formatPhoneBR } from "@/lib/phoneMask";

type Message = {
  role: "agent" | "user";
  content: string;
};

type DiagnosticData = {
  userName?: string;
  email?: string;
  phone?: string;
  segment?: string;
  teamSize?: number;
  rdoCount?: number;
  timePerRdo?: number;
  mainPain?: string;
  currentSystem?: string;
};

type ResultData = {
  userName: string;
  segment: string;
  teamSize: number;
  rdoCount: number;
  currentTimePerRdo: number;
  weesTimePerRdo: number;
  totalCurrentTime: number;
  totalWeesTime: number;
  timeSavedMonthly: number;
  timeSavedPercentage: number;
  mainPain: string;
  currentSystem: string;
  recommendation: string;
};

const STEPS = [
  { key: "welcome", label: "Seu nome", placeholder: "Digite seu nome...", type: "text" },
  { key: "name_received", label: "E-mail", placeholder: "Digite seu melhor e-mail...", type: "email" },
  { key: "email_received", label: "WhatsApp", placeholder: "(00) 00000-0000", type: "tel" },
  { key: "phone_received", label: "Segmento", placeholder: "Ex: Construção civil, infraestrutura...", type: "text" },
  { key: "segment_received", label: "Colaboradores", placeholder: "Número de colaboradores em campo...", type: "text" },
  { key: "team_received", label: "RDOs/mês", placeholder: "Quantos relatórios por mês...", type: "text" },
  { key: "rdo_count_received", label: "Tempo por RDO", placeholder: "Tempo em minutos...", type: "text" },
  { key: "time_received", label: "Principal dor", placeholder: "Descreva a maior dificuldade...", type: "text" },
  { key: "pain_received", label: "Sistema atual", placeholder: "Papel, planilha, sistema...", type: "text" },
  { key: "system_received", label: "Resultado", placeholder: "", type: "text" },
];

const TOTAL_STEPS = STEPS.length - 1;

const WELCOME_MESSAGES: Message[] = [
  {
    role: "agent",
    content:
      "Olá! 👋 Sou o Wesley, consultor da WEES. Empresas como a sua perdem em média 15 horas por mês preenchendo RDOs manualmente — com o Diário de Obra Pro, esse tempo cai para menos de 3 horas, eliminando retrabalho e garantindo conformidade técnica.",
  },
  {
    role: "agent",
    content: "Para começar, qual é o seu **nome**?",
  },
];

const Diagnostico = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(WELCOME_MESSAGES);
  const [input, setInput] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({});
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Force light theme
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const callDiagnostic = async (step: string, data: DiagnosticData) => {
    setIsLoading(true);
    try {
      const { data: fnData, error } = await supabase.functions.invoke("chat-diagnostic", {
        body: { step, ...data },
      });

      if (error) throw error;

      if (fnData?.messages) {
        for (let i = 0; i < fnData.messages.length; i++) {
          await new Promise((r) => setTimeout(r, i * 400));
          setMessages((prev) => [...prev, { role: "agent", content: fnData.messages[i] }]);
        }
      }

      if (fnData?.resultData) {
        setResultData(fnData.resultData);
        await saveLead(data, fnData.resultData);
      }
    } catch (err) {
      console.error("Diagnostic error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "Desculpe, ocorreu um erro. Tente novamente em instantes." },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const saveLead = async (data: DiagnosticData, result: ResultData) => {
    try {
      await supabase.from("leads").insert({
        name: data.userName || "",
        email: data.email || "",
        phone: data.phone || null,
        company: data.segment || null,
        message: JSON.stringify({
          teamSize: data.teamSize,
          rdoCount: data.rdoCount,
          timePerRdo: data.timePerRdo,
          mainPain: data.mainPain,
          currentSystem: data.currentSystem,
          resultData: result,
        }),
        status: "new",
      });
    } catch (err) {
      console.error("Failed to save lead:", err);
    }
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || isLoading || isSending || currentStep >= TOTAL_STEPS) return;

    setIsSending(true);
    setMessages((prev) => [...prev, { role: "user", content: value }]);
    setInput("");

    const newData = { ...diagnosticData };
    let nextStep = "";

    switch (currentStep) {
      case 0:
        newData.userName = value;
        nextStep = "name_received";
        break;
      case 1:
        newData.email = value;
        nextStep = "email_received";
        break;
      case 2:
        newData.phone = value;
        nextStep = "phone_received";
        break;
      case 3:
        newData.segment = value;
        nextStep = "segment_received";
        break;
      case 4:
        newData.teamSize = parseInt(value) || 0;
        nextStep = "team_received";
        break;
      case 5:
        newData.rdoCount = parseInt(value) || 0;
        nextStep = "rdo_count_received";
        break;
      case 6:
        newData.timePerRdo = parseInt(value) || 0;
        nextStep = "time_received";
        break;
      case 7:
        newData.mainPain = value;
        nextStep = "pain_received";
        break;
      case 8:
        newData.currentSystem = value;
        nextStep = "system_received";
        break;
    }

    setDiagnosticData(newData);
    setCurrentStep((prev) => prev + 1);
    await callDiagnostic(nextStep, newData);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stepInfo = STEPS[Math.min(currentStep, STEPS.length - 1)];
    if (stepInfo.type === "tel") {
      setInput(formatPhoneBR(e.target.value));
    } else {
      setInput(e.target.value);
    }
  };

  const progressPercent = Math.min((currentStep / TOTAL_STEPS) * 100, 100);
  const stepInfo = STEPS[Math.min(currentStep, STEPS.length - 1)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/pv")}
            className="shrink-0 text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-slate-800 tracking-tight">
                Análise Gratuita
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {currentStep}/{TOTAL_STEPS}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5 bg-slate-100" />
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "agent" && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md mt-0.5">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      msg.role === "agent"
                        ? "bg-white border border-slate-200/80 text-slate-700 shadow-sm"
                        : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md"
                    )}
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3 items-start"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Result card */}
            {resultData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50 overflow-hidden">
                  <CardContent className="p-6 space-y-5">
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-slate-800">
                        Sua Estimativa, {resultData.userName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Segmento: {resultData.segment} · {resultData.teamSize} colaboradores
                      </p>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                        <Clock className="h-5 w-5 text-red-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-red-600">
                          {resultData.totalCurrentTime.toFixed(0)}h
                        </p>
                        <p className="text-[11px] text-red-500 font-medium">Tempo atual/mês</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                        <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-emerald-600">
                          {resultData.totalWeesTime.toFixed(0)}h
                        </p>
                        <p className="text-[11px] text-emerald-500 font-medium">Com WEES/mês</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-center text-white">
                      <p className="text-sm font-medium opacity-90">Economia estimada</p>
                      <p className="text-3xl font-extrabold">
                        {resultData.timeSavedMonthly.toFixed(0)}h/mês
                      </p>
                      <p className="text-sm opacity-80">
                        {resultData.timeSavedPercentage.toFixed(0)}% de redução no tempo
                      </p>
                    </div>

                    {resultData.recommendation && (
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 italic">
                        "{resultData.recommendation}"
                      </p>
                    )}

                    <Button
                      className="w-full h-12 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg"
                      onClick={() =>
                        window.open(
                          `https://wa.me/5511999999999?text=${encodeURIComponent(
                            `Olá! Fiz a análise no site e gostaria de saber mais sobre o WEES. Meu nome é ${resultData.userName}, atuo no segmento de ${resultData.segment} com ${resultData.teamSize} colaboradores.`
                          )}`,
                          "_blank"
                        )
                      }
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      Falar com um Consultor
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Input area */}
      {currentStep < TOTAL_STEPS && !resultData && (
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-lg border-t border-slate-200/60">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              {stepInfo.label}
            </label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={stepInfo.placeholder}
                disabled={isLoading}
                type={stepInfo.type === "email" ? "email" : stepInfo.type === "tel" ? "tel" : "text"}
                className="flex-1 h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-blue-500"
                autoFocus
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || isSending}
                size="icon"
                className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Diagnostico;
