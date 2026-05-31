import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hash PIN function using Web Crypto API - UNIFIED FORMAT: saltBase64:hashBase64
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinData = encoder.encode(pin);
  
  // Combine salt and pin
  const combined = new Uint8Array(salt.length + pinData.length);
  combined.set(salt);
  combined.set(pinData, salt.length);
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Encode salt and hash as base64 for storage (UNIFIED FORMAT with colon separator)
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return `${saltBase64}:${hashBase64}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client and get authenticated user from token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is authorized (super_admin or admin)
    
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isSuperAdmin = roleData?.role === 'super_admin';
    const isAdmin = roleData?.role === 'admin';

    if (roleError || !roleData || (!isSuperAdmin && !isAdmin)) {
      console.error('Role check failed:', roleError, roleData);
      return new Response(JSON.stringify({ error: 'Apenas super admins e administradores podem gerenciar usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's company_id if not super_admin
    let userCompanyId: string | null = null;
    if (!isSuperAdmin) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      userCompanyId = profileData?.company_id || null;
    }

    const { action, ...payload } = await req.json();
    console.log('Admin action:', action, 'by user:', user.email, 'role:', roleData.role);

    // Hierarquia de roles (menor número = mais poderoso)
    const roleHierarchy: Record<string, number> = {
      'super_admin': 0,
      'director': 1,
      'admin': 2,
      'hr': 3,
      'supervisor': 4,
      'leader': 5,
      'collaborator': 6
    };

    // Função auxiliar para validar hierarquia de roles
    const canAssignRole = (assignerRole: string, targetRole: string): boolean => {
      if (assignerRole === 'super_admin') return true;
      const assignerLevel = roleHierarchy[assignerRole] ?? 99;
      const targetLevel = roleHierarchy[targetRole] ?? 99;
      // Permite atribuir roles abaixo OU iguais ao seu (exceto super_admin que só super_admin pode criar)
      if (targetRole === 'super_admin') return false;
      return targetLevel >= assignerLevel;
    };

    switch (action) {
      case 'list': {
        // List all users with their profiles and roles
        let query = supabaseAdmin
          .from('profiles')
          .select(`
            id,
            name,
            email,
            avatar_url,
            company_id,
            created_at,
            job_title,
            state,
            employment_type,
            pin_hash
          `)
          .order('name');

        // If not super_admin, filter by company
        if (!isSuperAdmin && userCompanyId) {
          query = query.eq('company_id', userCompanyId);
        }

        const { data: profiles, error } = await query;

        if (error) {
          console.error('List profiles error:', error);
          throw error;
        }

        // Get roles for all users
        const { data: roles, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) {
          console.error('List roles error:', rolesError);
          throw rolesError;
        }

        // Fetch client contact user_ids to exclude from collaborators list
        const { data: clientContacts } = await supabaseAdmin
          .from('company_contacts')
          .select('user_id')
          .not('user_id', 'is', null);

        const clientUserIds = new Set((clientContacts || []).map((c: any) => c.user_id));

        // Combine profiles with roles and has_pin flag, excluding client contacts
        const usersWithRoles = profiles
          .filter((profile: any) => !clientUserIds.has(profile.id))
          .map(profile => ({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          company_id: profile.company_id,
          created_at: profile.created_at,
          job_title: profile.job_title,
          state: profile.state,
          employment_type: profile.employment_type || 'fixo',
          role: roles.find(r => r.user_id === profile.id)?.role || 'collaborator',
          has_pin: !!profile.pin_hash
        }));

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create': {
        const { email, password, name, role, companyId, job_title, avatar_url, state, employment_type } = payload;
        
        if (!email || !password || !name) {
          return new Response(JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Validar hierarquia de roles
        if (role && !canAssignRole(roleData.role, role)) {
          return new Response(JSON.stringify({ error: 'Você não pode atribuir um papel superior ou igual ao seu' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Determine which company to assign
        // super_admin can specify any company, others use their own
        const targetCompanyId = isSuperAdmin ? (companyId || null) : userCompanyId;

        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name }
        });

        if (authError) {
          console.error('Create user error:', authError);
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update profile with company_id, job_title and avatar_url
        const profileUpdate: Record<string, string | null> = {};
        if (targetCompanyId) profileUpdate.company_id = targetCompanyId;
        if (job_title) profileUpdate.job_title = job_title;
        if (avatar_url) profileUpdate.avatar_url = avatar_url;
        if (state) profileUpdate.state = state;
        if (employment_type === 'fixo' || employment_type === 'intermitente') profileUpdate.employment_type = employment_type;

        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('id', authData.user.id);

          if (profileError) {
            console.error('Update profile error:', profileError);
          }
        }

        // Update role if not collaborator
        if (role && role !== 'collaborator') {
          await supabaseAdmin
            .from('user_roles')
            .update({ role })
            .eq('user_id', authData.user.id);
        }

        console.log('User created:', authData.user.email, 'company:', targetCompanyId, 'job_title:', job_title, 'avatar_url:', avatar_url);

        // Send welcome email with credentials
        const loginUrl = payload.loginUrl || 'https://wees.lovable.app/login';
        try {
          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-welcome-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                email,
                name,
                password,
                loginUrl,
              }),
            }
          );

          if (!emailResponse.ok) {
            const emailError = await emailResponse.json();
            console.error('Failed to send welcome email:', emailError);
          } else {
            console.log('Welcome email sent to:', email);
          }
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Don't fail the user creation if email fails
        }

        return new Response(JSON.stringify({ 
          success: true, 
          user: { id: authData.user.id, email: authData.user.email, name, companyId: targetCompanyId } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-collaborator': {
        const { name, job_title, avatar_url, companyId, state, employment_type } = payload;
        
        if (!name) {
          return new Response(JSON.stringify({ error: 'Nome é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const targetCompanyId = companyId || userCompanyId || null;

        // Generate unique email and random password for disabled account
        const collaboratorId = crypto.randomUUID();
        const fakeEmail = `collaborator-${collaboratorId.slice(0, 8)}@internal.local`;
        const randomPassword = crypto.randomUUID() + crypto.randomUUID(); // Long random password they'll never know

        // Create auth user with random password (they can't log in)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: fakeEmail,
          password: randomPassword,
          email_confirm: true,
          user_metadata: { name, is_collaborator: true }
        });

        if (authError) {
          console.error('Create collaborator auth error:', authError);
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update profile with company_id, job_title and avatar_url
        const profileUpdate: Record<string, string | null> = {};
        if (targetCompanyId) profileUpdate.company_id = targetCompanyId;
        if (job_title) profileUpdate.job_title = job_title;
        if (avatar_url) profileUpdate.avatar_url = avatar_url;
        if (state) profileUpdate.state = state;
        if (employment_type === 'fixo' || employment_type === 'intermitente') profileUpdate.employment_type = employment_type;

        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('id', authData.user.id);

          if (profileError) {
            console.error('Update collaborator profile error:', profileError);
          }
        }

        // Role is already set to collaborator by default trigger

        console.log('Collaborator created:', name, 'id:', authData.user.id, 'company:', targetCompanyId);

        return new Response(JSON.stringify({ 
          success: true, 
          user: { id: authData.user.id, name, companyId: targetCompanyId } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        const { userId, name, role, companyId, job_title, avatar_url, state, employment_type } = payload;
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'ID do usuário é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Buscar o papel atual do usuário sendo editado
        const { data: currentUserRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        const currentRole = currentUserRole?.role || 'collaborator';

        // Só validar hierarquia se o papel estiver sendo ALTERADO
        if (role && role !== currentRole) {
          // Verificar se pode atribuir o novo papel
          if (!canAssignRole(roleData.role, role)) {
            return new Response(JSON.stringify({ 
              error: 'Você não pode atribuir um papel superior ou igual ao seu' 
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Verificar se pode alterar o papel de um usuário igual ou superior
          if (!canAssignRole(roleData.role, currentRole) && roleData.role !== 'super_admin') {
            return new Response(JSON.stringify({ 
              error: 'Você não pode alterar o papel de um usuário com papel igual ou superior ao seu' 
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Update profile
        const updateData: Record<string, string | null> = {};
        if (name) updateData.name = name;
        if (job_title !== undefined) updateData.job_title = job_title || null;
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url || null;
        if (state !== undefined) updateData.state = state || null;
        if (employment_type === 'fixo' || employment_type === 'intermitente') updateData.employment_type = employment_type;
        
        // Only super_admin can change company_id
        if (isSuperAdmin && companyId !== undefined) {
          updateData.company_id = companyId;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

          if (profileError) {
            console.error('Update profile error:', profileError);
            throw profileError;
          }
        }

        // Update role
        if (role) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId);

          if (roleError) {
            console.error('Update role error:', roleError);
            throw roleError;
          }
        }

        console.log('User updated:', userId, 'job_title:', job_title, 'avatar_url:', avatar_url);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset-password': {
        const { userId, newPassword } = payload;
        
        if (!userId || !newPassword) {
          return new Response(JSON.stringify({ error: 'ID do usuário e nova senha são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (newPassword.length < 6) {
          return new Response(JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (passwordError) {
          console.error('Reset password error:', passwordError);
          return new Response(JSON.stringify({ error: passwordError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Password reset for user:', userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        const { userId } = payload;
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'ID do usuário é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Prevent self-deletion
        if (userId === user.id) {
          return new Response(JSON.stringify({ error: 'Você não pode excluir sua própria conta' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Clean up related records that might block deletion
        await supabaseAdmin.from('app_client_errors').delete().eq('user_id', userId);
        console.log('Cleaned up app_client_errors for user:', userId);

        // Delete user from auth (cascades to profiles and user_roles)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
          console.error('Delete user error:', deleteError);
          // If user not found in auth, clean up orphaned DB records manually
          if ((deleteError as any)?.code === 'user_not_found' || deleteError.message?.includes('not found')) {
            console.log('User not found in auth, cleaning up orphaned records for:', userId);
            await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
            await supabaseAdmin.from('project_members').delete().eq('profile_id', userId);
            await supabaseAdmin.from('team_members').delete().eq('user_id', userId);
            await supabaseAdmin.from('site_responsibles').delete().eq('user_id', userId);
            await supabaseAdmin.from('profiles').delete().eq('id', userId);
            console.log('Orphaned records cleaned up for:', userId);
          } else {
            return new Response(JSON.stringify({ error: 'Database error deleting user' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        console.log('User deleted:', userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set-super-admin': {
        // Only existing super_admin can create another super_admin
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ error: 'Apenas super admins podem promover outros super admins' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { userId } = payload;
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'ID do usuário é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role: 'super_admin' })
          .eq('user_id', userId);

        if (roleError) {
          console.error('Set super_admin error:', roleError);
          throw roleError;
        }

        console.log('User promoted to super_admin:', userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set-user-pin': {
        // Only super_admin can set PIN for other users
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ 
            error: 'Apenas super admins podem definir PIN de outros usuários' 
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { userId, pin } = payload;
        
        if (!userId || !pin) {
          return new Response(JSON.stringify({ error: 'ID do usuário e PIN são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!/^\d{4}$/.test(pin)) {
          return new Response(JSON.stringify({ error: 'PIN deve ter exatamente 4 dígitos numéricos' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const pinHash = await hashPin(pin);

        const { error: pinError } = await supabaseAdmin
          .from('profiles')
          .update({ pin_hash: pinHash })
          .eq('id', userId);

        if (pinError) {
          console.error('Set user PIN error:', pinError);
          return new Response(JSON.stringify({ error: pinError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('PIN set for user:', userId, 'by super_admin:', user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'remove-user-pin': {
        // Only super_admin can remove PIN from other users
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ 
            error: 'Apenas super admins podem remover PIN de outros usuários' 
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { userId } = payload;
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'ID do usuário é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: removeError } = await supabaseAdmin
          .from('profiles')
          .update({ pin_hash: null })
          .eq('id', userId);

        if (removeError) {
          console.error('Remove user PIN error:', removeError);
          return new Response(JSON.stringify({ error: removeError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('PIN removed for user:', userId, 'by super_admin:', user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete-all-collaborators': {
        // Only super_admin can bulk delete collaborators
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ 
            error: 'Apenas Super Admins podem excluir colaboradores em massa' 
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log('Bulk delete record-only collaborators requested by:', user.id);

        // Build query to get all collaborators
        let collaboratorUserIds: string[] = [];

        if (isSuperAdmin) {
          // Super admin can delete all collaborators
          const { data: allCollabs } = await supabaseAdmin
            .from('user_roles')
            .select('user_id')
            .eq('role', 'collaborator');
          
          collaboratorUserIds = allCollabs?.map(c => c.user_id) || [];
        } else {
          // Non-super admin can only delete collaborators from their company
          // If userCompanyId is null, match collaborators with null company_id
          let companyUserIds: string[] = [];
          
          if (userCompanyId) {
            const { data: companyProfiles } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('company_id', userCompanyId);
            companyUserIds = companyProfiles?.map(p => p.id) || [];
            console.log('Found', companyUserIds.length, 'profiles with company_id:', userCompanyId);
          } else {
            // Match users with NULL company_id
            const { data: nullCompanyProfiles } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .is('company_id', null);
            companyUserIds = nullCompanyProfiles?.map(p => p.id) || [];
            console.log('Found', companyUserIds.length, 'profiles with NULL company_id');
          }
          
          if (companyUserIds.length > 0) {
            const { data: companyCollabs } = await supabaseAdmin
              .from('user_roles')
              .select('user_id')
              .eq('role', 'collaborator')
              .in('user_id', companyUserIds);
            
            collaboratorUserIds = companyCollabs?.map(c => c.user_id) || [];
          }
        }

        // Filter out self
        collaboratorUserIds = collaboratorUserIds.filter(id => id !== user.id);

        // Filter to only "record-only" collaborators (@internal.local)
        if (collaboratorUserIds.length > 0) {
          const { data: recordOnlyProfiles } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .in('id', collaboratorUserIds)
            .ilike('email', '%@internal.local');
          
          collaboratorUserIds = recordOnlyProfiles?.map(p => p.id) || [];
          console.log('Filtered to record-only collaborators:', collaboratorUserIds.length);
        }

        console.log('Found', collaboratorUserIds.length, 'record-only collaborators to delete');

        let deletedCount = 0;
        const errors: string[] = [];

        for (const collabId of collaboratorUserIds) {
          try {
            // Clean up related records that might block deletion
            await supabaseAdmin.from('app_client_errors').delete().eq('user_id', collabId);
            
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(collabId);
            if (deleteError) {
              console.error('Delete error for', collabId, ':', deleteError.message);
              errors.push(`${collabId}: ${deleteError.message}`);
            } else {
              deletedCount++;
            }
          } catch (err) {
            console.error('Delete exception for', collabId, ':', err);
            errors.push(`${collabId}: Erro interno`);
          }
        }

        console.log('Bulk delete completed:', deletedCount, 'deleted,', errors.length, 'errors');

        return new Response(JSON.stringify({ 
          success: true, 
          deletedCount,
          errors: errors.length > 0 ? errors : undefined
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list-user-sites': {
        if (!isSuperAdmin && !isAdmin) {
          return new Response(JSON.stringify({ error: 'Apenas super admin ou admin' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { userId } = payload;

        // Determine which table to read based on target user's role
        const { data: targetRoleRow } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        const targetRole = targetRoleRow?.role || 'collaborator';
        const table = targetRole === 'admin' ? 'portal_admin_access' : 'site_responsibles';

        const { data, error } = await supabaseAdmin
          .from(table)
          .select('site_id')
          .eq('user_id', userId);
        if (error) throw error;
        return new Response(JSON.stringify({ siteIds: (data || []).map((r: any) => r.site_id) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set-user-sites': {
        if (!isSuperAdmin && !isAdmin) {
          return new Response(JSON.stringify({ error: 'Apenas super admin ou admin' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { userId, siteIds } = payload as { userId: string; siteIds: string[] };
        if (!userId || !Array.isArray(siteIds)) {
          return new Response(JSON.stringify({ error: 'userId e siteIds são obrigatórios' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Determine which table to write based on target user's role
        const { data: targetRoleRow } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        const targetRole = targetRoleRow?.role || 'collaborator';
        const table = targetRole === 'admin' ? 'portal_admin_access' : 'site_responsibles';

        // Get current assignments
        const { data: current, error: curErr } = await supabaseAdmin
          .from(table)
          .select('site_id')
          .eq('user_id', userId);
        if (curErr) throw curErr;

        const currentIds = new Set((current || []).map((r: any) => r.site_id));
        const desiredIds = new Set(siteIds);

        const toAdd = [...desiredIds].filter(id => !currentIds.has(id));
        const toRemove = [...currentIds].filter(id => !desiredIds.has(id));

        if (toAdd.length > 0) {
          const rows = toAdd.map(site_id => ({ user_id: userId, site_id }));
          const { error: insErr } = await supabaseAdmin
            .from(table)
            .insert(rows);
          if (insErr) throw insErr;
        }

        if (toRemove.length > 0) {
          const { error: delErr } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('user_id', userId)
            .in('site_id', toRemove);
          if (delErr) throw delErr;
        }

        return new Response(JSON.stringify({
          success: true, added: toAdd.length, removed: toRemove.length, total: desiredIds.size, table,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'list-all-user-site-counts': {
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ counts: {} }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Sum unique sites from both tables (collaborator/super_admin via site_responsibles, admin via portal_admin_access)
        const [respRes, portalRes] = await Promise.all([
          supabaseAdmin.from('site_responsibles').select('user_id, site_id'),
          supabaseAdmin.from('portal_admin_access').select('user_id, site_id'),
        ]);
        if (respRes.error) throw respRes.error;
        if (portalRes.error) throw portalRes.error;

        const sitesByUser: Record<string, Set<string>> = {};
        const addSites = (data: any[]) => {
          data.forEach((r: any) => {
            if (!r.user_id || !r.site_id) return;
            if (!sitesByUser[r.user_id]) {
              sitesByUser[r.user_id] = new Set<string>();
            }
            sitesByUser[r.user_id].add(r.site_id);
          });
        };

        addSites(respRes.data || []);
        addSites(portalRes.data || []);

        const counts: Record<string, number> = {};
        for (const [userId, siteSet] of Object.entries(sitesByUser)) {
          counts[userId] = siteSet.size;
        }

        return new Response(JSON.stringify({ counts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação inválida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Admin users error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
