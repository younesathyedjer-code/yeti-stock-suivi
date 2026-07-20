/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from '../types';
import { Printer, Tag, CheckSquare, Square, ChevronRight, Sparkles, Scale, Sun, Moon } from 'lucide-react';

interface EtiquettesProps {
  palettes: Palette[];
}

export default function Etiquettes({ palettes }: EtiquettesProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [pendingPrint, setPendingPrint] = useState<boolean>(false);

  // Reliable print effect triggered after virtual DOM changes have fully committed to the real screen
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

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(currentId => currentId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === palettes.length) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(palettes.map(p => p.id));
    }
  };

  // Trigger print
  const handlePrint = () => {
    setPendingPrint(true);
  };

  const selectedPalettes = palettes.filter(p => selectedIds.includes(p.id));

  // Partition palettes into pages of 4 labels for A4 layout
  const chunkedPages: Palette[][] = [];
  for (let i = 0; i < selectedPalettes.length; i += 4) {
    chunkedPages.push(selectedPalettes.slice(i, i + 4));
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-5.5 h-5.5 text-indigo-600" /> Étiquetage & Impression
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Sélectionnez vos palettes enregistrées pour imprimer des étiquettes au format A4 (4 par page).</p>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrintPreview(!showPrintPreview)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {showPrintPreview ? "Retourner à la liste" : `Voir l'Aperçu (${selectedIds.length} étiquettes)`}
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Imprimer ({selectedIds.length})
            </button>
          </div>
        )}
      </div>

      {palettes.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 h-64 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <Tag className="w-8 h-8 mb-2 opacity-40 text-indigo-500" />
          <p className="text-xs font-medium">Aucune palette disponible pour l'étiquetage.</p>
          <p className="text-[11px] text-slate-400 mt-1">Enregistrez d'abord une palette dans l'onglet "Saisie Palette".</p>
        </div>
      ) : !showPrintPreview ? (
        // TABLE LIST VIEW with Checkboxes
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {selectedIds.length === palettes.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              {selectedIds.length === palettes.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>

            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
              {selectedIds.length} palette(s) sélectionnée(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 w-10 text-center">Choix</th>
                  <th className="py-2.5 font-bold">N° Palette</th>
                  <th className="py-2.5 font-bold">Produit / Gamme</th>
                  <th className="py-2.5 font-bold">Type</th>
                  <th className="py-2.5 font-bold">Parfums & Quantités</th>
                  <th className="py-2.5 font-bold">Shift final</th>
                  <th className="py-2.5 font-bold">Opérateur</th>
                  <th className="py-2.5 font-bold">Saisie le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {palettes.map((p) => {
                  const totalQty = p.entries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);
                  const isChecked = selectedIds.includes(p.id);
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => handleToggleSelect(p.id)}
                      className={`hover:bg-slate-50/50 cursor-pointer ${
                        isChecked ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Swallowed check to let row click handle it
                          className="rounded border-slate-200 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                      </td>
                      <td className="py-3.5 font-bold font-mono text-indigo-600 text-[13px]">
                        N° {p.numberCode}
                      </td>
                      <td className="py-3.5 font-semibold">{p.gammeName}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.type === 'mono' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {p.type === 'mono' ? 'Mono-Parfum' : 'Chambre Mixte'}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-col gap-1 max-w-sm">
                          {p.entries.map((e, idx) => (
                            <div key={idx} className="text-slate-600 flex items-center gap-1.5 font-medium">
                              <span className="font-semibold">{e.perfume}</span>:
                              <span className="font-mono bg-slate-100 text-[10px] text-slate-800 px-1 rounded">
                                {e.quantityDay > 0 && `Jour: ${e.quantityDay}`}
                                {e.quantityDay > 0 && e.quantityNight > 0 && ' | '}
                                {e.quantityNight > 0 && `Nuit: ${e.quantityNight}`}
                              </span>
                            </div>
                          ))}
                          <span className="text-[10px] text-slate-400 font-semibold font-mono">
                            Total de la Palette : {totalQty} unités
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${
                          p.lastUpdatedShift === 'jour' ? 'text-amber-600' : 'text-purple-600'
                        }`}>
                          {p.lastUpdatedShift === 'jour' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                          {p.lastUpdatedShift === 'jour' ? 'Jour' : 'Nuit'}
                        </span>
                      </td>
                      <td className="py-3.5 font-semibold text-slate-800">{p.agentName}</td>
                      <td className="py-3.5 text-slate-400 font-mono">
                        {new Date(p.createdAt).toLocaleDateString('fr-FR')} {new Date(p.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // LIVE GRID DISPLAY PREVIEW OF CODES (Sets of 4 cards)
        <div className="space-y-8 pb-12">
          <div className="flex items-center justify-between bg-slate-100 p-4 rounded-xl">
            <span className="text-xs font-semibold text-slate-600">
              Aperçu de la mise en page A4 ({chunkedPages.length} pages requises pour {selectedIds.length} étiquette(s))
            </span>
            <button
              onClick={() => setShowPrintPreview(false)}
              className="text-xs text-indigo-600 hover:text-indigo-900 font-semibold cursor-pointer"
            >
              Modifier la sélection
            </button>
          </div>

          {chunkedPages.map((pagePalettes, pageIdx) => (
            <div 
              key={pageIdx} 
              className="bg-white border-2 border-dashed border-slate-300 p-6 rounded-3xl max-w-[21cm] min-h-[29.7cm] mx-auto shadow-lg relative flex flex-col justify-between"
              style={{ contentVisibility: 'auto' }}
            >
              {/* Overlay index tag */}
              <div className="absolute top-3 left-4 bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Page A4 N°{pageIdx + 1} ({pagePalettes.length} / 4 étiquette(s) placée(s))
              </div>

              {/* Grid holding exactly 4 elements */}
              <div className="grid grid-cols-2 gap-4 h-full mt-6">
                {pagePalettes.map((p) => {
                  const totalPaletteQty = p.entries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);
                  
                  return (
                    <div 
                      key={p.id} 
                      className="border-[3px] border-black p-5 flex flex-col justify-between h-[13.5cm] rounded bg-white relative text-black"
                    >
                      {/* Top section: Sequential ID and Shift icon */}
                      <div className="flex items-start justify-between border-b-2 border-black pb-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 block">PALETTE PRODUCTION</span>
                          <span className="text-3xl font-extrabold font-mono tracking-tighter">N° {p.numberCode}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-black border border-black px-2 py-0.5 rounded uppercase ${
                            p.lastUpdatedShift === 'jour' ? 'bg-amber-100 text-amber-900' : 'bg-purple-100 text-purple-950'
                          }`}>
                            {p.lastUpdatedShift === 'jour' ? '☀️ SHIFT JOUR' : '🌙 SHIFT NUIT'}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono mt-0.5">Dernier Enr.</span>
                        </div>
                      </div>

                      {/* Middle: Content details */}
                      <div className="py-3 flex-1 space-y-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">PRODUIT / GAMME :</span>
                          <span className="text-lg font-black uppercase tracking-tight block bg-slate-50 border border-slate-350 p-2.5 rounded text-slate-900 shadow-3xs">{p.gammeName}</span>
                        </div>

                        {/* Perfume List Details */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">COMPOSITIONS & SAISIES SHIFT :</span>
                          <div className="border-2 border-black p-3 rounded-lg bg-slate-50 space-y-2.5">
                            {p.entries.map((e, index) => {
                              const eTot = e.quantityDay + e.quantityNight;
                              return (
                                <div key={index} className="flex justify-between items-center border-b-2 border-slate-200/80 last:border-0 pb-2 last:pb-0">
                                  <span className="font-black truncate max-w-[140px] uppercase text-[15px] text-slate-950 tracking-tight">{e.perfume}</span>
                                  <span className="font-black text-right text-[15px] text-slate-950 flex items-center gap-2">
                                    {(e.quantityDay > 0 || e.quantityNight > 0) && (
                                      <span className="font-mono text-xs text-slate-600 font-bold bg-slate-205 px-1.5 py-0.5 rounded-sm">
                                        {e.quantityDay > 0 && `J: ${e.quantityDay}`}
                                        {e.quantityDay > 0 && e.quantityNight > 0 && ' | '}
                                        {e.quantityNight > 0 && `N: ${e.quantityNight}`}
                                      </span>
                                    )}
                                    <span className="font-black bg-black text-white px-2 py-0.5 rounded text-[13px] tracking-tight shadow-3xs scale-105 min-w-[32px] text-center">
                                      {eTot}
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Segment: Totals & signature */}
                      <div className="border-t-2 border-black pt-2 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2.5">
                            {/* QR CODE DISPLAY */}
                            <div className="border border-black p-0.5 bg-white rounded shadow-2xs shrink-0">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`PALETTE|${p.id}|${p.gammeId}|${p.gammeName}|${p.type}|${p.entries.filter(e => (e.quantityDay + e.quantityNight) > 0).map(e => `${e.perfume}:${e.quantityDay + e.quantityNight}`).join(';')}`)}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-semibold text-gray-500 block">Opérateur :</span>
                              <span className="text-xs font-bold block truncate max-w-[100px]">{p.agentName}</span>
                              <span className="text-[8px] text-indigo-600 font-black block mt-0.5 uppercase tracking-tighter">SCAN POUR INVENTAIRE</span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-black text-gray-800 block">TOTAL PALETTE</span>
                            <span className="text-3xl font-black font-mono text-indigo-700">
                              {totalPaletteQty} <span className="text-xs font-semibold lowercase text-indigo-600 font-sans tracking-wide">carton</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                          <span>Date: {new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
                          <span>Heure: {new Date(p.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false})}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Fill empty spots on page if less than 4 */}
                {Array.from({ length: 4 - pagePalettes.length }).map((_, idx) => (
                  <div 
                    key={`empty-${idx}`} 
                    className="border-2 border-dashed border-gray-200 rounded flex flex-col justify-center items-center opacity-30 select-none bg-slate-50"
                  >
                    <Tag className="w-8 h-8 text-slate-300" />
                    <span className="text-[10px] text-slate-400 font-semibold mt-1">Étiquette vide</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRINT STYLING TARGETS (Absolute layout for high quality printing) */}
      {pendingPrint && chunkedPages.length > 0 && createPortal(
        <div className="hidden print:block bg-white text-black w-full" id="print-tags-pane">
          {chunkedPages.map((page, pageIdx) => (
            <div key={pageIdx} className="page-break-after p-2 h-[26.8cm] flex flex-col justify-between bg-white" style={{ pageBreakAfter: 'always' }}>
              <div className="grid grid-cols-2 gap-4 h-full">
                {page.map((p) => {
                  const totalPaletteQty = p.entries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);
                  return (
                    <div 
                      key={p.id} 
                      className="border-[3px] border-black p-4 flex flex-col justify-between h-[12.8cm] rounded bg-white text-black font-sans relative break-inside-avoid print:break-inside-avoid shadow-none"
                    >
                      <div className="flex items-start justify-between border-b-2 border-black pb-2">
                        <div>
                          <span className="text-[9px] uppercase font-extrabold tracking-widest text-gray-700 block">PALETTE DE PRODUCTION</span>
                          <span className="text-2xl font-black font-mono">N° {p.numberCode}</span>
                        </div>
                        <div className="text-right">
                          <span className="inline-block border-2 border-black px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-50 text-black">
                            {p.lastUpdatedShift === 'jour' ? '☀️ JOUR' : '🌙 NUIT'}
                          </span>
                        </div>
                      </div>

                      <div className="py-2.5 flex-1 space-y-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">PRODUIT / GAMME :</span>
                          <span className="text-base font-black uppercase tracking-tight block bg-gray-50 border border-slate-400 p-2 rounded text-black">{p.gammeName}</span>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-gray-500 block">SAISIES SHIFT :</span>
                          <div className="border-2 border-black p-2 rounded bg-white space-y-2 flex flex-col">
                            {p.entries.map((e, index) => {
                              const eTot = e.quantityDay + e.quantityNight;
                              return (
                                <div key={index} className="flex justify-between items-center border-b-2 border-slate-200 last:border-0 pb-1.5 last:pb-0">
                                  <span className="font-black uppercase truncate max-w-[150px] text-[14px] text-black tracking-tight">{e.perfume}</span>
                                  <span className="font-black text-right text-[14px] text-black flex items-center gap-2">
                                    {(e.quantityDay > 0 || e.quantityNight > 0) && (
                                      <span className="font-mono text-xs text-slate-800 font-bold bg-slate-100 px-1 py-0.5 rounded border border-slate-300">
                                        {e.quantityDay > 0 && `J: ${e.quantityDay}`}
                                        {e.quantityDay > 0 && e.quantityNight > 0 && ' | '}
                                        {e.quantityNight > 0 && `N: ${e.quantityNight}`}
                                      </span>
                                    )}
                                    <span className="font-black bg-black text-white px-2 py-0.5 rounded text-[13px] tracking-tight min-w-[28px] text-center">
                                      {eTot}
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="border-t-2 border-black pt-2 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2.5">
                            {/* QR CODE DISPLAY */}
                            <div className="border border-black p-0.5 bg-white rounded shadow-2xs shrink-0">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`PALETTE|${p.id}|${p.gammeId}|${p.gammeName}|${p.type}|${p.entries.filter(e => (e.quantityDay + e.quantityNight) > 0).map(e => `${e.perfume}:${e.quantityDay + e.quantityNight}`).join(';')}`)}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <span className="text-[8px] uppercase font-semibold text-gray-500 block">Opérateur :</span>
                              <span className="text-xs font-extrabold block truncate max-w-[100px]">{p.agentName}</span>
                              <span className="text-[8px] text-black font-black block mt-0.5 uppercase tracking-tighter">SCAN POUR INVENTAIRE</span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-extrabold text-gray-700 block">TOTAL PALETTE</span>
                            <span className="text-3xl font-black font-mono">
                              {totalPaletteQty} <span className="text-xs font-semibold lowercase text-gray-700 font-sans tracking-wide">carton</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                          <span>Date: {new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
                          <span>Heure: {new Date(p.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false})}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

    </div>
  );
}
