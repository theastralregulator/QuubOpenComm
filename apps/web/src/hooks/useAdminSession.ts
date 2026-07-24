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

      // Query admin_members using RLS (which checks if they are admin anyway, or via standard policy)
      const { data: member, error } = await supabase
        .from('admin_members')
        .select('*')
        .eq('id', session.user.id)
        .eq('is_active', true)
        .single();

      if (isMounted) {
        if (error || !member) {
          setAdminUser(null);
        } else {
          setAdminUser(member as AdminMember);
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
    return requiredRoles.includes(adminUser.role) || requiredRoles.includes('any');
  };

  return {
    adminUser,
    isAdminLoading,
    hasPermission,
    requireStaff: () => hasPermission(['any']),
    requireModerator: () => hasPermission(['moderator', 'admin', 'super_admin']),
    requireAdmin: () => hasPermission(['admin', 'super_admin']),
    requireSuperAdmin: () => hasPermission(['super_admin']),
  };
}
