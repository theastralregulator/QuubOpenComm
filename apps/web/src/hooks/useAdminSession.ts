import { useState, useEffect } from 'react';
import { supabase, AdminMember } from '../lib/supabase';

export function useAdminSession() {
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminMember | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminStatus() {
      setIsAdminLoading(true);
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        if (isMounted) {
          setAdminUser(null);
          setIsAdminLoading(false);
        }
        return;
      }

      // Query admin_members matching id OR user_id with session.user.id
      // Select only existing columns to prevent errors on legacy table schemas
      const { data: members, error } = await supabase
        .from('admin_members')
        .select('id, user_id, role, is_active, created_at, updated_at')
        .or(`id.eq.${session.user.id},user_id.eq.${session.user.id}`)
        .limit(1);

      const member = members && members.length > 0 ? members[0] : null;

      if (isMounted) {
        if (error || !member || !member.is_active) {
          if (error) {
            console.error('[AdminSession] Error querying admin_members:', error);
          }
          setAdminUser(null);
        } else {
          // Normalize legacy content_admin to moderator role for canonical checks
          const normalizedRole = member.role === 'content_admin' ? 'moderator' : member.role;

          const adminData: AdminMember = {
            id: member.id || member.user_id || session.user.id,
            email: session.user.email || '',
            role: normalizedRole as any,
            is_active: member.is_active,
            created_at: member.created_at || new Date().toISOString(),
            updated_at: member.updated_at || new Date().toISOString()
          };

          setAdminUser(adminData);
        }
        setIsAdminLoading(false);
      }
    }

    checkAdminStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (isMounted) setAdminUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkAdminStatus();
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (requiredRoles: string[]) => {
    if (!adminUser || !adminUser.is_active) return false;
    if (adminUser.role === 'super_admin') return true;
    return requiredRoles.includes(adminUser.role) || requiredRoles.includes('any');
  };

  return {
    adminUser,
    isAdminLoading,
    hasPermission,
    requireSupport: () => hasPermission(['support', 'moderator', 'admin', 'super_admin']),
    requireModerator: () => hasPermission(['moderator', 'admin', 'super_admin']),
    requireAdmin: () => hasPermission(['admin', 'super_admin']),
    requireSuperAdmin: () => hasPermission(['super_admin']),
  };
}
