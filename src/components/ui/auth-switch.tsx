import { cn } from "@/lib/utils";

interface AuthSwitchProps {
  value: "login" | "register";
  onChange: (value: "login" | "register") => void;
}

export function AuthSwitch({ value, onChange }: AuthSwitchProps) {
  return (
    <div className="flex w-full rounded-xl bg-muted p-1 gap-1">
      <button
        type="button"
        onClick={() => onChange("login")}
        className={cn(
          "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-300",
          value === "login"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Entrar
      </button>
      <button
        type="button"
        onClick={() => onChange("register")}
        className={cn(
          "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-300",
          value === "register"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Criar Conta
      </button>
    </div>
  );
}
