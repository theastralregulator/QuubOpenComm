import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, ChevronRight, FileText, MapPin, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';

interface WorkContractBannerProps {
  contractId: string;
}

export default function WorkContractBanner({ contractId }: WorkContractBannerProps) {
  const navigate = useNavigate();
  const [contract, setContract] = useState<any | null>(null);

  useEffect(() => {
    async function fetchBannerContract() {
      if (!contractId || !supabase) return;
      try {
        const { data } = await supabase
          .from('work_contracts')
          .select('id, work_title, final_price, payment_type, work_date, location, status')
          .eq('id', contractId)
          .single();
        if (data) setContract(data);
      } catch (err) {
        console.warn('Failed to load contract for banner:', err);
      }
    }
    fetchBannerContract();
  }, [contractId]);

  if (!contract) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-purple-500/10 border-b border-emerald-500/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-left">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-mono bg-emerald-500/20 px-2 py-0.5 rounded-md">
              Work Contract Confirmed
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
              {contract.work_title}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Price: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatINR(contract.final_price)}</strong> ({contract.payment_type})
            {contract.work_date && ` • Date: ${contract.work_date}`}
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate(`/work-contracts/${contract.id}`)}
        className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-extrabold flex items-center space-x-1 cursor-pointer shadow-xs transition-colors shrink-0"
      >
        <span>View Contract</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
