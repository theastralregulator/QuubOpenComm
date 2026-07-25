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

      // Query admin_members
      console.log('Admin Auth Check -> Current user:', session.user);
      console.log('Admin Auth Check -> Current user.id:', session.user.id);
      
      const { data: member, error } = await supabase
        .from('admin_members')
        .select('role, is_active')
        .eq('user_id', session.user.id)
        .single();

      console.log('Admin Auth Check -> admin_members query result:', member);
      console.log('Admin Auth Check -> error state:', error);

      if (isMounted) {
        if (error || !member) {
          if (error) {
            console.error('Admin Auth Check -> PostgREST Error:', error);
          }
          setAdminUser(null);
          console.log('Admin Auth Check -> final role: null');
          console.log('Admin Auth Check -> final isAdmin boolean: false');
        } else {
          setAdminUser(member as AdminMember);
          console.log('Admin Auth Check -> final role:', member.role);
          console.log('Admin Auth Check -> final isAdmin boolean:', member.is_active);
        }
        setIsAdminLoading(false);
        console.log('Admin Auth Check -> loading state: false');
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
