export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "company_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_client_errors: {
        Row: {
          created_at: string
          extra: Json | null
          id: string
          message: string
          path: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extra?: Json | null
          id?: string
          message: string
          path: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extra?: Json | null
          id?: string
          message?: string
          path?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      autentique_documents: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          document_id: string
          document_name: string | null
          id: string
          metadata: Json | null
          report_id: string
          sandbox: boolean | null
          signed_at: string | null
          signed_file_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          document_name?: string | null
          id?: string
          metadata?: Json | null
          report_id: string
          sandbox?: boolean | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_name?: string | null
          id?: string
          metadata?: Json | null
          report_id?: string
          sandbox?: boolean | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autentique_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autentique_documents_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      autentique_signers: {
        Row: {
          action: string | null
          client_id: string | null
          created_at: string
          delivery_method: string | null
          document_id: string
          email: string
          geolocation: Json | null
          id: string
          ip_address: string | null
          name: string
          phone: string | null
          sign_link: string | null
          signed_at: string | null
          signer_id: string | null
          signer_type: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          action?: string | null
          client_id?: string | null
          created_at?: string
          delivery_method?: string | null
          document_id: string
          email: string
          geolocation?: Json | null
          id?: string
          ip_address?: string | null
          name: string
          phone?: string | null
          sign_link?: string | null
          signed_at?: string | null
          signer_id?: string | null
          signer_type?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string | null
          client_id?: string | null
          created_at?: string
          delivery_method?: string | null
          document_id?: string
          email?: string
          geolocation?: Json | null
          id?: string
          ip_address?: string | null
          name?: string
          phone?: string | null
          sign_link?: string | null
          signed_at?: string | null
          signer_id?: string | null
          signer_type?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autentique_signers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autentique_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "autentique_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      autentique_webhooks: {
        Row: {
          created_at: string
          document_id: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          signer_id: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          signer_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          signer_id?: string | null
        }
        Relationships: []
      }
      clicksign_documents: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          document_hash: string | null
          document_key: string | null
          document_url: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          report_id: string
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          document_hash?: string | null
          document_key?: string | null
          document_url?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          report_id: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          document_hash?: string | null
          document_key?: string | null
          document_url?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          report_id?: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clicksign_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicksign_documents_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      clicksign_signers: {
        Row: {
          auth_method: string | null
          client_id: string | null
          created_at: string
          document_id: string
          email: string
          geolocation: Json | null
          id: string
          ip_address: string | null
          name: string
          phone: string | null
          role: string | null
          sign_as: string | null
          signature_url: string | null
          signed_at: string | null
          signer_key: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth_method?: string | null
          client_id?: string | null
          created_at?: string
          document_id: string
          email: string
          geolocation?: Json | null
          id?: string
          ip_address?: string | null
          name: string
          phone?: string | null
          role?: string | null
          sign_as?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signer_key?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth_method?: string | null
          client_id?: string | null
          created_at?: string
          document_id?: string
          email?: string
          geolocation?: Json | null
          id?: string
          ip_address?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          sign_as?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signer_key?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicksign_signers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicksign_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "clicksign_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      clicksign_webhooks: {
        Row: {
          created_at: string
          document_key: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          signer_key: string | null
        }
        Insert: {
          created_at?: string
          document_key?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          signer_key?: string | null
        }
        Update: {
          created_at?: string
          document_key?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          signer_key?: string | null
        }
        Relationships: []
      }
      client_companies: {
        Row: {
          client_id: string
          company_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          address: string | null
          can_approve: boolean | null
          city: string | null
          cnpj: string | null
          company: string | null
          company_id: string | null
          contract_number: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_phone: string | null
          responsible_role: string | null
          role: string | null
          signature_data: string | null
          state: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          can_approve?: boolean | null
          city?: string | null
          cnpj?: string | null
          company?: string | null
          company_id?: string | null
          contract_number?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          responsible_role?: string | null
          role?: string | null
          signature_data?: string | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          can_approve?: boolean | null
          city?: string | null
          cnpj?: string | null
          company?: string | null
          company_id?: string | null
          contract_number?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          responsible_role?: string | null
          role?: string | null
          signature_data?: string | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_report_access: {
        Row: {
          access_token: string
          client_company: string | null
          client_email: string | null
          client_name: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          report_id: string
        }
        Insert: {
          access_token?: string
          client_company?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          report_id: string
        }
        Update: {
          access_token?: string
          client_company?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_report_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_report_access_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sites: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          site_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          site_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_user_roles: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["client_role"]
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["client_role"]
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["client_role"]
        }
        Relationships: [
          {
            foreignKeyName: "client_user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          client_notes: string | null
          cnpj: string | null
          contract_number: string | null
          created_at: string | null
          email: string | null
          id: string
          is_client_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          photo_url: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_phone: string | null
          responsible_role: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_notes?: string | null
          cnpj?: string | null
          contract_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_client_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          responsible_role?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          client_notes?: string | null
          cnpj?: string | null
          contract_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_client_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          responsible_role?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_contacts: {
        Row: {
          avatar_url: string | null
          can_approve: boolean | null
          company_id: string
          created_at: string | null
          email: string
          id: string
          invitation_count: number | null
          invitation_sent_at: string | null
          is_active: boolean | null
          name: string
          phone: string | null
          pin_hash: string | null
          role: string | null
          signature_data: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          can_approve?: boolean | null
          company_id: string
          created_at?: string | null
          email: string
          id?: string
          invitation_count?: number | null
          invitation_sent_at?: string | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          pin_hash?: string | null
          role?: string | null
          signature_data?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          can_approve?: boolean | null
          company_id?: string
          created_at?: string | null
          email?: string
          id?: string
          invitation_count?: number | null
          invitation_sent_at?: string | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          pin_hash?: string | null
          role?: string | null
          signature_data?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_sites: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          site_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          site_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_sites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "company_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_suggestions: {
        Row: {
          author_id: string | null
          author_name: string
          category: Database["public"]["Enums"]["suggestion_category"] | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["suggestion_priority"] | null
          status: Database["public"]["Enums"]["suggestion_status"] | null
          title: string
          updated_at: string | null
          votes_count: number | null
        }
        Insert: {
          author_id?: string | null
          author_name: string
          category?: Database["public"]["Enums"]["suggestion_category"] | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["suggestion_priority"] | null
          status?: Database["public"]["Enums"]["suggestion_status"] | null
          title: string
          updated_at?: string | null
          votes_count?: number | null
        }
        Update: {
          author_id?: string | null
          author_name?: string
          category?: Database["public"]["Enums"]["suggestion_category"] | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["suggestion_priority"] | null
          status?: Database["public"]["Enums"]["suggestion_status"] | null
          title?: string
          updated_at?: string | null
          votes_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_suggestions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_suggestions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          converted_company_id: string | null
          created_at: string | null
          email: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          converted_company_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          converted_company_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      portal_admin_access: {
        Row: {
          created_at: string | null
          id: string
          site_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          site_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          site_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_admin_access_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          email: string
          employment_type: string | null
          id: string
          job_title: string | null
          name: string
          phone: string | null
          pin_hash: string | null
          signature_data: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          email: string
          employment_type?: string | null
          id: string
          job_title?: string | null
          name: string
          phone?: string | null
          pin_hash?: string | null
          signature_data?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string
          employment_type?: string | null
          id?: string
          job_title?: string | null
          name?: string
          phone?: string | null
          pin_hash?: string | null
          signature_data?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_workforce: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          planned_count: number
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          planned_count?: number
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          planned_count?: number
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_workforce_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_equipment: {
        Row: {
          created_at: string
          daily_rate: number | null
          id: string
          model: string | null
          name: string
          notes: string | null
          project_id: string
          quantity: number | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number | null
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          project_id: string
          quantity?: number | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_rate?: number | null
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          project_id?: string
          quantity?: number | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_equipment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_start_date: boolean | null
          project_id: string
          target_date: string
          target_percentage: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_start_date?: boolean | null
          project_id: string
          target_date: string
          target_percentage?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_start_date?: boolean | null
          project_id?: string
          target_date?: string
          target_percentage?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          planned_end: string | null
          planned_start: string | null
          progress: number | null
          project_id: string
          status: Database["public"]["Enums"]["stage_status"]
          total_quantity: number | null
          unit: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          progress?: number | null
          project_id: string
          status?: Database["public"]["Enums"]["stage_status"]
          total_quantity?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          progress?: number | null
          project_id?: string
          status?: Database["public"]["Enums"]["stage_status"]
          total_quantity?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_end: string | null
          actual_hours: number | null
          actual_start: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          name: string
          order_index: number
          planned_end: string | null
          planned_start: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          progress: number | null
          project_id: string
          stage_id: string
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_hours?: number | null
          actual_start?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          progress?: number | null
          project_id: string
          stage_id: string
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_hours?: number | null
          actual_start?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name?: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          progress?: number | null
          project_id?: string
          stage_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_responsible_name: string | null
          code: string | null
          company_id: string
          contract_number: string | null
          created_at: string | null
          default_planned_workforce: number | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          photo_url: string | null
          progress: number | null
          progress_target: number | null
          site_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          supervisor_name: string | null
          updated_at: string | null
        }
        Insert: {
          client_responsible_name?: string | null
          code?: string | null
          company_id: string
          contract_number?: string | null
          created_at?: string | null
          default_planned_workforce?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          photo_url?: string | null
          progress?: number | null
          progress_target?: number | null
          site_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          supervisor_name?: string | null
          updated_at?: string | null
        }
        Update: {
          client_responsible_name?: string | null
          code?: string | null
          company_id?: string
          contract_number?: string | null
          created_at?: string | null
          default_planned_workforce?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          progress?: number | null
          progress_target?: number | null
          site_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          supervisor_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      report_activities: {
        Row: {
          completed: boolean | null
          created_at: string | null
          description: string
          id: string
          notes: string | null
          progress: number | null
          report_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          description: string
          id?: string
          notes?: string | null
          progress?: number | null
          report_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          progress?: number | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_activities_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attendance: {
        Row: {
          arrival_time: string | null
          created_at: string | null
          departure_time: string | null
          id: string
          notes: string | null
          present: boolean | null
          report_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          present?: boolean | null
          report_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          present?: boolean | null
          report_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_attendance_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_client_approvers: {
        Row: {
          approved_at: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          report_id: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          report_id: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          report_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_client_approvers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_client_approvers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_client_approvers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_company_approvers: {
        Row: {
          approved_at: string | null
          contact_id: string
          created_at: string | null
          created_by: string | null
          id: string
          report_id: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          contact_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          report_id: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          report_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_company_approvers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "company_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_company_approvers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_deviations: {
        Row: {
          action_taken: string | null
          created_at: string | null
          description: string
          id: string
          impact: Database["public"]["Enums"]["impact_level"] | null
          report_id: string
          type: Database["public"]["Enums"]["deviation_type"]
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          description: string
          id?: string
          impact?: Database["public"]["Enums"]["impact_level"] | null
          report_id: string
          type: Database["public"]["Enums"]["deviation_type"]
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          description?: string
          id?: string
          impact?: Database["public"]["Enums"]["impact_level"] | null
          report_id?: string
          type?: Database["public"]["Enums"]["deviation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "report_deviations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_equipment: {
        Row: {
          created_at: string
          equipment_id: string | null
          equipment_name: string
          hours_used: number | null
          id: string
          observations: string | null
          quantity_used: number | null
          report_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          equipment_name: string
          hours_used?: number | null
          id?: string
          observations?: string | null
          quantity_used?: number | null
          report_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          equipment_name?: string
          hours_used?: number | null
          id?: string
          observations?: string | null
          quantity_used?: number | null
          report_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "project_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_equipment_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_photos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          report_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          report_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          report_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_signatures: {
        Row: {
          access_id: string | null
          id: string
          ip_address: string | null
          report_id: string
          signature_data: string
          signed_at: string | null
          signer_name: string
          signer_role: string | null
          signer_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_id?: string | null
          id?: string
          ip_address?: string | null
          report_id: string
          signature_data: string
          signed_at?: string | null
          signer_name: string
          signer_role?: string | null
          signer_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_id?: string | null
          id?: string
          ip_address?: string | null
          report_id?: string
          signature_data?: string
          signed_at?: string | null
          signer_name?: string
          signer_role?: string | null
          signer_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_signatures_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "client_report_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_signatures_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          actual_workforce: number | null
          amt_deviation_hours: number | null
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          client_company: string | null
          client_name: string | null
          climatic_deviation_hours: number | null
          comments: string | null
          contract_number: string | null
          created_at: string | null
          created_by: string | null
          daily_progress: number | null
          date: string
          end_time: string | null
          finalized_at: string | null
          id: string
          location: string | null
          maintenance_order_number: string | null
          maintenance_order_title: string | null
          no_activity: boolean | null
          operational_deviation_hours: number | null
          planned_workforce: number | null
          project_id: string
          rdo_number: number | null
          real_percentage: number | null
          rejected_reason: string | null
          sent_at: string | null
          shift: Database["public"]["Enums"]["shift_type"]
          signed_pdf_url: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["report_status"] | null
          supervisor_name: string | null
          supervisor_role: string | null
          team_id: string | null
          technical_responsible_name: string | null
          technical_responsible_role: string | null
          temperature: number | null
          updated_at: string | null
          weather: string | null
        }
        Insert: {
          actual_workforce?: number | null
          amt_deviation_hours?: number | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          client_company?: string | null
          client_name?: string | null
          climatic_deviation_hours?: number | null
          comments?: string | null
          contract_number?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_progress?: number | null
          date: string
          end_time?: string | null
          finalized_at?: string | null
          id?: string
          location?: string | null
          maintenance_order_number?: string | null
          maintenance_order_title?: string | null
          no_activity?: boolean | null
          operational_deviation_hours?: number | null
          planned_workforce?: number | null
          project_id: string
          rdo_number?: number | null
          real_percentage?: number | null
          rejected_reason?: string | null
          sent_at?: string | null
          shift?: Database["public"]["Enums"]["shift_type"]
          signed_pdf_url?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          supervisor_name?: string | null
          supervisor_role?: string | null
          team_id?: string | null
          technical_responsible_name?: string | null
          technical_responsible_role?: string | null
          temperature?: number | null
          updated_at?: string | null
          weather?: string | null
        }
        Update: {
          actual_workforce?: number | null
          amt_deviation_hours?: number | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          client_company?: string | null
          client_name?: string | null
          climatic_deviation_hours?: number | null
          comments?: string | null
          contract_number?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_progress?: number | null
          date?: string
          end_time?: string | null
          finalized_at?: string | null
          id?: string
          location?: string | null
          maintenance_order_number?: string | null
          maintenance_order_title?: string | null
          no_activity?: boolean | null
          operational_deviation_hours?: number | null
          planned_workforce?: number | null
          project_id?: string
          rdo_number?: number | null
          real_percentage?: number | null
          rejected_reason?: string | null
          sent_at?: string | null
          shift?: Database["public"]["Enums"]["shift_type"]
          signed_pdf_url?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          supervisor_name?: string | null
          supervisor_role?: string | null
          team_id?: string | null
          technical_responsible_name?: string | null
          technical_responsible_role?: string | null
          temperature?: number | null
          updated_at?: string | null
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_report_photos: {
        Row: {
          annotations: Json | null
          caption: string | null
          created_at: string
          id: string
          layout: Database["public"]["Enums"]["service_photo_layout"]
          order_index: number
          section_id: string
          url: string
        }
        Insert: {
          annotations?: Json | null
          caption?: string | null
          created_at?: string
          id?: string
          layout?: Database["public"]["Enums"]["service_photo_layout"]
          order_index?: number
          section_id: string
          url: string
        }
        Update: {
          annotations?: Json | null
          caption?: string | null
          created_at?: string
          id?: string
          layout?: Database["public"]["Enums"]["service_photo_layout"]
          order_index?: number
          section_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_report_photos_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "service_report_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      service_report_sections: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          order_index: number
          report_id: string
          section_type: Database["public"]["Enums"]["service_section_type"]
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          order_index?: number
          report_id: string
          section_type?: Database["public"]["Enums"]["service_section_type"]
          title?: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          order_index?: number
          report_id?: string
          section_type?: Database["public"]["Enums"]["service_section_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "service_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reports: {
        Row: {
          client_contact: string | null
          client_name: string | null
          client_unit: string | null
          code: string | null
          company_id: string | null
          conclusion: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          project_id: string | null
          revision: number
          safety_notes: string | null
          scope_description: string | null
          site_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["service_report_status"]
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_contact?: string | null
          client_name?: string | null
          client_unit?: string | null
          code?: string | null
          company_id?: string | null
          conclusion?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          project_id?: string | null
          revision?: number
          safety_notes?: string | null
          scope_description?: string | null
          site_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_report_status"]
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_contact?: string | null
          client_name?: string | null
          client_unit?: string | null
          code?: string | null
          company_id?: string | null
          conclusion?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          project_id?: string | null
          revision?: number
          safety_notes?: string | null
          scope_description?: string | null
          site_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_report_status"]
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_notifications: {
        Row: {
          created_at: string | null
          document_id: string | null
          id: string
          notification_type: string
          recipient_email: string
          sent_at: string | null
          signer_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          notification_type: string
          recipient_email: string
          sent_at?: string | null
          signer_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          notification_type?: string
          recipient_email?: string
          sent_at?: string | null
          signer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "autentique_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_notifications_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "autentique_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_responsibles: {
        Row: {
          created_at: string | null
          id: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_responsibles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_responsibles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          photo_url: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          photo_url?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          photo_url?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          company_id: string
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          max_companies: number | null
          max_projects: number | null
          max_reports_per_month: number | null
          max_users: number | null
          plan: string
          status: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_companies?: number | null
          max_projects?: number | null
          max_reports_per_month?: number | null
          max_users?: number | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_companies?: number | null
          max_projects?: number | null
          max_reports_per_month?: number | null
          max_users?: number | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_votes: {
        Row: {
          created_at: string | null
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "feature_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          accent_color: string | null
          ai_avatar_url: string | null
          created_at: string | null
          favicon_url: string | null
          id: string
          login_logo_url: string | null
          logo_url: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_role: string | null
          pdf_logo_url: string | null
          primary_color: string | null
          system_name: string | null
          system_subtitle: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          ai_avatar_url?: string | null
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          login_logo_url?: string | null
          logo_url?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_role?: string | null
          pdf_logo_url?: string | null
          primary_color?: string | null
          system_name?: string | null
          system_subtitle?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          ai_avatar_url?: string | null
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          login_logo_url?: string | null
          logo_url?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_role?: string | null
          pdf_logo_url?: string | null
          primary_color?: string | null
          system_name?: string | null
          system_subtitle?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          order_index: number | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          order_index?: number | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          order_index?: number | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          leader_id: string | null
          name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          leader_id?: string | null
          name: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          leader_id?: string | null
          name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          accent_color: string | null
          company_id: string
          created_at: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          sidebar_theme: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          company_id: string
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          sidebar_theme?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          company_id?: string
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          sidebar_theme?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_owner: boolean | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_owner?: boolean | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_owner?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_company: { Args: { _user_id: string }; Returns: boolean }
      client_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["client_role"]
          _user_id: string
        }
        Returns: boolean
      }
      get_client_profile_id: { Args: { _user_id: string }; Returns: string }
      get_client_project_ids: { Args: { _user_id: string }; Returns: string[] }
      get_company_contact_id: { Args: { _user_id: string }; Returns: string }
      get_contact_project_ids: { Args: { _user_id: string }; Returns: string[] }
      get_eligible_supervisors: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      get_quick_access_users: {
        Args: never
        Returns: {
          avatar_url: string
          has_pin: boolean
          id: string
          name: string
        }[]
      }
      get_user_companies_count: { Args: { _user_id: string }; Returns: number }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_site_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client: { Args: { _user_id: string }; Returns: boolean }
      is_company_contact: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      client_role: "viewer" | "approver" | "admin"
      deviation_type:
        | "delay"
        | "equipment"
        | "safety"
        | "other"
        | "weather"
        | "materials"
        | "labor"
        | "stoppage"
        | "contractor"
        | "supplier"
        | "project_design"
        | "planning"
        | "execution"
      impact_level: "low" | "medium" | "high"
      project_status: "planning" | "in_progress" | "completed" | "suspended"
      report_status: "draft" | "completed" | "sent" | "signed" | "finalized"
      service_photo_layout: "full" | "half" | "third"
      service_report_status: "draft" | "completed" | "published"
      service_section_type:
        | "execution"
        | "safety"
        | "scope"
        | "conclusion"
        | "custom"
      shift_type: "morning" | "afternoon" | "night"
      stage_status:
        | "planned"
        | "in_progress"
        | "paused"
        | "completed"
        | "cancelled"
      suggestion_category:
        | "melhoria"
        | "bug"
        | "nova_funcionalidade"
        | "integracao"
      suggestion_priority: "baixa" | "media" | "alta" | "critica"
      suggestion_status:
        | "backlog"
        | "em_analise"
        | "em_desenvolvimento"
        | "concluido"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "planned"
        | "in_progress"
        | "paused"
        | "completed"
        | "cancelled"
      user_role:
        | "admin"
        | "director"
        | "supervisor"
        | "leader"
        | "collaborator"
        | "hr"
        | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_role: ["viewer", "approver", "admin"],
      deviation_type: [
        "delay",
        "equipment",
        "safety",
        "other",
        "weather",
        "materials",
        "labor",
        "stoppage",
        "contractor",
        "supplier",
        "project_design",
        "planning",
        "execution",
      ],
      impact_level: ["low", "medium", "high"],
      project_status: ["planning", "in_progress", "completed", "suspended"],
      report_status: ["draft", "completed", "sent", "signed", "finalized"],
      service_photo_layout: ["full", "half", "third"],
      service_report_status: ["draft", "completed", "published"],
      service_section_type: [
        "execution",
        "safety",
        "scope",
        "conclusion",
        "custom",
      ],
      shift_type: ["morning", "afternoon", "night"],
      stage_status: [
        "planned",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      suggestion_category: [
        "melhoria",
        "bug",
        "nova_funcionalidade",
        "integracao",
      ],
      suggestion_priority: ["baixa", "media", "alta", "critica"],
      suggestion_status: [
        "backlog",
        "em_analise",
        "em_desenvolvimento",
        "concluido",
      ],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: [
        "planned",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      user_role: [
        "admin",
        "director",
        "supervisor",
        "leader",
        "collaborator",
        "hr",
        "super_admin",
      ],
    },
  },
} as const
