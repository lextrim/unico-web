import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Lock, Mail, AlertTriangle } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Credenciales incorrectas');
      setLoading(false);
    }
    // ⚡ SOLUCIÓN: Si no hay error, no hacemos nada más.
    // La app detectará el cambio y te meterá al Menú de forma automática y suave.
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 w-full overflow-hidden normal-case">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#c80000] flex items-center justify-center text-white font-bold text-2xl mb-3">U</div>
          <div className="text-white font-bold text-xl leading-none">ÚNICO</div>
          <div className="text-slate-500 text-sm mt-1.5">Acceso al taller</div>
        </div>

        <div className="w-full bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800">

          {error && (
            <div className="bg-red-900/50 border border-red-500 p-4 rounded-2xl mb-6 flex items-center gap-3">
              <AlertTriangle className="text-red-500 shrink-0" size={22} />
              <p className="text-white text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-slate-400 text-[13px] font-medium mb-2 pl-2">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="off"
                  className="w-full bg-slate-950 placeholder:text-slate-600 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  style={{ textTransform: 'none', WebkitBoxShadow: '0 0 0px 1000px #020617 inset', WebkitTextFillColor: '#ffffff' }}
                  placeholder="usuario@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-[13px] font-medium mb-2 pl-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoCapitalize="none"
                  className="w-full bg-slate-950 placeholder:text-slate-600 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  style={{ textTransform: 'none', WebkitBoxShadow: '0 0 0px 1000px #020617 inset', WebkitTextFillColor: '#ffffff' }}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl mt-4 active:scale-95 transition-all flex justify-center items-center"
            >
              {loading ? 'Cargando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
