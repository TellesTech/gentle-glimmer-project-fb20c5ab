import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sun, Moon, Sunrise } from 'lucide-react';

interface WelcomeHeaderProps {
  userName?: string;
}

export function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  const hour = new Date().getHours();
  
  const getGreeting = () => {
    if (hour >= 5 && hour < 12) return { text: 'Bom dia', Icon: Sunrise };
    if (hour >= 12 && hour < 18) return { text: 'Boa tarde', Icon: Sun };
    return { text: 'Boa noite', Icon: Moon };
  };

  const { text: greeting, Icon: GreetingIcon } = getGreeting();
  const firstName = userName?.split(' ')[0] || 'Usuário';
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
      <div className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 shrink-0">
        <GreetingIcon className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg xs:text-xl sm:text-2xl font-bold text-foreground truncate">
          {greeting}, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground capitalize truncate">{today}</p>
      </div>
    </div>
  );
}
