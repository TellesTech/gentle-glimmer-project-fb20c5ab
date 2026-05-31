import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type ValidationStatus = "idle" | "validating" | "valid" | "invalid" | "warning";

interface ValidatedInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "cnpj" | "date" | "required" | "email";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  helperText?: string;
  required?: boolean;
  onValidationChange?: (status: ValidationStatus, info?: any) => void;
}

function formatCNPJInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function ValidatedInput({
  id,
  label,
  value,
  onChange,
  type = "required",
  placeholder,
  disabled,
  className,
  helperText,
  required = false,
  onValidationChange,
}: ValidatedInputProps) {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [message, setMessage] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback((newStatus: ValidationStatus, msg: string, info?: any) => {
    setStatus(newStatus);
    setMessage(msg);
    onValidationChange?.(newStatus, info);
  }, [onValidationChange]);

  const validateCNPJ = useCallback(async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length < 14) {
      updateStatus("warning", "CNPJ deve ter 14 dígitos");
      return;
    }

    updateStatus("validating", "Validando CNPJ...");

    try {
      const { data, error } = await supabase.functions.invoke('data-validation', {
        body: { cnpj: digits, type: 'cnpj' },
      });

      if (error) throw error;

      if (data.valid) {
        const companyName = data.company_info?.company_name;
        updateStatus("valid", companyName ? `✓ ${companyName}` : "CNPJ válido", data.company_info);
      } else {
        updateStatus("invalid", "CNPJ inválido");
      }
    } catch {
      // Fallback: basic algorithmic check
      updateStatus("warning", "Não foi possível validar online");
    }
  }, [updateStatus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    if (type === "cnpj") {
      newValue = formatCNPJInput(newValue);
    }

    onChange(newValue);

    if (debounceTimer) clearTimeout(debounceTimer);

    if (type === "cnpj") {
      const digits = newValue.replace(/\D/g, '');
      if (digits.length === 14) {
        const timer = setTimeout(() => validateCNPJ(newValue), 300);
        setDebounceTimer(timer);
      } else if (digits.length > 0) {
        updateStatus("warning", "CNPJ incompleto");
      } else {
        updateStatus("idle", "");
      }
    } else if (type === "email") {
      if (!newValue) {
        updateStatus(required ? "invalid" : "idle", required ? "Campo obrigatório" : "");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)) {
        updateStatus("invalid", "E-mail inválido");
      } else {
        updateStatus("valid", "");
      }
    } else if (type === "required") {
      if (!newValue.trim() && required) {
        updateStatus("invalid", "Campo obrigatório");
      } else if (newValue.trim()) {
        updateStatus("valid", "");
      } else {
        updateStatus("idle", "");
      }
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [debounceTimer]);

  const statusIcon = {
    idle: null,
    validating: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
    valid: <CheckCircle className="h-4 w-4 text-success" />,
    invalid: <XCircle className="h-4 w-4 text-destructive" />,
    warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  };

  const borderClass = {
    idle: "",
    validating: "border-muted-foreground",
    valid: "border-success",
    invalid: "border-destructive",
    warning: "border-warning",
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pr-9 transition-colors duration-300",
            borderClass[status]
          )}
        />
        {statusIcon[status] && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {statusIcon[status]}
          </div>
        )}
      </div>
      {message && (
        <p className={cn(
          "text-xs transition-all duration-200",
          status === "valid" && "text-success",
          status === "invalid" && "text-destructive",
          status === "warning" && "text-warning",
          status === "validating" && "text-muted-foreground",
        )}>
          {message}
        </p>
      )}
      {helperText && !message && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
