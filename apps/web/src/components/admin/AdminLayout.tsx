import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, Users, User, Briefcase, Building2, 
  CheckCircle, AlertOctagon, MessageSquare, LifeBuoy, FileText, 
  Megaphone, Settings, ShieldAlert, Activity, Search, Bell, 
  Menu, X, LogOut, ExternalLink, ShieldCheck
} from 'lucide-react';
import { useAdminSession } from '../../hooks/useAdminSession';
import { supabase } from '../../lib/supabase';

const ADMIN_NAVIGATION = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Workers', path: '/admin/workers', icon: User },
  { name: 'Jobs', path: '/admin/jobs', icon: Briefcase },
  { name: 'Companies', path: '/admin/companies', icon: Building2 },
  { name: 'Verifications', path: '/admin/verifications', icon: CheckCircle },
  { name: 'Reports', path: '/admin/reports', icon: AlertOctagon },
  { name: 'Message Moderation', path: '/admin/messages', icon: MessageSquare },
  { name: 'Support', path: '/admin/support', icon: LifeBuoy },
  { name: 'Content', path: '/admin/content', icon: FileText },
  { name: 'Announcements', path: '/admin/announcements', icon: Megaphone },
  { name: 'Site Settings', path: '/admin/settings', icon: Settings },
  { name: 'Admin Management', path: '/admin/admins', icon: ShieldAlert, requiresSuperAdmin: true },
  { name: 'Audit Logs', path: '/admin/audit-logs', icon: Activity, requiresSuperAdmin: true },
];

export default function AdminLayout() {
  const { adminUser, isAdminLoading, hasPermission } = useAdminSession();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If loading, show secure loading state
  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <ShieldCheck className="w-12 h-12 text-indigo-500 animate-pulse mb-4" />
        <h2 className="text-slate-900 dark:text-white font-bold text-lg">Authenticating Admin Session</h2>
        <p className="text-slate-500 text-sm mt-2">Verifying credentials and permissions...</p>
      </div>
    );
  }

  // If not admin, this shouldn't render (should be caught by route guard, but just in case)
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <AlertOctagon className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-slate-900 dark:text-white font-bold text-lg">Access Denied</h2>
        <p className="text-slate-500 text-sm mt-2">You do not have permission to access the control center.</p>
        <button onClick={() => navigate('/')} className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Return to Home</button>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col md:flex-row font-sans">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-black text-slate-900 dark:text-white">Admin Control</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* SIDEBAR */}
      <AnimatePresence>
        {(mobileMenuOpen || window.innerWidth >= 768) && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col ${
              mobileMenuOpen ? 'block' : 'hidden md:flex'
            } md:relative`}
          >
            <div className="p-6 hidden md:flex items-center space-x-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-none">OpenComm</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Control Center</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {ADMIN_NAVIGATION.map((item) => {
                if (item.requiresSuperAdmin && adminUser.role !== 'super_admin') return null;
                
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    end={item.exact}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        isActive 
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' 
                          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-zinc-800">
              <div className="mb-4 px-2">
                <p className="text-xs text-slate-500 mb-1">Logged in as</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{adminUser.email}</p>
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 mt-1">
                  {adminUser.role.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors mb-1"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Return to OpenComm</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TOPBAR */}
        <header className="hidden md:flex h-16 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 items-center justify-between px-8 shrink-0 z-10">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Global admin search (User ID, Email, Username, Report ID...)"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>
          <div className="flex items-center space-x-6 ml-8">
            <button className="relative text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-zinc-900 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center space-x-3 pl-6 border-l border-slate-200 dark:border-zinc-800">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{adminUser.email.split('@')[0]}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{adminUser.role.replace('_', ' ')}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold uppercase">
                {adminUser.email.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

    </div>
  );
}
