/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Gamme, InventoryItem } from '../types';
import { 
  ClipboardCheck, Sparkles, Folder, RefreshCw, Layers, Plus, 
  Trash2, ShieldCheck, AlertCircle, Printer, Calendar, User 
} from 'lucide-react';

interface InventaireProps {
  key?: string;
  gammes: Gamme[];
  inventories: InventoryItem[];
  currentUser: { name: string; id: string; isAdmin: boolean };
  onAddInventoryItem: (gammeId: string, gammeName: string, type: 'mono' | 'mixte', entries: { perfume: string; qty: number }[]) => void;
  onDeleteInventoryItem: (id: string) => void;
}

export default function Inventaire({
  gammes,
  inventories,
  currentUser,
  onAddInventoryItem,
  onDeleteInventoryItem
}: InventaireProps) {
  const getMixedPaletteLabel = (item: InventoryItem) => {
    if (item.type !== 'mixte') return '';
    const agentMixedItems = [...inventories]
      .filter(inv => inv.agentId === item.agentId && inv.type === 'mixte')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const index = agentMixedItems.findIndex(inv => inv.id === item.id);
    return index !== -1 ? `M${index + 1}` : 'M';
  };

  const getDominantPerfumeForMixte = (item: InventoryItem): string => {
    if (!item.entries || item.entries.length === 0) return '';
    let maxQty = -1;
    let dominantPerfume = '';
    item.entries.forEach(e => {
      if (e.quantity > maxQty) {
        maxQty = e.quantity;
        dominantPerfume = e.perfume;
      }
    });
    return dominantPerfume;
  };

  const getPerfumeInitials = (name: string, gammeId?: string): string => {
    if (!name) return '';
    if (gammeId) {
      const g = gammes.find(x => x.id === gammeId);
      if (g?.perfumeAbbreviations?.[name]) {
        return g.perfumeAbbreviations[name];
      }
    }
    return name.split(/\s+/).map(word => word[0] ? word[0].toUpperCase() : '').join('');
  };

  const getOtherPerfumesInitials = (item: InventoryItem, dominantPerfume: string): string => {
    return item.entries
      .filter(e => e.perfume !== dominantPerfume)
      .map(e => `${getPerfumeInitials(e.perfume, item.gammeId)}: ${e.quantity}`)
      .filter(Boolean)
      .join(', ');
  };

  const getPerfumeTotalQuantity = (gammeId: string, perfume: string, agentId: string) => {
    return inventories
      .filter(inv => inv.agentId === agentId && inv.gammeId === gammeId)
      .reduce((sum, inv) => {
        const entry = inv.entries.find(e => e.perfume === perfume);
        return sum + (entry ? entry.quantity : 0);
      }, 0);
  };

  const [selectedGammeId, setSelectedGammeId] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mixed inventory builder
  const [isMixedMode, setIsMixedMode] = useState<boolean>(false);
  const [mixedEntries, setMixedEntries] = useState<{ perfume: string; qty: number }[]>([]);
  const [activePerfumeInput, setActivePerfumeInput] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Manage custom entered quantities per product card
  const [monoCustomQuantities, setMonoCustomQuantities] = useState<Record<string, string>>({});
  const [pendingPrint, setPendingPrint] = useState<boolean>(false);

  // Reliable print effect triggered after DOM rendering is complete
  useEffect(() => {
    if (pendingPrint) {
      const timer = setTimeout(() => {
        window.focus();
        window.print();
        setPendingPrint(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pendingPrint]);

  // Paginate gammes for printing/previews with dynamic height estimation for A4 boundaries
  const getFormattedPrintPages = (agentId: string) => {
    const activeGammes = gammes.filter(g => {
      return g.perfumes.some(perfume => {
        return inventories.some(inv => {
          const isOwn = inv.agentId === agentId && inv.gammeId === g.id;
          if (!isOwn) return false;
          if (inv.type === 'mono') {
            return inv.entries.some(e => e.perfume === perfume);
          } else {
            return getDominantPerfumeForMixte(inv) === perfume;
          }
        });
      });
    });

    interface PageRow {
      type: 'product-header' | 'perfume-line';
      gammeId: string;
      gammeName: string;
      perfumeName: string;
      perfumeKey: string;
      items?: InventoryItem[];
      isContinuation?: boolean;
      totalQuantity?: number;
    }

    interface PageData {
      rows: PageRow[];
    }

    const pages: PageData[] = [];
    let currentPageRows: PageRow[] = [];
    let currentHeight = 0;

    // Physical A4 height limits & layout element size metrics (in safe CSS-equivalent print coordinates)
    const MAX_PAGE_HEIGHT = 860;       // Maximized usable space after margins
    const GAMME_HEADER_COST = 36;      // Height of product category header row
    const PERFUME_ROW_BASE_COST = 16;  // Padding/layout overhead per perfume row
    const PALETTE_ROW_LINE_COST = 38;  // Height of a single wrapped line of circular badges
    const PALETTES_PER_LINE = 13;      // Approximate safe count of badges per horizontal page line
    const SIGN_OFF_COST = 140;         // Height budget for signature block at document end

    // Identify final items of the document to subtract block heights from the page limit
    const lastGamme = activeGammes[activeGammes.length - 1];
    const getLastActivePerfume = (g: typeof activeGammes[0]) => {
      const gPerfumes = g.perfumes.filter(p => {
        return inventories.some(inv => {
          return inv.agentId === agentId && inv.gammeId === g.id && (inv.type === 'mono' ? inv.entries.some(e => e.perfume === p) : getDominantPerfumeForMixte(inv) === p);
        });
      });
      return gPerfumes[gPerfumes.length - 1];
    };
    const lastActivePerfumeOfLastGamme = lastGamme ? getLastActivePerfume(lastGamme) : null;

    activeGammes.forEach(gamme => {
      const activePerfumes = gamme.perfumes.filter(perfume => {
        return inventories.some(inv => {
          const isOwn = inv.agentId === agentId && inv.gammeId === gamme.id;
          if (!isOwn) return false;
          if (inv.type === 'mono') {
            return inv.entries.some(e => e.perfume === perfume);
          } else {
            return getDominantPerfumeForMixte(inv) === perfume;
          }
        });
      });

      let isGammeHeaderPrintedOnCurrentPage = false;
      let isGammeStartedPreviously = false;

      activePerfumes.forEach(perfume => {
        const relevantItems = inventories.filter(inv => {
          const isOwn = inv.agentId === agentId && inv.gammeId === gamme.id;
          if (!isOwn) return false;
          if (inv.type === 'mono') {
            return inv.entries.some(e => e.perfume === perfume);
          } else {
            return getDominantPerfumeForMixte(inv) === perfume;
          }
        });

        let remainingPallets = [...relevantItems];
        let isFirstSegment = true;

        const isAbsoluteLastPerfume = lastGamme && (gamme.id === lastGamme.id) && (perfume === lastActivePerfumeOfLastGamme);

        while (remainingPallets.length > 0) {
          let productHeaderCost = 0;
          if (!isGammeHeaderPrintedOnCurrentPage) {
            productHeaderCost = GAMME_HEADER_COST;
          }

          // Limit page height dynamically: if rendering the last items, preserve space for the signatures box
          const isLastSegmentLeft = remainingPallets.length <= PALETTES_PER_LINE;
          const effectivePageLimit = (isAbsoluteLastPerfume && isLastSegmentLeft) ? (MAX_PAGE_HEIGHT - SIGN_OFF_COST) : MAX_PAGE_HEIGHT;

          const availableHeightForPerfumeRow = effectivePageLimit - currentHeight - productHeaderCost - PERFUME_ROW_BASE_COST;
          let maxLinesWeCanFit = Math.floor(availableHeightForPerfumeRow / PALETTE_ROW_LINE_COST);

          if (maxLinesWeCanFit >= 1) {
            const maxPalletsToFit = maxLinesWeCanFit * PALETTES_PER_LINE;
            const palletsToPlace = remainingPallets.slice(0, maxPalletsToFit);
            const isRemainingEmpty = remainingPallets.length <= maxPalletsToFit;

            remainingPallets = remainingPallets.slice(maxPalletsToFit);

            // Output product/gamme header if transitioning to page/product
            if (!isGammeHeaderPrintedOnCurrentPage) {
              currentPageRows.push({
                type: 'product-header',
                gammeId: gamme.id,
                gammeName: gamme.name,
                perfumeName: '',
                perfumeKey: '',
                isContinuation: isGammeStartedPreviously
              });
              currentHeight += GAMME_HEADER_COST;
              isGammeHeaderPrintedOnCurrentPage = true;
              isGammeStartedPreviously = true;
            }

            // Output active perfume row segment with full standard items list to allow native horizontal wrapping
            const linesUsed = Math.ceil(palletsToPlace.length / PALETTES_PER_LINE);
            const rowHeightSpent = PERFUME_ROW_BASE_COST + (linesUsed * PALETTE_ROW_LINE_COST);

            currentPageRows.push({
              type: 'perfume-line',
              gammeId: gamme.id,
              gammeName: gamme.name,
              perfumeName: perfume,
              perfumeKey: perfume,
              items: palletsToPlace,
              isContinuation: !isFirstSegment,
              // Only display total aggregate count once all the perfume's pallets have completed
              totalQuantity: isRemainingEmpty ? getPerfumeTotalQuantity(gamme.id, perfume, agentId) : undefined
            });

            currentHeight += rowHeightSpent;
            isFirstSegment = false;
          } else {
            // Push active content rows as finished page and initiate fresh layout page
            pages.push({ rows: currentPageRows });
            currentPageRows = [];
            currentHeight = 0;
            isGammeHeaderPrintedOnCurrentPage = false;
          }
        }
      });
    });

    if (currentPageRows.length > 0) {
      pages.push({ rows: currentPageRows });
    }

    if (pages.length === 0) {
      pages.push({ rows: [] });
    }

    return pages;
  };

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

  // Quick standard inventory add
  const handleQuickAdd = (gammeId: string, gammeName: string, perfume: string, qty: number) => {
    try {
      onAddInventoryItem(gammeId, gammeName, 'mono', [{ perfume, qty }]);
      triggerSuccessMsg(`Inventaire : 1 palette (${perfume}) de ${qty} u. enregistrée !`);
    } catch (e: any) {
      triggerErrorMsg(e.message || "Erreur de saisie.");
    }
  };

  // Mixed mode functions
  const handleStartMixedAdd = (perfume: string, standardQty: number) => {
    setActivePerfumeInput(perfume);
    setQuantityInput(standardQty.toString());
  };

  const handleSaveMixedPerfumeCount = () => {
    if (!activePerfumeInput) return;
    const qty = parseFloat(quantityInput);
    if (isNaN(qty) || qty <= 0) {
      triggerErrorMsg("La quantité ou le nombre de palettes de cet inventaire doit être supérieur à 0.");
      return;
    }
    setMixedEntries(prev => [...prev, { perfume: activePerfumeInput, qty }]);
    setActivePerfumeInput(null);
  };

  const handleValidateMixedInventory = () => {
    const activeG = gammes.find(g => g.id === selectedGammeId);
    if (!activeG) return;
    if (mixedEntries.length === 0) {
      triggerErrorMsg("Veuillez saisir au moins une quantité de parfum.");
      return;
    }
    try {
      onAddInventoryItem(activeG.id, activeG.name, 'mixte', mixedEntries);
      triggerSuccessMsg("Saisie mixte d'inventaire validée !");
      setMixedEntries([]);
      setIsMixedMode(false);
      setSelectedGammeId('');
    } catch (e: any) {
      triggerErrorMsg(e.message || "Erreur.");
    }
  };

  const handleCancelMixedInventory = () => {
    setMixedEntries([]);
    setActivePerfumeInput(null);
    setIsMixedMode(false);
    setSelectedGammeId('');
  };

  // Dynamic printing of current state
  const handlePrintInventory = () => {
    setPendingPrint(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-5.5 h-5.5 text-blue-600" /> Inventaire Physique
          </h2>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 bg-blue-600 font-semibold text-white rounded-xl text-xs hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4" /> Afficher l'Aperçu avant Impression
          </button>
          <button
            onClick={handlePrintInventory}
            className="px-4 py-2 border border-slate-205 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2 bg-white"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Imprimer
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500 text-white font-medium p-4 rounded-xl flex items-center gap-2 text-xs shadow-md animate-fade-in">
          <ShieldCheck className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-100 border-l-4 border-rose-500 text-rose-800 p-4 rounded-r-xl flex items-center gap-2 text-xs shadow-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Main product navigation grids */}
      {gammes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center flex flex-col items-center gap-3">
          <Folder className="w-10 h-10 text-amber-500" />
          <h3 className="font-semibold text-amber-900 text-sm">Aucun produit configuré</h3>
          <p className="text-amber-700/80 text-xs max-w-sm leading-relaxed">
            Configurez des gammes et des parfums pour démarrer l'inventaire physique simultané.
          </p>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in" id="inventaire-gammes-grid-container">
          {gammes.map(g => {
            const isCurrentMixed = isMixedMode && selectedGammeId === g.id;
            const isOtherMixed = isMixedMode && selectedGammeId !== g.id;

            return (
              <div 
                key={g.id} 
                id={`inventaire-gamme-card-${g.id}`}
                className={`bg-white rounded-2xl p-6 border transition-all duration-300 relative ${
                  isCurrentMixed 
                    ? 'ring-2 ring-blue-500 border-transparent shadow-md' 
                    : isOtherMixed 
                      ? 'opacity-40 border-slate-100 pointer-events-none' 
                      : 'border-slate-100 shadow-xs hover:shadow-xs hover:border-slate-205'
                }`}
              >
                {/* Product Card Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200/50 pb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                      <Folder className="w-5 h-5" />
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
                      <div className="flex flex-wrap items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Quantité Spécifique (Optionnelle) :</span>
                          <input
                            type="number"
                            min={1}
                            placeholder={String(g.standardQuantity ?? 100)}
                            value={monoCustomQuantities[g.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMonoCustomQuantities(prev => ({ ...prev, [g.id]: val }));
                            }}
                            className="w-16 bg-white border border-slate-250 rounded-lg py-1 text-center font-bold font-mono text-xs text-slate-850 outline-none"
                          />
                          {(monoCustomQuantities[g.id] !== undefined && monoCustomQuantities[g.id] !== '') && (
                            <button
                              type="button"
                              onClick={() => {
                                setMonoCustomQuantities(prev => {
                                  const copy = { ...prev };
                                  delete copy[g.id];
                                  return copy;
                                });
                              }}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-slate-300 uppercase cursor-pointer transition-colors"
                              title="Réinitialiser à la quantité standard"
                            >
                              Réinit
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mixed Mode Toggle */}
                    {!isOtherMixed && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrentMixed) {
                            handleCancelMixedInventory();
                          } else {
                            setSelectedGammeId(g.id);
                            setIsMixedMode(true);
                            setMixedEntries([]);
                            setActivePerfumeInput(null);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                          isCurrentMixed
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-2xs'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100 shadow-2xs'
                        }`}
                      >
                        {isCurrentMixed ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" /> Saisie Rapide
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

                {/* Mixed inventory composer workflow inside the active product container */}
                {isCurrentMixed && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 animate-fade-in mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-500 animate-bounce" /> Palette Mixte en cours de comptage
                      </span>
                      {mixedEntries.length > 0 && (
                        <span className="text-xs font-bold font-mono px-2.5 py-1 bg-blue-200/50 text-blue-850 rounded-lg animate-pulse">
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
                            <span className="font-mono bg-slate-105 text-blue-805 px-1.5 rounded font-bold">
                              {entry.qty} u.
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

                    {activePerfumeInput && (
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in text-slate-800">
                        <div className="text-xs">
                          <span className="text-slate-500 font-semibold uppercase tracking-wider block">Parfum sélectionné :</span>
                          <span className="text-slate-800 font-bold block mt-0.5">{activePerfumeInput}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-xs font-semibold text-slate-605 flex-shrink-0">Quantité :</span>
                          
                          <div className="flex gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setQuantityInput((g.standardQuantity ?? 100).toString())}
                              className={`px-2 py-1 border text-[10px] font-extrabold rounded bg-blue-50 border-blue-200 text-blue-800 cursor-pointer ${
                                quantityInput === (g.standardQuantity ?? 100).toString() ? 'bg-blue-600! text-white!' : ''
                              }`}
                            >
                              Std ({g.standardQuantity ?? 100})
                            </button>
                            {[1, 50, 100, 150, 200].map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setQuantityInput(v.toString())}
                                className={`px-2 py-1 border text-[10px] font-semibold rounded cursor-pointer ${
                                  quantityInput === v.toString() ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>

                          <input
                            type="number"
                            value={quantityInput}
                            onChange={(e) => setQuantityInput(e.target.value)}
                            className="w-18 px-2 py-1.5 rounded border border-slate-200 font-mono text-center text-sm font-bold bg-white text-slate-85"
                          />
                          <button
                            type="button"
                            onClick={handleSaveMixedPerfumeCount}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer flex-shrink-0"
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 border-t border-slate-200/50 pt-3">
                      <button
                        type="button"
                        onClick={handleCancelMixedInventory}
                        className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleValidateMixedInventory}
                        disabled={mixedEntries.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-40"
                      >
                        Enregistrer la Palette Mixte
                      </button>
                    </div>
                  </div>
                )}

                {/* Perfumes grid for this product */}
                <div className="mt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-0.5 mb-3.5">
                    {isCurrentMixed ? "Sélectionner Parfum à ajouter :" : "Cliquer pour enregistrer immédiatement l'inventaire :"}
                  </h4>

                  {g.perfumes.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      Aucun parfum configuré dans cette gamme. Configurez cette gamme dans nomenclatures.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fade-in">
                      {g.perfumes.map((perfume, idx) => {
                        const customVal = monoCustomQuantities[g.id];
                        const hasCustom = customVal !== undefined && customVal !== '';
                        const displayQty = hasCustom ? (parseInt(customVal, 10) || (g.standardQuantity ?? 100)) : (g.standardQuantity ?? 100);

                        const handleClick = () => {
                          if (isCurrentMixed) {
                            handleStartMixedAdd(perfume, g.standardQuantity ?? 100);
                          } else {
                            handleQuickAdd(g.id, g.name, perfume, displayQty);
                            if (hasCustom) {
                              setMonoCustomQuantities(prev => {
                                const copy = { ...prev };
                                delete copy[g.id];
                                return copy;
                              });
                            }
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
                                : hasCustom
                                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-905 ring-1 ring-amber-300/30'
                                  : 'bg-blue-50/75 hover:bg-blue-100 hover:border-blue-400 border-blue-200/60 text-blue-900'
                            }`}
                          >
                            <span className="font-bold block tracking-tight truncate leading-tight w-full" id={`inventaire-perfume-button-${g.id}-${perfume}`}>{perfume}</span>
                            {!isCurrentMixed && (
                              <span className={`text-[10px] block font-mono font-bold transition-all ${
                                hasCustom ? 'text-amber-700' : 'text-blue-600 opacity-80 group-hover:opacity-100'
                              }`}>
                                {hasCustom ? `+ ${displayQty} u. (Spécifique)` : `+ ${displayQty} u.`}
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

      {/* Complete Inventories logs grouped by agent */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Registre Global d'Inventaire Actif</h3>
            <p className="text-slate-400 text-[11px]">Saisies de comptage physique en temps réel par les opérateurs</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
              Total palettes enregistrées : {inventories.length}
            </span>
          </div>
        </div>

        {inventories.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            Aucun comptage d'inventaire enregistré à ce jour.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 font-bold">Gamme / Produit</th>
                  <th className="py-2.5 font-bold">Type Inventaire</th>
                  <th className="py-2.5 font-bold">Comptage & Parfums</th>
                  <th className="py-2.5 font-bold">Opérateur</th>
                  <th className="py-2.5 font-bold">Horodatage</th>
                  <th className="py-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {inventories.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 font-semibold text-slate-800">{item.gammeName}</td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.type === 'mono' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.type === 'mono' ? 'Simple' : 'Palette Mixte'}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex flex-col gap-1">
                        {item.entries.map((e, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span>{e.perfume}</span>: 
                            <span className="font-mono bg-slate-100 text-slate-800 px-1.5 rounded text-[10px] font-bold">
                              {e.quantity} u
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {item.agentName}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-400 font-mono">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR')} {new Date(item.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                    </td>
                    <td className="py-3.5 text-right">
                      {/* Normal operators can delete only their own inventory records, admins can delete any */}
                      {(currentUser.isAdmin || item.agentId === currentUser.id) ? (
                        <button
                          onClick={() => onDeleteInventoryItem(item.id)}
                          className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 text-slate-400 transition-all font-semibold cursor-pointer"
                          title="Supprimer cet item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px] font-semibold italic">Verrouillé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINT-ONLY SECTION (Visually hidden, rendered perfectly when print dialog is opened) */}
      {pendingPrint && createPortal(
        <div className="hidden print:block bg-white text-black p-0" id="print-inventory-area">
          {(() => {
            const printedPages = getFormattedPrintPages(currentUser.id);
            const totalActivePalettes = inventories.filter(inv => inv.agentId === currentUser.id).length;
            const grandTotalQty = inventories.filter(inv => inv.agentId === currentUser.id).reduce((acc, item) => acc + item.entries.reduce((sum, e) => sum + e.quantity, 0), 0);

            return printedPages.map((page, pageIdx) => (
              <div key={pageIdx} className="page-break-after p-0 w-full flex flex-col justify-start gap-6 bg-white text-slate-800 relative font-sans" style={{ pageBreakAfter: 'always' }}>
                <div className="space-y-6">
                  {/* Print Document Header */}
                  <div className="flex justify-between items-start border-b border-slate-350 pb-4 text-left">
                    <div>
                      <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        Rapport d'Inventaire Complet {printedPages.length > 1 ? `(${pageIdx + 1}/${printedPages.length})` : ''}
                      </h1>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-700">YETISTOCK SUIVI</span>
                        <span>•</span>
                        <span>Comptage Physique Stock</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                      <p className="font-bold text-slate-900">Agent : {currentUser.name}</p>
                      <p>Horodatage : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', hour12: false})}</p>
                      <p className="font-semibold text-blue-700">Total Palettes : {totalActivePalettes}</p>
                    </div>
                  </div>

                  {/* Inventories Aggregation Blocks */}
                  {page.rows.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 italic text-xs">
                      Aucune palette physique dans l'inventaire actif.
                    </div>
                  ) : (
                    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-none text-left">
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody>
                          {page.rows.map((row, rowIdx) => {
                            if (row.type === 'product-header') {
                              return (
                                <tr key={`g-row-${rowIdx}`} className="bg-slate-100/90 font-extrabold text-xs uppercase tracking-wider border-b border-slate-305">
                                  <td colSpan={3} className="py-2.5 px-3 font-extrabold text-slate-900">
                                    {row.gammeName} {row.isContinuation ? '(suite)' : ''}
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={`p-row-${rowIdx}`} className="border-b border-slate-150 last:border-b-0 hover:bg-slate-50/20">
                                <td className="w-1/4 min-w-[120px] font-semibold text-slate-800 py-3 px-3 border-r border-slate-150 align-middle">
                                  {row.perfumeName} {row.isContinuation ? '(suite)' : ''}
                                </td>
                                <td className="py-2 px-3 align-middle">
                                  <div className="flex flex-wrap gap-2 items-center">
                                    {row.items?.map((item, idx) => {
                                      const entry = item.entries.find(e => e.perfume === row.perfumeKey);
                                      const count = entry ? entry.quantity : 0;
                                      return (
                                        <div key={idx} className="break-inside-avoid print:break-inside-avoid inline-block flex flex-col items-center justify-center gap-0.5 my-1">
                                          {item.type === 'mixte' ? (
                                            <>
                                              <div className="w-8 h-8 rounded-lg border-2 border-amber-600 bg-amber-50 text-amber-950 flex items-center justify-center font-extrabold text-xs shadow-3xs">
                                                {count}
                                              </div>
                                              {(() => {
                                                const initials = getOtherPerfumesInitials(item, row.perfumeKey);
                                                return initials ? (
                                                  <span className="text-[8px] font-bold text-amber-700 font-mono tracking-tighter uppercase leading-none">
                                                    {initials}
                                                  </span>
                                                ) : null;
                                              })()}
                                            </>
                                          ) : (
                                            <span className="w-8 h-8 rounded-full border-2 border-slate-855 bg-slate-55 text-slate-900 flex items-center justify-center font-extrabold text-xs shadow-3xs">
                                              {count}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="text-right font-mono text-xs font-bold text-slate-900 border-l border-slate-150 pl-3 min-w-[100px] py-3 px-3 pr-4 align-middle">
                                  {row.totalQuantity !== undefined ? `Total : ${row.totalQuantity} Carton` : <span className="text-[10px] text-slate-400 font-normal italic">Suite...</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* General Totals and Sign Box flowing at the very end cleanly */}
                {pageIdx === printedPages.length - 1 && (
                  <div className="break-inside-avoid print:break-inside-avoid space-y-4 pt-4 border-t border-slate-200 mt-4 bg-white">
                    <div className="flex justify-end pr-4 font-bold text-slate-900 text-sm">
                      Total Général : {grandTotalQty} Carton
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 pb-1">
                      <div>
                        <p className="font-bold text-slate-700 uppercase">Document Certifié Conforme</p>
                        <p className="text-slate-400 mt-0.5">Signature de l'agent opérateur de conditionnement</p>
                      </div>
                      <div className="w-36 h-12 border border-dashed border-slate-300 rounded flex items-center justify-center italic text-slate-300 font-serif bg-white">
                        Signature Agent
                      </div>
                    </div>
                    <div className="text-center text-[8px] text-slate-400 border-t pt-2 uppercase font-mono tracking-wider">
                      YETISTOCK SUIVI • Rapport Continu Épargnant le Papier
                    </div>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>,
        document.body
      )}

      {/* PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Modal header actions */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl text-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans font-semibold">Aperçu avant Impression — Rapport d'Inventaire</h3>
                <p className="text-[11px] text-slate-500 font-sans">Visualisation optimisée du rapport physique avec en-têtes auto-répétés</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPendingPrint(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" /> Imprimer Réellement
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="bg-white border border-slate-205 text-slate-600 hover:bg-slate-100 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Simulated Paper Sheets Stack */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-100 flex flex-col items-center gap-8 w-full">
              {(() => {
                const printedPages = getFormattedPrintPages(currentUser.id);
                const totalActivePalettes = inventories.filter(inv => inv.agentId === currentUser.id).length;
                const grandTotalQty = inventories.filter(inv => inv.agentId === currentUser.id).reduce((acc, item) => acc + item.entries.reduce((sum, e) => sum + e.quantity, 0), 0);

                if (totalActivePalettes === 0) {
                  return (
                    <div className="bg-white border border-slate-350 w-full max-w-3xl p-12 rounded-xl shadow-md text-center">
                      <p className="text-slate-400 italic text-xs">Aucune palette physique dans l'inventaire actif.</p>
                    </div>
                  );
                }

                return printedPages.map((page, pageIdx) => (
                  <div key={pageIdx} className="bg-white border border-slate-300 w-full max-w-2xl p-8 rounded-xl shadow-md flex flex-col justify-start gap-6 text-slate-800 relative font-sans">
                    {/* Simulated Stamp indicator */}
                    <div className="absolute top-8 right-8 border border-slate-400 rounded-lg px-2 py-1 text-[10px] uppercase font-bold text-slate-500 rotate-3 select-none">
                      Page {pageIdx + 1} / {printedPages.length}
                    </div>

                    <div className="space-y-6">
                      {/* Print Document Header */}
                      <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                        <div>
                          <h1 className="text-base font-extrabold text-slate-900 tracking-tight uppercase">
                            Rapport d'Inventaire Complet {printedPages.length > 1 ? `(${pageIdx + 1}/${printedPages.length})` : ''}
                          </h1>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-700">YETISTOCK SUIVI</span>
                            <span>•</span>
                            <span>Comptage Physique Stock</span>
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                          <p className="font-bold text-slate-900">Agent : {currentUser.name}</p>
                          <p>Horodatage : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', hour12: false})}</p>
                          <p className="font-semibold text-blue-700">Total Palettes : {totalActivePalettes}</p>
                        </div>
                      </div>

                      {/* Inventories Aggregation Blocks */}
                      <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-none text-left">
                        <table className="w-full text-left text-xs border-collapse">
                          <tbody>
                            {page.rows.map((row, rowIdx) => {
                              if (row.type === 'product-header') {
                                return (
                                  <tr key={`g-row-${rowIdx}`} className="bg-slate-100/90 font-extrabold text-xs uppercase tracking-wider border-b border-slate-305">
                                    <td colSpan={3} className="py-2 px-3 font-extrabold text-slate-900">
                                      {row.gammeName} {row.isContinuation ? '(suite)' : ''}
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={`p-row-${rowIdx}`} className="border-b border-slate-150 last:border-b-0 hover:bg-slate-50/20">
                                  <td className="w-1/4 min-w-[100px] font-semibold text-slate-800 py-2.5 px-3 border-r border-slate-150 align-middle">
                                    {row.perfumeName} {row.isContinuation ? '(suite)' : ''}
                                  </td>
                                  <td className="py-1.5 px-3 align-middle">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                      {row.items?.map((item, idx) => {
                                        const entry = item.entries.find(e => e.perfume === row.perfumeKey);
                                        const count = entry ? entry.quantity : 0;
                                        return (
                                          <div key={idx} className="flex flex-col items-center justify-center gap-0.5 my-0.5">
                                            {item.type === 'mixte' ? (
                                              <>
                                                <div className="w-7 h-7 rounded-lg border-2 border-amber-600 bg-amber-50 text-amber-950 flex items-center justify-center font-extrabold text-[10px] shadow-3xs">
                                                  {count}
                                                </div>
                                                {(() => {
                                                  const initials = getOtherPerfumesInitials(item, row.perfumeKey);
                                                  return initials ? (
                                                    <span className="text-[7px] font-bold text-amber-700 font-mono tracking-tighter uppercase leading-none">
                                                      {initials}
                                                    </span>
                                                  ) : null;
                                                })()}
                                              </>
                                            ) : (
                                              <span className="w-7 h-7 rounded-full border-2 border-slate-855 bg-slate-55 text-slate-900 flex items-center justify-center font-extrabold text-[10px] shadow-3xs">
                                                {count}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="text-right font-mono text-xs font-bold text-slate-900 border-l border-slate-150 pl-3 min-w-[90px] py-2.5 px-3 pr-4 align-middle">
                                    {row.totalQuantity !== undefined ? `Total : ${row.totalQuantity} Carton` : <span className="text-[10px] text-slate-400 font-normal italic">Suite...</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Signature / Footer */}
                    {pageIdx === printedPages.length - 1 ? (
                      <div className="border-t border-slate-200 pt-4 flex flex-col justify-between mt-6 gap-3 bg-white">
                        <div className="flex justify-end pr-4 font-bold text-slate-800 text-xs">
                          Total Général : {grandTotalQty} Carton
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 mb-1">
                          <div>
                            <p className="font-bold text-slate-700 uppercase">Document Certifié Conforme</p>
                            <p className="text-slate-400 mt-0.5">Signature de l'agent opérateur de conditionnement</p>
                          </div>
                          <div className="w-28 h-10 border border-dashed border-slate-300 rounded flex items-center justify-center italic text-slate-300 text-[10px]">
                            Signature Agent
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-slate-150 pt-2 text-right mt-4">
                        <span className="text-[9px] text-slate-400 italic">Suite à la page suivante...</span>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
