import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { ArrowLeft, LogIn, LogOut, Monitor, Smartphone, RefreshCw } from 'lucide-react';

interface ActivityLog {
  id: string;
  user_email: string;
  event: 'login' | 'logout';
  details: { platform?: string; user_agent?: string };
  created_at: string;
}

const ActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'login' | 'logout'>('all');

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('unico_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data as ActivityLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.event === filter);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
      + ' · '
      + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Agrupar por usuario: último login y total de sesiones
  const stats = logs.reduce<Record<string, { logins: number; lastLogin: string | null }>>((acc, l) => {
    if (!acc[l.user_email]) acc[l.user_email] = { logins: 0, lastLogin: null };
    if (l.event === 'login') {
      acc[l.user_email].logins++;
      if (!acc[l.user_email].lastLogin || l.created_at > acc[l.user_email].lastLogin!)
        acc[l.user_email].lastLogin = l.created_at;
    }
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/menu')}
          className="p-2 rounded-xl bg-slate-800 active:scale-90 transition-all"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <h1 className="text-white font-black uppercase tracking-widest text-sm flex-1">Actividad de Usuarios</h1>
        <button
          onClick={fetchLogs}
          className="p-2 rounded-xl bg-slate-800 active:scale-90 transition-all"
        >
          <RefreshCw size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-xl mx-auto w-full">

        {/* Stats por usuario */}
        {Object.keys(stats).length > 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-3">Resumen de usuarios</p>
            <div className="space-y-2">
              {Object.entries(stats).map(([email, s]) => (
                <div key={email} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-xs truncate">{email}</p>
                    {s.lastLogin && (
                      <p className="text-slate-500 text-[10px]">Último acceso: {formatDate(s.lastLogin)}</p>
                    )}
                  </div>
                  <div className="bg-blue-900/40 px-3 py-1 rounded-xl shrink-0">
                    <span className="text-blue-400 font-black text-xs">{s.logins} accesos</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2">
          {(['all', 'login', 'logout'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-500 border border-slate-800'
              }`}
            >
              {f === 'all' ? 'Todo' : f === 'login' ? 'Entradas' : 'Salidas'}
            </button>
          ))}
        </div>

        {/* Lista de eventos */}
        {loading ? (
          <div className="text-center text-slate-500 font-black uppercase text-xs tracking-widest py-12">
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-600 font-black uppercase text-xs tracking-widest py-12">
            Sin registros
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => (
              <div
                key={log.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3"
              >
                <div className={`p-2 rounded-xl shrink-0 ${log.event === 'login' ? 'bg-emerald-900/40' : 'bg-red-900/40'}`}>
                  {log.event === 'login'
                    ? <LogIn size={16} className="text-emerald-400" />
                    : <LogOut size={16} className="text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{log.user_email}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">{formatDate(log.created_at)}</p>
                </div>
                <div className="shrink-0">
                  {log.details?.platform === 'apk'
                    ? <Smartphone size={14} className="text-slate-500" />
                    : <Monitor size={14} className="text-slate-500" />
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityScreen;
