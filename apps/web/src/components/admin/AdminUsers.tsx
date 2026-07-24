import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';
import { ShieldCheck, MoreVertical, Search, ShieldAlert, Trash2, UserX } from 'lucide-react';

export default function AdminUsers() {
  const { adminUser, hasPermission } = useAdminSession();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
      
    // Fetch all admins
    const { data: admins, error: adminError } = await supabase
      .from('admin_members')
      .select('id, role, is_active');
      
    if (profiles) {
      // Merge admin roles into profiles
      const mergedUsers = profiles.map(profile => {
        const adminData = admins?.find(a => a.id === profile.id);
        return {
          ...profile,
          admin_members: adminData || null
        };
      });
      setUsers(mergedUsers);
    }
    setIsLoading(false);
  }

  const handleAction = async (userId: string, action: string) => {
    if (!hasPermission(['super_admin']) && action === 'promote') {
      alert('Only Super Admins can promote users');
      return;
    }

    if (!confirm(\`Are you sure you want to perform \${action} on user \${userId}?\`)) return;

    // Call edge function for sensitive operations
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
      const res = await fetch(\`\${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/admin-user-action\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${session?.access_token}\`
        },
        body: JSON.stringify({
          action,
          targetId: userId,
          reason: 'Manual admin action from dashboard'
        })
      });
      
      const result = await res.json();
      if (result.success) {
        alert('Action successful');
        loadUsers();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (e: any) {
      alert('Failed to execute action: ' + e.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.id.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Manage all registered accounts, roles, and access.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-zinc-950/50 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">User</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Role</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Joined</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const adminData = user.admin_members?.[0] || user.admin_members; // Handle one-to-one join
                  const role = adminData?.role || 'user';
                  const isSuperAdmin = role === 'super_admin';
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold">
                            {user.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{user.full_name || 'No Name'}</p>
                            <p className="text-xs text-slate-500">@{user.username || user.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {role !== 'user' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                            {isSuperAdmin && <ShieldAlert className="w-3 h-3 mr-1" />}
                            {!isSuperAdmin && <ShieldCheck className="w-3 h-3 mr-1" />}
                            {role.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Standard</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={\`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider \${
                          user.account_status === 'active' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                        }\`}>
                          {user.account_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {hasPermission(['super_admin']) && role === 'user' && (
                            <button onClick={() => handleAction(user.id, 'promote_to_admin')} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Promote to Admin">
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission(['admin', 'super_admin']) && user.account_status === 'active' && !isSuperAdmin && (
                            <button onClick={() => handleAction(user.id, 'suspend')} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors" title="Suspend Account">
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission(['super_admin']) && !isSuperAdmin && (
                            <button onClick={() => handleAction(user.id, 'delete')} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete Account">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
