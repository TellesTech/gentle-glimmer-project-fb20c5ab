import { useNavigate } from 'react-router-dom';
import { WelcomeHeader, QuickActions, UserDashboardStats, UserProjectsList, UserRecentReports } from '@/components/home';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const getPublicImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/company-photos/${url}`;
};

export default function Home() {
  const { profile, user, role } = useAuth();
  const navigate = useNavigate();
  const { companies, isLoading: isAccessLoading } = useAdminSiteAccess();

  // Admin com múltiplas fábricas → cards estilo SuperAdmin
  if (role === 'admin' && companies.length > 0) {
    if (isAccessLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 min-w-0">
        {/* Cards de fábricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="cursor-pointer transition-all sm:hover:shadow-xl sm:hover:scale-[1.02] active:scale-[0.99] group h-full relative overflow-hidden"
              onClick={() => navigate(`/companies/${company.id}/dashboard`)}
            >
              <Badge variant="secondary" className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5">
                Fábrica
              </Badge>

              <div className="aspect-[2/1] flex items-center justify-center bg-muted/30 p-4">
                {(company.logoUrl || company.photoUrl) ? (
                  <img
                    src={getPublicImageUrl(company.logoUrl || company.photoUrl)}
                    alt={company.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>

              <div className="p-3 pt-2">
                <button className="w-full py-2 px-3 rounded-lg bg-white/80 backdrop-blur-xl border border-gray-200 shadow-md text-sm font-semibold text-gray-800 hover:bg-white/90 hover:shadow-lg transition-all">
                  Dashboard {company.name}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <WelcomeHeader userName={profile?.name} />
      <UserDashboardStats userId={user?.id} />
      <QuickActions />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <UserRecentReports userId={user?.id} />
        <UserProjectsList />
      </div>
    </div>
  );
}
