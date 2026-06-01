import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/loose-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type SuggestionStatus = "backlog" | "em_analise" | "em_desenvolvimento" | "concluido";
export type SuggestionCategory = "melhoria" | "bug" | "nova_funcionalidade" | "integracao";
export type SuggestionPriority = "baixa" | "media" | "alta" | "critica";

export interface Suggestion {
  id: string;
  title: string;
  description: string | null;
  category: SuggestionCategory;
  status: SuggestionStatus;
  priority: SuggestionPriority;
  votes_count: number;
  author_id: string | null;
  author_name: string;
  company_id: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
  user_voted?: boolean;
}

export interface NewSuggestion {
  title: string;
  description?: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  screenshot_url?: string;
}

export const useSuggestions = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading, refetch } = useQuery({
    queryKey: ["suggestions", profile?.company_id],
    queryFn: async () => {
      // Build query - filter by company if user has one, otherwise fetch global suggestions
      let query = supabase
        .from("feature_suggestions")
        .select("*")
        .order("votes_count", { ascending: false });

      if (profile?.company_id) {
        // User has company - show company suggestions + global ones
        query = query.or(`company_id.eq.${profile.company_id},company_id.is.null`);
      } else {
        // User has no company - show only global suggestions
        query = query.is("company_id", null);
      }

      const { data: suggestionsData, error } = await query;

      if (error) throw error;

      // Get user's votes
      const { data: userVotes } = await supabase
        .from("suggestion_votes")
        .select("suggestion_id")
        .eq("user_id", user?.id || "");

      const votedIds = new Set(userVotes?.map((v) => v.suggestion_id) || []);

      return (suggestionsData || []).map((s) => ({
        ...s,
        user_voted: votedIds.has(s.id),
      })) as Suggestion[];
    },
    enabled: !!user?.id,
  });

  const createSuggestion = useMutation({
    mutationFn: async (newSuggestion: NewSuggestion) => {
      if (!user?.id) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase
        .from("feature_suggestions")
        .insert({
          title: newSuggestion.title,
          description: newSuggestion.description || null,
          category: newSuggestion.category,
          priority: newSuggestion.priority,
          screenshot_url: newSuggestion.screenshot_url || null,
          author_id: user.id,
          author_name: profile?.name || profile?.email || "Usuário",
          company_id: profile?.company_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      toast.success("Sugestão criada com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating suggestion:", error);
      toast.error("Erro ao criar sugestão");
    },
  });

  const updateSuggestionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SuggestionStatus }) => {
      const { error } = await supabase
        .from("feature_suggestions")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ["suggestions", profile?.company_id] });

      // Salvar estado anterior para rollback
      const previousSuggestions = queryClient.getQueryData<Suggestion[]>(["suggestions", profile?.company_id]);

      // Atualizar cache otimisticamente
      queryClient.setQueryData<Suggestion[]>(
        ["suggestions", profile?.company_id],
        (old) => old?.map((s) => (s.id === id ? { ...s, status } : s)) || []
      );

      return { previousSuggestions };
    },
    onError: (error, _variables, context) => {
      // Rollback em caso de erro
      if (context?.previousSuggestions) {
        queryClient.setQueryData(
          ["suggestions", profile?.company_id],
          context.previousSuggestions
        );
      }
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
    },
  });

  const deleteSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("feature_suggestions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      toast.success("Sugestão removida!");
    },
    onError: (error) => {
      console.error("Error deleting suggestion:", error);
      toast.error("Erro ao remover sugestão");
    },
  });

  const toggleVote = useMutation({
    mutationFn: async ({ suggestionId, hasVoted }: { suggestionId: string; hasVoted: boolean }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      if (hasVoted) {
        const { error } = await supabase
          .from("suggestion_votes")
          .delete()
          .eq("suggestion_id", suggestionId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("suggestion_votes")
          .insert({
            suggestion_id: suggestionId,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
    onError: (error) => {
      console.error("Error toggling vote:", error);
      toast.error("Erro ao votar");
    },
  });

  const getSuggestionsByStatus = (status: SuggestionStatus) => {
    return suggestions.filter((s) => s.status === status);
  };

  return {
    suggestions,
    isLoading,
    refetch,
    createSuggestion,
    updateSuggestionStatus,
    deleteSuggestion,
    toggleVote,
    getSuggestionsByStatus,
  };
};
