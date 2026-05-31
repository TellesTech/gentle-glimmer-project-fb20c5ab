import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DelayCategory = 'operational' | 'climatic' | 'amt';

export interface DelayReasonOption {
  id: string;
  category: DelayCategory;
  label: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export function useDelayReasons(category?: DelayCategory) {
  return useQuery({
    queryKey: ['delay-reasons', category],
    queryFn: async () => {
      let query = supabase
        .from('delay_reason_options')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DelayReasonOption[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - reasons don't change often
  });
}
