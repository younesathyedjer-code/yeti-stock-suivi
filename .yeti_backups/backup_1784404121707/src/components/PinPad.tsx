/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent } from '../types';
import { Eye, EyeOff, KeyRound, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';

interface PinPadProps {
  agentsCount: number;
  onLogin: (pin: string) => { success: boolean; error?: string };
  onRegisterFirstAdmin: (name: string, pin: string) => void;
}

export default function PinPad({ agentsCount, onLogin, onRegisterFirstAdmin }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For first admin registration
  const [regName, setRegName] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regPinConfirm, setRegPinConfirm] = useState('');

  const handleKeyPress = (char: string) => {
    setError(null);
    if (pin.length < 6) {
      setPin(prev => prev + char);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Veuillez saisir votre code PIN.');
      return;
    }
    const res = onLogin(pin);
    if (!res.success) {
      setError(res.error || 'Code PIN invalide.');
      setPin('');
    }
  };

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim()) {
      setError('Veuillez saisir le nom de l\'administrateur.');
      return;
    }
    if (regPin.length < 4) {
      setError('Le code PIN doit comporter au moins 4 chiffres.');
      return;
    }
    if (regPin !== regPinConfirm) {
      setError('Les codes PIN ne correspondent pas.');
      return;
    }
    try {
      await onRegisterFirstAdmin(regName.trim(), regPin);
    } catch (err: any) {
      console.error('Registration error:', err);
      let errMsg = "Échec de l'enregistrement.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            errMsg += ` (${parsed.error})`;
          } else {
            errMsg += ` (${err.message})`;
          }
        } catch {
          errMsg += ` (${err.message})`;
        }
      } else {
        errMsg += ` (${String(err)})`;
      }
      setError(errMsg);
    }
  };

  // If there are no agents configured, guide registration of first Admin
  if (agentsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden transform transition-all">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 py-8 px-6 text-center text-white relative">
            <div className="absolute top-3 right-3 bg-white/10 text-white/90 text-xs px-2.5 py-1 rounded-full font-medium backdrop-blur-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" /> Initialisation
            </div>
            <KeyRound className="w-12 h-12 mx-auto mb-3 text-emerald-100" />
            <h2 className="text-2xl font-semibold tracking-tight">Premier Lancement</h2>
            <p className="text-emerald-100 text-sm mt-1">Créez le compte du premier Administrateur</p>
          </div>

          <form onSubmit={handleRegisterAdmin} className="p-8 space-y-5">
            {error && (
              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-3.5 rounded-r-xl flex items-start gap-2.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nom Complet</label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ex : Jean Dupont"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-gray-800 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Code PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={regPin}
                  onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Code de connexion"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-center font-mono font-semibold tracking-widest text-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-gray-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmer PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={regPinConfirm}
                  onChange={(e) => setRegPinConfirm(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ressaisir PIN"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-center font-mono font-semibold tracking-widest text-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-gray-800"
                />
              </div>
            </div>

            <p className="text-slate-400 text-xs text-center leading-relaxed">
              Ce code PIN unique vous permettra d'accéder au système complet de gestion et d'attribuer des accès à vos opérateurs.
            </p>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-3 rounded-xl shadow-lg shadow-emerald-600/15 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <UserCheck className="w-4 h-4" /> Activer l'accès Administrateur
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden transform transition-all">
        <div className="bg-slate-900 py-8 px-6 text-center text-white relative">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <KeyRound className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-sans">Identification Terminal</h2>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">Veuillez saisir votre code d'accès personnel</p>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 rounded-r-xl text-center text-xs font-semibold">
              {error}
            </div>
          )}

          {/* PIN input visualization */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-full max-w-[240px] flex items-center justify-center">
              <input
                type={showPin ? 'text' : 'password'}
                readOnly
                value={pin}
                placeholder="••••••"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 tracking-widest text-center py-3 px-8 rounded-2xl font-mono text-2xl font-bold outline-none select-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Virtual Industrial Keyboard */}
          <div className="grid grid-cols-3 gap-3.5 max-w-[280px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(char => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="h-14 w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-sans font-semibold text-xl rounded-2xl border border-slate-100 shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                {char}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 w-full bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 font-sans font-semibold text-sm rounded-2xl border border-red-100/50 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-sans font-semibold text-xl rounded-2xl border border-slate-100 shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 w-full bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 font-sans font-semibold text-sm rounded-2xl border border-amber-100/50 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              Corriger
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-5 py-3 rounded-2xl font-semibold text-white shadow-lg shadow-emerald-500/10 cursor-pointer transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed text-center"
          >
            Se Connecter
          </button>
        </div>
      </div>
    </div>
  );
}
