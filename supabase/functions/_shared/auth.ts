import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1'

export async function verifyAdminSession(req: Request, requiredRoles: string[] = ['admin', 'super_admin']) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('No authorization header')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  
  // Create a service client for admin overrides
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
  
  // Validate the JWT
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  
  if (authError || !user) {
    throw new Error('Invalid token')
  }

  // Check admin_members table
  const { data: adminMember, error: memberError } = await supabaseAdmin
    .from('admin_members')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
    
  if (memberError || !adminMember || !adminMember.is_active) {
    throw new Error('Not authorized as active admin')
  }
  
  if (!requiredRoles.includes(adminMember.role) && !requiredRoles.includes('any')) {
    throw new Error('Insufficient permissions')
  }

  return { user, adminMember, supabaseAdmin }
}

export async function logAdminAction(
  supabaseAdmin: any,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  reason: string = '',
  previousData: any = null,
  newData: any = null
) {
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason,
    previous_data: previousData,
    new_data: newData
  })
}
