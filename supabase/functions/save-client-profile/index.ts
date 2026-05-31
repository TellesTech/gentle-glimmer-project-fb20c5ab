import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { 
      email,
      name,
      company,
      role,
      signature_data,
    } = await req.json();
    
    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Email and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Saving client profile for email:', email);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    let profile;
    let error;

    if (existingProfile) {
      // Update existing profile
      const result = await supabase
        .from('client_profiles')
        .update({
          name: name.trim(),
          company: company?.trim() || null,
          role: role?.trim() || null,
          signature_data: signature_data || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
        .select()
        .single();
      
      profile = result.data;
      error = result.error;
      console.log('Updated existing profile:', existingProfile.id);
    } else {
      // Insert new profile
      const result = await supabase
        .from('client_profiles')
        .insert({
          email: email.toLowerCase().trim(),
          name: name.trim(),
          company: company?.trim() || null,
          role: role?.trim() || null,
          signature_data: signature_data || null,
        })
        .select()
        .single();
      
      profile = result.data;
      error = result.error;
      console.log('Created new profile');
    }

    if (error) {
      console.error('Error saving profile:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile saved successfully:', profile.id);

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          company: profile.company,
          role: profile.role,
          signature_data: profile.signature_data,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-client-profile:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});