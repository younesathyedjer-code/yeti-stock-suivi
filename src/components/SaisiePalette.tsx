/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Gamme, Palette, PaletteEntry } from '../types';
import { 
  Sun, Moon, Box, Layers, Plus, Check, ShieldCheck, 
  Trash2, Landmark, AlertCircle, RefreshCw, Sparkles, Edit2
} from 'lucide-react';

interface SaisiePaletteProps {
  key?: string;
  gammes: Gamme[];
  palettes: Palette[];
  currentSeqNum: number;
  onAddMono: (gammeId: string, gammeName: string, perfume: string, qty: number, shift: 'jour' | 'nuit') => void;
  onAddMixte: (gammeId: string, gammeName: string, entries: { perfume: string; qty: number; shift: 'jour' | 'nuit' }[]) => void;
  onDeletePalette: (id: string) => void;
  onUpdatePalette: (
    id: string,
    gammeId: string,
    gammeName: string,
    type: 'mono' | 'mixte',
    entries: PaletteEntry[],
    lastUpdatedShift: 'jour' | 'nuit'
  ) => void;
  agentName: string;
}

export default function SaisiePalette({
  gammes,
  palettes,
  currentSeqNum,
  onAddMono,
  onAddMixte,
  onDeletePalette,
  onUpdatePalette,
  agentName
}: SaisiePaletteProps) {
  const [selectedGammeId, setSelectedGammeId] = useState<string>('');
  const [activeShift, setActiveShift] = useState<'jour' | 'nuit'>('jour');
  
  // Per-product mono quantities state
  const [monoQuantities, setMonoQuantities] = useState<Record<string, number>>({});

  // Mixed palette building state
  const [isMixedMode, setIsMixedMode] = useState<boolean>(false);
  const [mixedEntries, setMixedEntries] = useState<{ perfume: string; qty: number; shift: 'jour' | 'nuit' }[]>([]);
  const [currentPerfumeForInput, setCurrentPerfumeForInput] = useState<string | null>(null);
  const [mixedQtyInput, setMixedQtyInput] = useState<string>('100');

  // Status/Toast messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States of editing palette
  const [editingPalette, setEditingPalette] = useState<Palette | null>(null);
  const [editGammeId, setEditGammeId] = useState<string>('');
  const [editEntries, setEditEntries] = useState<PaletteEntry[]>([]);
  const [editShift, setEditShift] = useState<'jour' | 'nuit'>('jour');

  const activeGamme = gammes.find(g => g.id === selectedGammeId);

  // Manage per-product quantities neatly
  const getProductQty = (g: Gamme) => {
    return monoQuantities[g.id] !== undefined ? monoQuantities[g.id] : (g.standardQuantity ?? 100);
  };
  const setProductQty = (gId: string, val: number) => {
    setMonoQuantities(prev => ({ ...prev, [gId]: val }));
  };

  // Auto-cancel mixed mode if active product gets deleted unexpectedly in nomenclatures
  React.useEffect(() => {
    if (selectedGammeId && !gammes.some(g => g.id === selectedGammeId)) {
      handleCancelMixedPalette();
    }
  }, [gammes, selectedGammeId]);

  const playSuccessSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = frequency;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      // Clear, professional ascending dual-tone chime
      playTone(659.25, now, 0.12);
      playTone(880.00, now + 0.08, 0.25);
    } catch (err) {
      console.warn("Could not play entry chime:", err);
    }
  };

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    playSuccessSound();
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const triggerErrorMsg = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  // 1. Click standard mono-perfume palette creation handles any product's click directly
  const handlePerfumeClickMono = (gId: string, gName: string, perfume: string, qty: number) => {
    try {
      onAddMono(gId, gName, perfume, qty, activeShift);
      triggerSuccessMsg(`Palette Mono N°${currentSeqNum < 10 ? '0' + currentSeqNum : currentSeqNum} : ${perfume} (${qty} u.) enregistrée !`);
    } catch (e: any) {
      triggerErrorMsg(e.message || "Erreur lors de la création.");
    }
  };

  // 2. Start mixed palette entry
  const startMixedPaletteEntryEx = (perfume: string) => {
    setCurrentPerfumeForInput(perfume);
    setMixedQtyInput(activeGamme ? (activeGamme.standardQuantity ?? 100).toString() : '100');
  };

  const saveMixedPerfumeQuantity = () => {
    if (!currentPerfumeForInput) return;
    const qty = parseInt(mixedQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      triggerErrorMsg("La quantité doit être supérieure à 0.");
      return;
    }
    setMixedEntries(prev => [...prev, {
      perfume: currentPerfumeForInput,
      qty,
      shift: activeShift
    }]);
    setCurrentPerfumeForInput(null);
  };

  const handleValidateMixedPalette = () => {
    if (!activeGamme) return;
    if (mixedEntries.length === 0) {
      triggerErrorMsg("Veuillez ajouter au moins un parfum.");
      return;
    }
    try {
      onAddMixte(activeGamme.id, activeGamme.name, mixedEntries);
      triggerSuccessMsg(`Palette Mixte N°${currentSeqNum < 10 ? '0' + currentSeqNum : currentSeqNum} créée avec succès !`);
      setMixedEntries([]);
      setIsMixedMode(false);
    } catch (e: any) {
      triggerErrorMsg(e.message || "Erreur.");
    }
  };

  const handleCancelMixedPalette = () => {
    setMixedEntries([]);
    setCurrentPerfumeForInput(null);
    setIsMixedMode(false);
    setSelectedGammeId('');
  };

  // --- Actions de modification d'une palette saisie ---
  const handleOpenEditPalette = (p: Palette) => {
    setEditingPalette(p);
    setEditGammeId(p.gammeId);
    setEditEntries(p.entries.map(e => ({ ...e })));
    setEditShift(p.lastUpdatedShift);
  };

  const handleUpdateEditEntryQty = (perfume: string, shift: 'jour' | 'nuit', value: number) => {
    setEditEntries(prev => {
      const existingIdx = prev.findIndex(e => e.perfume === perfume);
      if (existingIdx !== -1) {
        const updated = prev.map((e, idx) => {
          if (idx === existingIdx) {
            return {
              ...e,
              quantityDay: shift === 'jour' ? Math.max(0, value) : e.quantityDay,
              quantityNight: shift === 'nuit' ? Math.max(0, value) : e.quantityNight,
            };
          }
          return e;
        });
        return updated;
      } else {
        return [...prev, {
          perfume,
          quantityDay: shift === 'jour' ? Math.max(0, value) : 0,
          quantityNight: shift === 'nuit' ? Math.max(0, value) : 0,
        }];
      }
    });
  };

  const handleSaveEditedPalette = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPalette) return;

    const targetGamme = gammes.find(g => g.id === editGammeId);
    if (!targetGamme) {
      triggerErrorMsg("Gamme introuvable.");
      return;
    }

    // Filter valid entries only
    const validEntries = editEntries
      .filter(entry => targetGamme.perfumes.includes(entry.perfume))
      .filter(entry => entry.quantityDay > 0 || entry.quantityNight > 0);

    if (validEntries.length === 0) {
      triggerErrorMsg("Veuillez saisir une quantité supérieure à 0 pour au moins un parfum.");
      return;
    }

    const calculatedType = validEntries.length > 1 ? 'mixte' : 'mono';

    try {
      onUpdatePalette(
        editingPalette.id,
        targetGamme.id,
        targetGamme.name,
        calculatedType,
        validEntries,
        editShift
      );
      triggerSuccessMsg(`Palette N°${editingPalette.numberCode} mise à jour avec succès !`);
      setEditingPalette(null);
    } catch (err: any) {
      triggerErrorMsg(err.message || "Erreur lors de la mise à jour.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header info */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2" id="saisie-palette-title">
            <Box className="w-5.5 h-5.5 text-emerald-600" /> Saisie de Palettes
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Enregistrement et étiquetage rapide de la production</p>
        </div>

        {/* Global Saisie State: Shift Selection and default standard size */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Shift selection */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200" id="saisie-shift-selector">
            <button
              type="button"
              onClick={() => setActiveShift('jour')}
              className={`px-3.5 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeShift === 'jour' 
                  ? 'bg-white text-amber-600 shadow-xs ring-1 ring-black/5' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Shift Jour
            </button>
            <button
              type="button"
              onClick={() => setActiveShift('nuit')}
              className={`px-3.5 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeShift === 'nuit' 
                  ? 'bg-slate-900 text-purple-400 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Shift Nuit
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500 text-white font-medium p-4 rounded-xl flex items-center gap-2 text-xs shadow-md animate-fade-in" id="saisie-success-toast">
          <ShieldCheck className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-100 border-l-4 border-rose-500 text-rose-800 p-4 rounded-r-xl flex items-center gap-2 text-xs shadow-xs animate-fade-in" id="saisie-error-toast">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Gamme select buttons (or warning if none) */}
      {gammes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center flex flex-col items-center gap-3" id="saisie-warning-no-gammes">
          <Layers className="w-10 h-10 text-amber-500" />
          <h3 className="font-semibold text-amber-900 text-sm">Aucune gamme configurée</h3>
          <p className="text-amber-700/80 text-xs max-w-sm leading-relaxed">
            Demandez à un administrateur d'ajouter des gammes de produits et des parfums dans la configuration pour démarrer la saisie.
          </p>
        </div>
      ) : (
        <div className="space-y-8" id="saisie-gammes-grid-container">
          {gammes.map(g => {
            const isCurrentMixed = isMixedMode && selectedGammeId === g.id;
            const isOtherMixed = isMixedMode && selectedGammeId !== g.id;
            const currentQty = getProductQty(g);

            return (
              <div 
                key={g.id} 
                id={`saisie-gamme-card-${g.id}`}
                className={`bg-white rounded-2xl p-6 border transition-all duration-300 relative ${
                  isCurrentMixed 
                    ? 'ring-2 ring-emerald-500 border-transparent shadow-md' 
                    : isOtherMixed 
                      ? 'opacity-40 border-slate-100 pointer-events-none' 
                      : 'border-slate-100 shadow-xs hover:shadow-xs hover:border-slate-205'
                }`}
              >
                {/* Product header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200/50 pb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                      <Box className="w-5 h-5 animate-pulse-slow" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        {g.name}
                      </h3>
                      <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold font-mono">{g.perfumes.length} Parfums</span>
                        <span>•</span>
                        <span>Standard : {g.standardQuantity ?? 100} u.</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:justify-end">
                    {/* Mono quantity selector specific to this product */}
                    {!isCurrentMixed && !isOtherMixed && (
                      <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl gap-2">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Quantité Mono :</span>
                        <input
                          type="number"
                          min={1}
                          value={currentQty}
                          onChange={(e) => setProductQty(g.id, Math.max(1, parseInt(e.target.value, 10) || 0))}
                          className="w-14 bg-white border border-slate-250 rounded-lg py-1 text-center font-bold font-mono text-xs text-slate-850 outline-none"
                        />
                        {(g.standardQuantity ?? 100) !== currentQty && (
                          <button
                            type="button"
                            onClick={() => setProductQty(g.id, g.standardQuantity ?? 100)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-200 uppercase cursor-pointer transition-colors"
                          >
                            Std
                          </button>
                        )}
                      </div>
                    )}

                    {/* Mixed Mode Toggle */}
                    {!isOtherMixed && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrentMixed) {
                            handleCancelMixedPalette();
                          } else {
                            setSelectedGammeId(g.id);
                            setIsMixedMode(true);
                            setMixedEntries([]);
                            setCurrentPerfumeForInput(null);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                          isCurrentMixed
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-2xs'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
                        }`}
                      >
                        {isCurrentMixed ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" /> Mode Mono
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Palette Mixte
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mixed Mode composer workflow inside the active product container */}
                {isCurrentMixed && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 animate-fade-in mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-amber-500 animate-bounce" /> Palette Mixte N°{currentSeqNum < 10 ? '0' + currentSeqNum : currentSeqNum} en cours de composition
                      </span>
                      {mixedEntries.length > 0 && (
                        <span className="text-xs font-bold font-mono px-2.5 py-1 bg-amber-200/50 text-amber-800 rounded-lg animate-pulse">
                          Total : {mixedEntries.reduce((sum, e) => sum + e.qty, 0)} u.
                        </span>
                      )}
                    </div>

                    {mixedEntries.length === 0 ? (
                      <p className="text-slate-400 text-xs italic pl-1">Aucun parfum sélectionné pour le moment. Cliquez sur un parfum ci-dessous.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {mixedEntries.map((entry, index) => (
                          <div 
                            key={index} 
                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium shadow-2xs text-slate-800"
                          >
                            <span className="text-slate-755">{entry.perfume}</span>
                            <span className="font-mono bg-slate-105 text-emerald-800 px-1.5 rounded font-bold">
                              {entry.qty} u ({entry.shift === 'jour' ? 'Jour' : 'Nuit'})
                            </span>
                            <button
                              type="button"
                              onClick={() => setMixedEntries(prev => prev.filter((_, i) => i !== index))}
                              className="text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5 font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {currentPerfumeForInput && (
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in text-slate-800">
                        <div className="text-xs">
                          <span className="text-slate-500 font-semibold uppercase tracking-wider block">Parfum sélectionné :</span>
                          <span className="text-slate-800 font-bold block mt-0.5">{currentPerfumeForInput}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-xs font-semibold text-slate-605 flex-shrink-0">Quantité ({activeShift === 'jour' ? 'Jour' : 'Nuit'}) :</span>
                          
                          <div className="flex gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setMixedQtyInput((g.standardQuantity ?? 100).toString())}
                              className={`px-2 py-1 border text-[10px] font-extrabold rounded bg-emerald-50 border-emerald-200 text-emerald-800 cursor-pointer ${
                                mixedQtyInput === (g.standardQuantity ?? 100).toString() ? 'bg-emerald-600! text-white!' : ''
                              }`}
                            >
                              Std ({g.standardQuantity ?? 100})
                            </button>
                            {[50, 100, 150, 200].map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setMixedQtyInput(v.toString())}
                                className={`px-2 py-1 border text-[10px] font-semibold rounded cursor-pointer ${
                                  mixedQtyInput === v.toString() ? 'bg-amber-600 text-white' : 'bg-white text-slate-600'
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>

                          <input
                            type="number"
                            value={mixedQtyInput}
                            onChange={(e) => setMixedQtyInput(e.target.value)}
                            className="w-18 px-2 py-1.5 rounded border border-slate-200 font-mono text-center text-sm font-bold bg-white text-slate-850"
                          />
                          <button
                            type="button"
                            onClick={saveMixedPerfumeQuantity}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer flex-shrink-0"
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 border-t border-slate-200/50 pt-3">
                      <button
                        type="button"
                        onClick={handleCancelMixedPalette}
                        className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleValidateMixedPalette}
                        disabled={mixedEntries.length === 0}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-40"
                      >
                        Créer & Valider la Palette Mixte
                      </button>
                    </div>
                  </div>
                )}

                {/* Perfumes Grid for this gamme */}
                <div className="mt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-0.5 mb-3.5">
                    {isCurrentMixed ? "Sélectionner Parfum à ajouter :" : "Cliquer pour enregistrer immédiatement :"}
                  </h4>

                  {g.perfumes.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      Aucun parfum configuré dans cette gamme. Configurez cette gamme dans nomenclatures.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fade-in">
                      {g.perfumes.map((perfume, idx) => {
                        const handleClick = () => {
                          if (isCurrentMixed) {
                            startMixedPaletteEntryEx(perfume);
                          } else {
                            handlePerfumeClickMono(g.id, g.name, perfume, currentQty);
                          }
                        };

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={handleClick}
                            className={`p-4 rounded-xl border font-semibold text-xs transition-all relative flex flex-col items-center justify-center gap-1.5 h-20 text-center shadow-2xs group cursor-pointer ${
                              isCurrentMixed 
                                ? 'bg-amber-50 hover:bg-amber-100 hover:border-amber-400 border-amber-200 text-amber-900 border-dashed animate-pulse' 
                                : 'bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 border-emerald-200/60 text-emerald-950'
                            }`}
                          >
                            <span className="font-bold block tracking-tight truncate leading-tight w-full">{perfume}</span>
                            {!isCurrentMixed && (
                              <span className="text-[10px] text-emerald-600 block opacity-80 group-hover:opacity-100 font-mono font-bold transition-all">
                                + {currentQty} u.
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Operator's recent palettes list */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Vos Derniers Enregistrements</h3>
            <p className="text-slate-400 text-[11px]">Dernières palettes de votre shift de production (par {agentName})</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
            {palettes.filter(p => p.agentName === agentName).length} Enregistrées
          </span>
        </div>

        {palettes.filter(p => p.agentName === agentName).length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Aucune palette enregistrée par vous au cours de cette session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 font-bold">N° Palette</th>
                  <th className="py-2.5 font-bold">Gamme / Produit</th>
                  <th className="py-2.5 font-bold">Type</th>
                  <th className="py-2.5 font-bold">Détails & Quantités</th>
                  <th className="py-2.5 font-bold">Shift final</th>
                  <th className="py-2.5 font-bold">Date de saisie</th>
                  <th className="py-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {palettes
                  .filter(p => p.agentName === agentName)
                  .map((p) => {
                    const totalQty = p.entries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 font-bold font-mono text-emerald-600">N° {p.numberCode}</td>
                        <td className="py-3.5 font-semibold">{p.gammeName}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            p.type === 'mono' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {p.type === 'mono' ? 'Mono-Parfum' : 'Palette Mixte'}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <div className="flex flex-col gap-1 max-w-sm">
                            {p.entries.map((e, idx) => (
                              <div key={idx} className="text-slate-600 flex items-center gap-1.5">
                                <span className="font-semibold">{e.perfume}</span> :
                                <span className="font-mono bg-slate-100 px-1 rounded text-[10px] font-semibold">
                                  {e.quantityDay > 0 && `Jour: ${e.quantityDay}`}
                                  {e.quantityDay > 0 && e.quantityNight > 0 && ' | '}
                                  {e.quantityNight > 0 && `Nuit: ${e.quantityNight}`}
                                </span>
                              </div>
                            ))}
                            <span className="text-[10px] text-slate-400 font-semibold font-mono">
                              Total : {totalQty} u
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className={`inline-flex items-center gap-1 font-semibold ${
                            p.lastUpdatedShift === 'jour' ? 'text-amber-600' : 'text-purple-600'
                          }`}>
                            {p.lastUpdatedShift === 'jour' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                            {p.lastUpdatedShift === 'jour' ? 'Jour' : 'Nuit'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400 font-mono">
                          {new Date(p.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                        </td>
                        <td className="py-3.5 text-right flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPalette(p)}
                            className="p-1 px-2 border border-slate-200 hover:border-emerald-200 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 transition-all font-semibold flex items-center justify-center cursor-pointer"
                            title="Modifier cette saisie"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePalette(p.id)}
                            className="p-1 px-2 border border-slate-200 hover:border-rose-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all font-semibold cursor-pointer"
                            title="Supprimer cette saisie"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale d'Édition de Palette */}
      {editingPalette && (() => {
        const currentEditGamme = gammes.find(g => g.id === editGammeId);
        const currentTotal = editEntries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-fade-in text-slate-800">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-100 shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Modifier l me Palette N° {editingPalette.numberCode}
                    </h3>
                    <p className="text-slate-400 text-[11px]">Saisie d'origine par {editingPalette.agentName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPalette(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  &times;
                </button>
              </div>

              {/* Form Body - scrollable */}
              <div className="py-4 overflow-y-auto space-y-5 flex-1 min-h-0 pr-1 scrollbar-thin">
                
                {/* 1. Sélection de la Gamme / Produit */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                    Gamme / Produit
                  </label>
                  <select
                    value={editGammeId}
                    onChange={(e) => {
                      const gId = e.target.value;
                      setEditGammeId(gId);
                      const targetG = gammes.find(g => g.id === gId);
                      if (targetG) {
                        setEditEntries(targetG.perfumes.map(pName => {
                          const existing = editEntries.find(entry => entry.perfume === pName);
                          return {
                            perfume: pName,
                            quantityDay: existing ? existing.quantityDay : 0,
                            quantityNight: existing ? existing.quantityNight : 0
                          };
                        }));
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    {gammes.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Sélection du Shift Final */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5 block">
                    Shift Final de Production
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 inline-flex">
                    <button
                      type="button"
                      onClick={() => setEditShift('jour')}
                      className={`px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        editShift === 'jour'
                          ? 'bg-white text-amber-600 shadow-xs ring-1 ring-black/5'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" /> Jour
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditShift('nuit')}
                      className={`px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        editShift === 'nuit'
                          ? 'bg-slate-900 text-purple-400 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" /> Nuit
                    </button>
                  </div>
                </div>

                {/* 3. Composition des parfums */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                      Composition des Parfums & Quantités
                    </label>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold">
                      {currentEditGamme ? `${currentEditGamme.perfumes.length} parfums disponibles` : ''}
                    </span>
                  </div>

                  {!currentEditGamme ? (
                    <p className="text-xs text-rose-500 font-semibold">Veuillez sélectionner une gamme de produit.</p>
                  ) : currentEditGamme.perfumes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Aucun parfum de configuré pour cette gamme.</p>
                  ) : (
                    <div className="space-y-3.5 max-h-[35vh] overflow-y-auto pr-1">
                      {currentEditGamme.perfumes.map((perfumeName, idx) => {
                        const entry = editEntries.find(e => e.perfume === perfumeName) || { perfume: perfumeName, quantityDay: 0, quantityNight: 0 };
                        const stdQty = currentEditGamme.standardQuantity ?? 100;

                        return (
                          <div key={idx} className="bg-slate-50 hover:bg-slate-105 p-3 rounded-xl border border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors text-xs">
                            <span className="font-bold text-slate-800 text-xs md:w-1/4 truncate">{perfumeName}</span>

                            <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 justify-end">
                              {/* Shift Jour input */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-600 font-bold flex items-center gap-0.5 text-[10px] uppercase">
                                  <Sun className="w-3 h-3" /> Jour
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={entry.quantityDay || ''}
                                  placeholder="0"
                                  onChange={(e) => handleUpdateEditEntryQty(perfumeName, 'jour', parseInt(e.target.value, 10) || 0)}
                                  className="w-14 bg-white border border-slate-200 rounded-lg py-1 text-center font-bold font-mono text-xs text-slate-800 outline-none focus:border-amber-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEditEntryQty(perfumeName, 'jour', stdQty)}
                                  className="bg-white hover:bg-amber-50 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 hover:border-amber-200 text-slate-600 uppercase cursor-pointer transition-colors"
                                  title="Utiliser la quantité standard"
                                >
                                  Std
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEditEntryQty(perfumeName, 'jour', 0)}
                                  className="text-[13px] text-slate-400 hover:text-rose-500 font-bold px-1 transition-colors cursor-pointer"
                                  title="Mettre à 0"
                                >
                                  &times;
                                </button>
                              </div>

                              {/* Shift Nuit input */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-purple-600 font-bold flex items-center gap-0.5 text-[10px] uppercase">
                                  <Moon className="w-3 h-3" /> Nuit
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={entry.quantityNight || ''}
                                  placeholder="0"
                                  onChange={(e) => handleUpdateEditEntryQty(perfumeName, 'nuit', parseInt(e.target.value, 10) || 0)}
                                  className="w-14 bg-white border border-slate-200 rounded-lg py-1 text-center font-bold font-mono text-xs text-slate-800 outline-none focus:border-purple-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEditEntryQty(perfumeName, 'nuit', stdQty)}
                                  className="bg-white hover:bg-purple-50 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 hover:border-purple-200 text-slate-600 uppercase cursor-pointer transition-colors"
                                  title="Utiliser la quantité standard"
                                >
                                  Std
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEditEntryQty(perfumeName, 'nuit', 0)}
                                  className="text-[13px] text-slate-400 hover:text-rose-500 font-bold px-1 transition-colors cursor-pointer"
                                  title="Mettre à 0"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t pt-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                <div>
                  <span className="font-bold text-slate-700">Total calculé :</span>{' '}
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs border border-emerald-100">
                    {currentTotal} Carton{currentTotal > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingPalette(null)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 cursor-pointer transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedPalette}
                    disabled={currentTotal === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Enregistrer les modifications
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
