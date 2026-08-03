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

      // Query admin_members using id = session.user.id (standardized primary key)
      const { data: member, error } = await supabase
        .from('admin_members')
        .select('id, email, role, is_active')
        .eq('id', session.user.id)
        .maybeSingle();

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
            id: member.id,
            email: member.email || session.user.email || '',
            role: normalizedRole as any,
            is_active: member.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
