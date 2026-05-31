CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: client_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.client_role AS ENUM (
    'viewer',
    'approver',
    'admin'
);


--
-- Name: deviation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deviation_type AS ENUM (
    'delay',
    'equipment',
    'safety',
    'other',
    'weather',
    'materials',
    'labor',
    'stoppage',
    'contractor',
    'supplier',
    'project_design',
    'planning',
    'execution'
);


--
-- Name: impact_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.impact_level AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'planning',
    'in_progress',
    'completed',
    'suspended'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'draft',
    'completed'
);


--
-- Name: shift_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_type AS ENUM (
    'morning',
    'afternoon',
    'night'
);


--
-- Name: stage_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stage_status AS ENUM (
    'planned',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);


--
-- Name: suggestion_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_category AS ENUM (
    'melhoria',
    'bug',
    'nova_funcionalidade',
    'integracao'
);


--
-- Name: suggestion_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_priority AS ENUM (
    'baixa',
    'media',
    'alta',
    'critica'
);


--
-- Name: suggestion_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_status AS ENUM (
    'backlog',
    'em_analise',
    'em_desenvolvimento',
    'concluido'
);


--
-- Name: task_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'planned',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'director',
    'supervisor',
    'leader',
    'collaborator',
    'hr',
    'super_admin'
);


--
-- Name: can_create_company(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_create_company(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT s.max_companies IS NULL OR get_user_companies_count(_user_id) < s.max_companies
      FROM public.subscriptions s
      JOIN public.profiles p ON p.company_id = s.company_id
      WHERE p.id = _user_id
      LIMIT 1
    ),
    true
  )
$$;


--
-- Name: client_has_role(uuid, public.client_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.client_has_role(_user_id uuid, _role public.client_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_user_roles cur
    JOIN public.client_profiles cp ON cp.id = cur.client_id
    WHERE cp.user_id = _user_id AND cur.role = _role
  )
$$;


--
-- Name: get_client_profile_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_client_profile_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.client_profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;


--
-- Name: get_user_companies_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_companies_count(_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::integer
  FROM public.user_companies
  WHERE user_id = _user_id
$$;


--
-- Name: get_user_company_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_company_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT company_id 
  FROM public.profiles 
  WHERE id = _user_id
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 0
      WHEN 'director' THEN 1 
      WHEN 'supervisor' THEN 2 
      WHEN 'leader' THEN 3 
      ELSE 4 
    END
  LIMIT 1
$$;


--
-- Name: get_user_team_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_team_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT team_id 
  FROM public.team_members 
  WHERE user_id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile for new user
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert default role for new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'collaborator')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.user_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.user_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: is_client(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_client(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_profiles
    WHERE user_id = _user_id AND is_active = true
  )
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;


--
-- Name: update_suggestion_votes_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_suggestion_votes_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feature_suggestions 
    SET votes_count = votes_count + 1, updated_at = now()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feature_suggestions 
    SET votes_count = votes_count - 1, updated_at = now()
    WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: clicksign_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clicksign_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    document_key character varying(255),
    document_url text,
    document_hash text,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    signed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: clicksign_signers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clicksign_signers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    signer_key character varying(255),
    client_id uuid,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(100),
    phone character varying(50),
    auth_method character varying(50) DEFAULT 'email'::character varying,
    sign_as character varying(50) DEFAULT 'sign'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    signature_url text,
    signed_at timestamp with time zone,
    ip_address character varying(50),
    user_agent text,
    geolocation jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clicksign_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clicksign_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(100) NOT NULL,
    document_key character varying(255),
    signer_key character varying(255),
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    company text,
    role text,
    signature_data text,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    company_id uuid,
    is_active boolean DEFAULT true,
    can_approve boolean DEFAULT true
);


--
-- Name: client_report_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_report_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    access_token uuid DEFAULT gen_random_uuid() NOT NULL,
    client_name text NOT NULL,
    client_email text,
    client_company text,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    role public.client_role DEFAULT 'approver'::public.client_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cnpj text,
    logo_url text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    photo_url text
);


--
-- Name: feature_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category public.suggestion_category DEFAULT 'melhoria'::public.suggestion_category,
    status public.suggestion_status DEFAULT 'backlog'::public.suggestion_status,
    priority public.suggestion_priority DEFAULT 'media'::public.suggestion_priority,
    votes_count integer DEFAULT 0,
    author_id uuid,
    author_name text NOT NULL,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    phone text,
    message text,
    status text DEFAULT 'new'::text,
    notes text,
    converted_company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    avatar_url text,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    type text,
    model text,
    quantity integer DEFAULT 1,
    daily_rate numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    status public.stage_status DEFAULT 'planned'::public.stage_status NOT NULL,
    color text DEFAULT '#3b82f6'::text,
    planned_start date,
    planned_end date,
    actual_start date,
    actual_end date,
    progress integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_stages_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    status public.task_status DEFAULT 'planned'::public.task_status NOT NULL,
    priority public.task_priority DEFAULT 'medium'::public.task_priority,
    order_index integer DEFAULT 0 NOT NULL,
    planned_start date,
    planned_end date,
    actual_start date,
    actual_end date,
    progress integer DEFAULT 0,
    assigned_to uuid,
    estimated_hours numeric,
    actual_hours numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_tasks_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    description text,
    status public.project_status DEFAULT 'planning'::public.project_status,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    photo_url text
);


--
-- Name: report_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    description text NOT NULL,
    completed boolean DEFAULT false,
    progress integer DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: report_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    user_id uuid,
    user_name text,
    present boolean DEFAULT true,
    arrival_time time without time zone,
    departure_time time without time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: report_client_approvers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_client_approvers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    client_id uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT report_client_approvers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: report_deviations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_deviations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    type public.deviation_type NOT NULL,
    description text NOT NULL,
    impact public.impact_level DEFAULT 'low'::public.impact_level,
    action_taken text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: report_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    equipment_id uuid,
    equipment_name text NOT NULL,
    hours_used numeric,
    quantity_used integer DEFAULT 1,
    status text DEFAULT 'operational'::text,
    observations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: report_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    url text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: report_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    access_id uuid,
    signature_data text NOT NULL,
    signer_name text NOT NULL,
    signer_role text,
    signed_at timestamp with time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    team_id uuid,
    created_by uuid,
    date date NOT NULL,
    shift public.shift_type DEFAULT 'morning'::public.shift_type NOT NULL,
    status public.report_status DEFAULT 'draft'::public.report_status,
    start_time time without time zone,
    end_time time without time zone,
    location text,
    weather text,
    temperature numeric,
    comments text,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone,
    contract_number text,
    technical_responsible_name text,
    technical_responsible_role text,
    supervisor_name text,
    supervisor_role text,
    planned_workforce integer DEFAULT 0,
    actual_workforce integer DEFAULT 0,
    real_percentage numeric,
    finalized_at timestamp with time zone,
    sent_at timestamp with time zone
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    city text,
    state text,
    address text,
    latitude double precision,
    longitude double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    photo_url text
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    plan text DEFAULT 'starter'::text NOT NULL,
    status text DEFAULT 'trial'::text NOT NULL,
    max_users integer DEFAULT 3,
    max_projects integer DEFAULT 1,
    max_reports_per_month integer DEFAULT 100,
    trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
    current_period_start timestamp with time zone DEFAULT now(),
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    max_companies integer DEFAULT 1
);


--
-- Name: suggestion_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestion_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    suggestion_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    leader_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    logo_url text,
    primary_color text DEFAULT '#7A1B3E'::text,
    secondary_color text DEFAULT '#ffffff'::text,
    accent_color text DEFAULT '#f59e0b'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sidebar_theme text DEFAULT 'dark'::text,
    favicon_url text
);


--
-- Name: user_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    is_owner boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role DEFAULT 'collaborator'::public.user_role NOT NULL
);


--
-- Name: clicksign_documents clicksign_documents_document_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_documents
    ADD CONSTRAINT clicksign_documents_document_key_key UNIQUE (document_key);


--
-- Name: clicksign_documents clicksign_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_documents
    ADD CONSTRAINT clicksign_documents_pkey PRIMARY KEY (id);


--
-- Name: clicksign_signers clicksign_signers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_signers
    ADD CONSTRAINT clicksign_signers_pkey PRIMARY KEY (id);


--
-- Name: clicksign_webhooks clicksign_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_webhooks
    ADD CONSTRAINT clicksign_webhooks_pkey PRIMARY KEY (id);


--
-- Name: client_profiles client_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_profiles
    ADD CONSTRAINT client_profiles_email_key UNIQUE (email);


--
-- Name: client_profiles client_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_profiles
    ADD CONSTRAINT client_profiles_pkey PRIMARY KEY (id);


--
-- Name: client_report_access client_report_access_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_report_access
    ADD CONSTRAINT client_report_access_access_token_key UNIQUE (access_token);


--
-- Name: client_report_access client_report_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_report_access
    ADD CONSTRAINT client_report_access_pkey PRIMARY KEY (id);


--
-- Name: client_user_roles client_user_roles_client_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_user_roles
    ADD CONSTRAINT client_user_roles_client_id_role_key UNIQUE (client_id, role);


--
-- Name: client_user_roles client_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_user_roles
    ADD CONSTRAINT client_user_roles_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: feature_suggestions feature_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_suggestions
    ADD CONSTRAINT feature_suggestions_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_equipment project_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_equipment
    ADD CONSTRAINT project_equipment_pkey PRIMARY KEY (id);


--
-- Name: project_stages project_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_stages
    ADD CONSTRAINT project_stages_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: report_activities report_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_activities
    ADD CONSTRAINT report_activities_pkey PRIMARY KEY (id);


--
-- Name: report_attendance report_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_attendance
    ADD CONSTRAINT report_attendance_pkey PRIMARY KEY (id);


--
-- Name: report_client_approvers report_client_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_client_approvers
    ADD CONSTRAINT report_client_approvers_pkey PRIMARY KEY (id);


--
-- Name: report_client_approvers report_client_approvers_report_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_client_approvers
    ADD CONSTRAINT report_client_approvers_report_id_client_id_key UNIQUE (report_id, client_id);


--
-- Name: report_deviations report_deviations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_deviations
    ADD CONSTRAINT report_deviations_pkey PRIMARY KEY (id);


--
-- Name: report_equipment report_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_equipment
    ADD CONSTRAINT report_equipment_pkey PRIMARY KEY (id);


--
-- Name: report_photos report_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_pkey PRIMARY KEY (id);


--
-- Name: report_signatures report_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_signatures
    ADD CONSTRAINT report_signatures_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_company_id_key UNIQUE (company_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: suggestion_votes suggestion_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_votes
    ADD CONSTRAINT suggestion_votes_pkey PRIMARY KEY (id);


--
-- Name: suggestion_votes suggestion_votes_suggestion_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_votes
    ADD CONSTRAINT suggestion_votes_suggestion_id_user_id_key UNIQUE (suggestion_id, user_id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_company_id_key UNIQUE (company_id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: user_companies user_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_pkey PRIMARY KEY (id);


--
-- Name: user_companies user_companies_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_user_id_company_id_key UNIQUE (user_id, company_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: client_profiles_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_profiles_user_id_unique ON public.client_profiles USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_clicksign_documents_document_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_documents_document_key ON public.clicksign_documents USING btree (document_key);


--
-- Name: idx_clicksign_documents_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_documents_report_id ON public.clicksign_documents USING btree (report_id);


--
-- Name: idx_clicksign_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_documents_status ON public.clicksign_documents USING btree (status);


--
-- Name: idx_clicksign_signers_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_signers_document_id ON public.clicksign_signers USING btree (document_id);


--
-- Name: idx_clicksign_signers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_signers_email ON public.clicksign_signers USING btree (email);


--
-- Name: idx_clicksign_signers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_signers_status ON public.clicksign_signers USING btree (status);


--
-- Name: idx_clicksign_webhooks_document_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_webhooks_document_key ON public.clicksign_webhooks USING btree (document_key);


--
-- Name: idx_clicksign_webhooks_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicksign_webhooks_processed ON public.clicksign_webhooks USING btree (processed);


--
-- Name: idx_client_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_profiles_email ON public.client_profiles USING btree (email);


--
-- Name: idx_client_report_access_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_report_access_report_id ON public.client_report_access USING btree (report_id);


--
-- Name: idx_client_report_access_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_report_access_token ON public.client_report_access USING btree (access_token);


--
-- Name: idx_project_equipment_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_equipment_project_id ON public.project_equipment USING btree (project_id);


--
-- Name: idx_project_stages_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_stages_project_id ON public.project_stages USING btree (project_id);


--
-- Name: idx_project_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_project_id ON public.project_tasks USING btree (project_id);


--
-- Name: idx_project_tasks_stage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_stage_id ON public.project_tasks USING btree (stage_id);


--
-- Name: idx_report_equipment_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_equipment_report_id ON public.report_equipment USING btree (report_id);


--
-- Name: idx_report_signatures_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_signatures_report_id ON public.report_signatures USING btree (report_id);


--
-- Name: suggestion_votes on_vote_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_vote_change AFTER INSERT OR DELETE ON public.suggestion_votes FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_votes_count();


--
-- Name: clicksign_documents update_clicksign_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clicksign_documents_updated_at BEFORE UPDATE ON public.clicksign_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clicksign_signers update_clicksign_signers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clicksign_signers_updated_at BEFORE UPDATE ON public.clicksign_signers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_profiles update_client_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON public.client_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feature_suggestions update_feature_suggestions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_feature_suggestions_updated_at BEFORE UPDATE ON public.feature_suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_equipment update_project_equipment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_equipment_updated_at BEFORE UPDATE ON public.project_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_stages update_project_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_stages_updated_at BEFORE UPDATE ON public.project_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_tasks update_project_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reports update_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sites update_sites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_settings update_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clicksign_documents clicksign_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_documents
    ADD CONSTRAINT clicksign_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: clicksign_documents clicksign_documents_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_documents
    ADD CONSTRAINT clicksign_documents_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: clicksign_signers clicksign_signers_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_signers
    ADD CONSTRAINT clicksign_signers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client_profiles(id);


--
-- Name: clicksign_signers clicksign_signers_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicksign_signers
    ADD CONSTRAINT clicksign_signers_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.clicksign_documents(id) ON DELETE CASCADE;


--
-- Name: client_profiles client_profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_profiles
    ADD CONSTRAINT client_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: client_profiles client_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_profiles
    ADD CONSTRAINT client_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: client_report_access client_report_access_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_report_access
    ADD CONSTRAINT client_report_access_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: client_report_access client_report_access_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_report_access
    ADD CONSTRAINT client_report_access_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: client_user_roles client_user_roles_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_user_roles
    ADD CONSTRAINT client_user_roles_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client_profiles(id) ON DELETE CASCADE;


--
-- Name: feature_suggestions feature_suggestions_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_suggestions
    ADD CONSTRAINT feature_suggestions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: feature_suggestions feature_suggestions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_suggestions
    ADD CONSTRAINT feature_suggestions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: leads leads_converted_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_company_id_fkey FOREIGN KEY (converted_company_id) REFERENCES public.companies(id);


--
-- Name: profiles profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_equipment project_equipment_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_equipment
    ADD CONSTRAINT project_equipment_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_stages project_stages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_stages
    ADD CONSTRAINT project_stages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.project_stages(id) ON DELETE CASCADE;


--
-- Name: projects projects_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: projects projects_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: report_activities report_activities_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_activities
    ADD CONSTRAINT report_activities_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: report_attendance report_attendance_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_attendance
    ADD CONSTRAINT report_attendance_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: report_attendance report_attendance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_attendance
    ADD CONSTRAINT report_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: report_client_approvers report_client_approvers_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_client_approvers
    ADD CONSTRAINT report_client_approvers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client_profiles(id) ON DELETE CASCADE;


--
-- Name: report_client_approvers report_client_approvers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_client_approvers
    ADD CONSTRAINT report_client_approvers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: report_client_approvers report_client_approvers_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_client_approvers
    ADD CONSTRAINT report_client_approvers_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: report_deviations report_deviations_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_deviations
    ADD CONSTRAINT report_deviations_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: report_equipment report_equipment_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_equipment
    ADD CONSTRAINT report_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.project_equipment(id) ON DELETE SET NULL;


--
-- Name: report_equipment report_equipment_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_equipment
    ADD CONSTRAINT report_equipment_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: report_photos report_photos_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: report_signatures report_signatures_access_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_signatures
    ADD CONSTRAINT report_signatures_access_id_fkey FOREIGN KEY (access_id) REFERENCES public.client_report_access(id) ON DELETE SET NULL;


--
-- Name: report_signatures report_signatures_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_signatures
    ADD CONSTRAINT report_signatures_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: reports reports_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reports reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reports reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: reports reports_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: sites sites_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: suggestion_votes suggestion_votes_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_votes
    ADD CONSTRAINT suggestion_votes_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.feature_suggestions(id) ON DELETE CASCADE;


--
-- Name: suggestion_votes suggestion_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_votes
    ADD CONSTRAINT suggestion_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: teams teams_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: teams teams_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tenant_settings tenant_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_companies user_companies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_companies user_companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports Admin/Directors/Supervisors can delete reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin/Directors/Supervisors can delete reports" ON public.reports FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: user_roles Admins and Directors can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Directors can manage roles" ON public.user_roles USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role)));


--
-- Name: report_signatures Admins can delete signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete signatures" ON public.report_signatures FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: feature_suggestions Admins can delete suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete suggestions" ON public.feature_suggestions FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: client_profiles Admins can manage client profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage client profiles" ON public.client_profiles USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: client_user_roles Admins can manage client roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage client roles" ON public.client_user_roles USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: companies Admins can manage companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage companies" ON public.companies TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: clicksign_documents Admins can manage documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage documents" ON public.clicksign_documents USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: projects Admins can manage projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage projects" ON public.projects TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: report_client_approvers Admins can manage report approvers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage report approvers" ON public.report_client_approvers USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: clicksign_signers Admins can manage signers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage signers" ON public.clicksign_signers USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: sites Admins can manage sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage sites" ON public.sites TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: team_members Admins can manage team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage team members" ON public.team_members TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: teams Admins can manage teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage teams" ON public.teams TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: report_signatures Admins can update signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update signatures" ON public.report_signatures FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: feature_suggestions Admins can update suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update suggestions" ON public.feature_suggestions FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: client_profiles Anyone can insert client profile during registration; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert client profile during registration" ON public.client_profiles FOR INSERT WITH CHECK (true);


--
-- Name: leads Anyone can insert leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT WITH CHECK (true);


--
-- Name: client_profiles Clients can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can update own profile" ON public.client_profiles FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: report_client_approvers Clients can update their approval status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can update their approval status" ON public.report_client_approvers FOR UPDATE USING ((client_id = public.get_client_profile_id(auth.uid())));


--
-- Name: client_profiles Clients can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can view own profile" ON public.client_profiles FOR SELECT USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: client_user_roles Clients can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can view own roles" ON public.client_user_roles FOR SELECT USING (((client_id = public.get_client_profile_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role)));


--
-- Name: report_client_approvers Clients can view their assigned reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can view their assigned reports" ON public.report_client_approvers FOR SELECT USING (((client_id = public.get_client_profile_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: tenant_settings Company admin can insert own tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admin can insert own tenant settings" ON public.tenant_settings FOR INSERT WITH CHECK (((company_id = public.get_user_company_id(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role))));


--
-- Name: tenant_settings Company admin can update own tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admin can update own tenant settings" ON public.tenant_settings FOR UPDATE USING (((company_id = public.get_user_company_id(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role))));


--
-- Name: subscriptions Company admin can view own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admin can view own subscription" ON public.subscriptions FOR SELECT USING ((company_id = public.get_user_company_id(auth.uid())));


--
-- Name: tenant_settings Company admin can view own tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admin can view own tenant settings" ON public.tenant_settings FOR SELECT USING ((company_id = public.get_user_company_id(auth.uid())));


--
-- Name: reports Creators and managers can update reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and managers can update reports" ON public.reports FOR UPDATE USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: project_equipment Managers can manage equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can manage equipment" ON public.project_equipment USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: project_stages Managers can manage stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can manage stages" ON public.project_stages USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: project_tasks Managers can manage tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can manage tasks" ON public.project_tasks USING ((public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: report_activities Report creators can manage activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Report creators can manage activities" ON public.report_activities USING ((EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_activities.report_id) AND ((reports.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))))));


--
-- Name: report_attendance Report creators can manage attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Report creators can manage attendance" ON public.report_attendance USING ((EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_attendance.report_id) AND ((reports.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))))));


--
-- Name: report_deviations Report creators can manage deviations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Report creators can manage deviations" ON public.report_deviations USING ((EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_deviations.report_id) AND ((reports.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))))));


--
-- Name: report_equipment Report creators can manage equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Report creators can manage equipment" ON public.report_equipment USING ((EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_equipment.report_id) AND ((reports.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))))));


--
-- Name: report_photos Report creators can manage photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Report creators can manage photos" ON public.report_photos USING ((EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_photos.report_id) AND ((reports.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role))))));


--
-- Name: clicksign_documents Report owners and admins can view documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Report owners and admins can view documents" ON public.clicksign_documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = clicksign_documents.report_id) AND ((r.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: clicksign_signers Signers and admins can view signer info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signers and admins can view signer info" ON public.clicksign_signers FOR SELECT USING (((client_id = public.get_client_profile_id(auth.uid())) OR (EXISTS ( SELECT 1
   FROM (public.clicksign_documents d
     JOIN public.reports r ON ((r.id = d.report_id)))
  WHERE ((d.id = clicksign_signers.document_id) AND ((r.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)))))));


--
-- Name: leads Super admin can manage all leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can manage all leads" ON public.leads USING (public.has_role(auth.uid(), 'super_admin'::public.user_role));


--
-- Name: subscriptions Super admin can manage all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can manage all subscriptions" ON public.subscriptions USING (public.has_role(auth.uid(), 'super_admin'::public.user_role));


--
-- Name: tenant_settings Super admin can manage all tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can manage all tenant settings" ON public.tenant_settings USING (public.has_role(auth.uid(), 'super_admin'::public.user_role));


--
-- Name: user_companies Super admin can manage all user_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can manage all user_companies" ON public.user_companies USING (public.has_role(auth.uid(), 'super_admin'::public.user_role));


--
-- Name: clicksign_webhooks Super admins can manage webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage webhooks" ON public.clicksign_webhooks USING (public.has_role(auth.uid(), 'super_admin'::public.user_role));


--
-- Name: clicksign_webhooks Super admins can view webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view webhooks" ON public.clicksign_webhooks FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.user_role));


--
-- Name: client_report_access Users can create access links for their reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create access links for their reports" ON public.client_report_access FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = client_report_access.report_id) AND ((r.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: reports Users can create reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: feature_suggestions Users can create suggestions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create suggestions" ON public.feature_suggestions FOR INSERT WITH CHECK (((author_id = auth.uid()) AND (company_id = public.get_user_company_id(auth.uid()))));


--
-- Name: client_report_access Users can delete their access links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their access links" ON public.client_report_access FOR DELETE USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role)));


--
-- Name: user_companies Users can delete their own company associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own company associations" ON public.user_companies FOR DELETE USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: user_companies Users can insert their own company associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own company associations" ON public.user_companies FOR INSERT WITH CHECK (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: suggestion_votes Users can remove their vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove their vote" ON public.suggestion_votes FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: client_report_access Users can view access links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view access links" ON public.client_report_access FOR SELECT USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: profiles Users can view company profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view company profiles" ON public.profiles FOR SELECT USING (((id = auth.uid()) OR (company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: user_roles Users can view limited roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view limited roles" ON public.user_roles FOR SELECT USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: report_activities Users can view related report activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related report activities" ON public.report_activities FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = report_activities.report_id) AND ((r.created_by = auth.uid()) OR (r.team_id IN ( SELECT team_members.team_id
           FROM public.team_members
          WHERE (team_members.user_id = auth.uid()))) OR (r.project_id IN ( SELECT p.id
           FROM public.projects p
          WHERE (p.company_id IN ( SELECT profiles.company_id
                   FROM public.profiles
                  WHERE (profiles.id = auth.uid()))))) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: report_attendance Users can view related report attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related report attendance" ON public.report_attendance FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = report_attendance.report_id) AND ((r.created_by = auth.uid()) OR (r.team_id IN ( SELECT team_members.team_id
           FROM public.team_members
          WHERE (team_members.user_id = auth.uid()))) OR (r.project_id IN ( SELECT p.id
           FROM public.projects p
          WHERE (p.company_id IN ( SELECT profiles.company_id
                   FROM public.profiles
                  WHERE (profiles.id = auth.uid()))))) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: report_deviations Users can view related report deviations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related report deviations" ON public.report_deviations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = report_deviations.report_id) AND ((r.created_by = auth.uid()) OR (r.team_id IN ( SELECT team_members.team_id
           FROM public.team_members
          WHERE (team_members.user_id = auth.uid()))) OR (r.project_id IN ( SELECT p.id
           FROM public.projects p
          WHERE (p.company_id IN ( SELECT profiles.company_id
                   FROM public.profiles
                  WHERE (profiles.id = auth.uid()))))) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: report_equipment Users can view related report equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related report equipment" ON public.report_equipment FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = report_equipment.report_id) AND ((r.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: report_photos Users can view related report photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related report photos" ON public.report_photos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = report_photos.report_id) AND ((r.created_by = auth.uid()) OR (r.team_id IN ( SELECT team_members.team_id
           FROM public.team_members
          WHERE (team_members.user_id = auth.uid()))) OR (r.project_id IN ( SELECT p.id
           FROM public.projects p
          WHERE (p.company_id IN ( SELECT profiles.company_id
                   FROM public.profiles
                  WHERE (profiles.id = auth.uid()))))) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: reports Users can view related reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view related reports" ON public.reports FOR SELECT USING (((created_by = auth.uid()) OR (team_id IN ( SELECT team_members.team_id
   FROM public.team_members
  WHERE (team_members.user_id = auth.uid()))) OR (project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.company_id IN ( SELECT profiles.company_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: report_signatures Users can view signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view signatures" ON public.report_signatures FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.reports r
  WHERE ((r.id = report_signatures.report_id) AND ((r.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: feature_suggestions Users can view suggestions from their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view suggestions from their company" ON public.feature_suggestions FOR SELECT USING (((company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: team_members Users can view team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view team members" ON public.team_members FOR SELECT USING (((team_id IN ( SELECT public.get_user_team_ids(auth.uid()) AS get_user_team_ids)) OR (team_id IN ( SELECT t.id
   FROM (public.teams t
     JOIN public.projects p ON ((t.project_id = p.id)))
  WHERE (p.company_id = public.get_user_company_id(auth.uid())))) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: companies Users can view their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company" ON public.companies FOR SELECT TO authenticated USING (((id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: user_companies Users can view their company associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company associations" ON public.user_companies FOR SELECT USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role)));


--
-- Name: project_equipment Users can view their company equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company equipment" ON public.project_equipment FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_equipment.project_id) AND ((p.company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: projects Users can view their company projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company projects" ON public.projects FOR SELECT TO authenticated USING (((company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: sites Users can view their company sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company sites" ON public.sites FOR SELECT TO authenticated USING (((company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role)));


--
-- Name: project_stages Users can view their company stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company stages" ON public.project_stages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_stages.project_id) AND ((p.company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: project_tasks Users can view their company tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company tasks" ON public.project_tasks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_tasks.project_id) AND ((p.company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role))))));


--
-- Name: teams Users can view their company teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company teams" ON public.teams FOR SELECT TO authenticated USING (((id IN ( SELECT public.get_user_team_ids(auth.uid()) AS get_user_team_ids)) OR (project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.company_id = public.get_user_company_id(auth.uid())))) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'director'::public.user_role) OR public.has_role(auth.uid(), 'supervisor'::public.user_role) OR public.has_role(auth.uid(), 'leader'::public.user_role)));


--
-- Name: suggestion_votes Users can view votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view votes" ON public.suggestion_votes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.feature_suggestions fs
  WHERE ((fs.id = suggestion_votes.suggestion_id) AND ((fs.company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'::public.user_role))))));


--
-- Name: suggestion_votes Users can vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can vote" ON public.suggestion_votes FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: clicksign_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clicksign_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: clicksign_signers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clicksign_signers ENABLE ROW LEVEL SECURITY;

--
-- Name: clicksign_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clicksign_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: client_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: client_report_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_report_access ENABLE ROW LEVEL SECURITY;

--
-- Name: client_user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: project_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: project_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: report_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: report_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: report_client_approvers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_client_approvers ENABLE ROW LEVEL SECURITY;

--
-- Name: report_deviations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_deviations ENABLE ROW LEVEL SECURITY;

--
-- Name: report_equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: report_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: report_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: suggestion_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;