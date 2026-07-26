/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Gamme, Agent } from '../types';
import { BarChart3, Sun, Moon, Calendar, Filter, Printer, RefreshCw, BarChart, ShoppingBag, Layers, User, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];
const DAY_LABELS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

interface FrenchDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

function FrenchDatePicker({ value, onChange, placeholder = "Sélectionner" }: FrenchDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize view date to the value or today
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  // Keep viewDate synced if value changes and popover is closed
  useEffect(() => {
    if (value && !isOpen) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
      }
    }
  }, [value, isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Days in month
  const firstDayOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstDayOfMonth.getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isSelected: boolean }[] = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const dNum = prevTotalDays - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    cells.push({
      dateStr: dStr,
      dayNum: dNum,
      isCurrentMonth: false,
      isSelected: dStr === value
    });
  }

  // Current month days
  for (let dNum = 1; dNum <= totalDays; dNum++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    cells.push({
      dateStr: dStr,
      dayNum: dNum,
      isCurrentMonth: true,
      isSelected: dStr === value
    });
  }

  // Next month padding
  const remainingCells = 42 - cells.length;
  for (let dNum = 1; dNum <= remainingCells; dNum++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    cells.push({
      dateStr: dStr,
      dayNum: dNum,
      isCurrentMonth: false,
      isSelected: dStr === value
    });
  }

  const handleSelect = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const yStr = today.getFullYear();
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    onChange(`${yStr}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  const formattedValue = value ? value.split('-').reverse().join('/') : placeholder;

  return (
    <div className="relative inline-block w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none text-slate-700 cursor-pointer flex items-center justify-between transition-colors min-h-[32px]"
      >
        <span className="truncate">{formattedValue}</span>
        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 md:left-auto md:w-64 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 select-none">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 capitalize">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[10px] font-bold text-slate-400">
            {DAY_LABELS.map((label, idx) => (
              <div key={idx} className="py-0.5">{label}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(cell.dateStr)}
                className={`
                  aspect-square flex items-center justify-center text-[10px] font-semibold rounded-lg cursor-pointer transition-colors
                  ${cell.isSelected
                    ? 'bg-indigo-600 text-white font-bold animate-pulse'
                    : cell.isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
                  }
                `}
              >
                {cell.dayNum}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 mt-2.5 pt-2 text-[10px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatistiquesProps {
  palettes: Palette[];
  gammes: Gamme[];
  agents: Agent[];
  currentUser: { name: string; id: string; isAdmin: boolean };
}

export default function Statistiques({ palettes, gammes, agents, currentUser }: StatistiquesProps) {
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [pendingPrint, setPendingPrint] = useState<boolean>(false);

  // Reliable print effect triggered after DOM finishes rendering
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

  // Filters state
  const [shiftFilter, setShiftFilter] = useState<'jour' | 'nuit' | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'custom' | 'range' | 'all'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [gammeFilter, setGammeFilter] = useState<string>('all');
  const [perfumeFilter, setPerfumeFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  // If normal operator, lock agent filter to themselves for "personal stats"
  const activeAgentFilter = useMemo(() => {
    if (!currentUser.isAdmin) {
      return currentUser.id;
    }
    return agentFilter;
  }, [currentUser, agentFilter]);

  // Compute available perfumes list based on Gamme filter
  const availablePerfumes = useMemo(() => {
    if (gammeFilter === 'all') {
      // Return unique set of all perfumes across all gammes
      const all: string[] = [];
      gammes.forEach(g => all.push(...g.perfumes));
      return Array.from(new Set(all));
    }
    const target = gammes.find(g => g.id === gammeFilter);
    return target ? target.perfumes : [];
  }, [gammeFilter, gammes]);

  // Filter computation
  const filteredPalettes = useMemo(() => {
    return palettes
      .map(p => {
        if (perfumeFilter !== 'all') {
          return {
            ...p,
            entries: p.entries.filter(e => e.perfume === perfumeFilter)
          };
        }
        return p;
      })
      .filter(p => {
        // 1. Operator filter (Force personal view if not Admin)
        if (activeAgentFilter !== 'all' && p.agentId !== activeAgentFilter) {
          return false;
        }

        // 2. Shift filter
        if (shiftFilter !== 'all' && p.lastUpdatedShift !== shiftFilter) {
          return false;
        }

        // 3. Product line (Gamme) filter
        if (gammeFilter !== 'all' && p.gammeId !== gammeFilter) {
          return false;
        }

        // 4. Individual Perfume filter
        if (perfumeFilter !== 'all' && p.entries.length === 0) {
          return false;
        }

        // 5. Date filter
        if (dateFilter !== 'all') {
          const pDate = new Date(p.createdAt);
          const now = new Date();
          if (dateFilter === 'today') {
            return pDate.toDateString() === now.toDateString();
          } else if (dateFilter === 'week') {
            const diffTime = Math.abs(now.getTime() - pDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 7;
          } else if (dateFilter === 'custom' && customDate) {
            const year = pDate.getFullYear();
            const month = String(pDate.getMonth() + 1).padStart(2, '0');
            const day = String(pDate.getDate()).padStart(2, '0');
            const pDateStr = `${year}-${month}-${day}`;
            return pDateStr === customDate;
          } else if (dateFilter === 'range') {
            const year = pDate.getFullYear();
            const month = String(pDate.getMonth() + 1).padStart(2, '0');
            const day = String(pDate.getDate()).padStart(2, '0');
            const pDateStr = `${year}-${month}-${day}`;
            if (startDate && endDate) {
              return pDateStr >= startDate && pDateStr <= endDate;
            } else if (startDate) {
              return pDateStr >= startDate;
            } else if (endDate) {
              return pDateStr <= endDate;
            }
          }
        }

        return true;
      });
  }, [palettes, activeAgentFilter, shiftFilter, gammeFilter, perfumeFilter, dateFilter, customDate, startDate, endDate]);

  // Key stats calculations
  const stats = useMemo(() => {
    let totalQty = 0;
    let dayQty = 0;
    let nightQty = 0;
    const perfumeCounts: { [name: string]: number } = {};
    const gammeCounts: { [name: string]: number } = {};

    filteredPalettes.forEach(p => {
      let pTot = 0;
      p.entries.forEach(e => {
        const entryTot = e.quantityDay + e.quantityNight;
        totalQty += entryTot;
        dayQty += e.quantityDay;
        nightQty += e.quantityNight;
        pTot += entryTot;

        perfumeCounts[e.perfume] = (perfumeCounts[e.perfume] || 0) + entryTot;
      });

      gammeCounts[p.gammeName] = (gammeCounts[p.gammeName] || 0) + pTot;
    });

    // Sort popular perfumes
    const popularPerfumes = Object.entries(perfumeCounts)
      .map(([name, val]) => ({ name, value: val }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const popularGammes = Object.entries(gammeCounts)
      .map(([name, val]) => ({ name, value: val }))
      .sort((a, b) => b.value - a.value);

    return {
      palettesCount: filteredPalettes.length,
      totalQty,
      dayQty,
      nightQty,
      popularPerfumes,
      popularGammes
    };
  }, [filteredPalettes]);

  // Hourly production trend for SVG bar chart rendering
  const hourlyTrend = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const hr = (i * 2 + 6) % 24; // starting from 06:00 onwards
      return { hourLabel: `${hr}h`, val: 0 };
    });

    filteredPalettes.forEach(p => {
      const hr = new Date(p.createdAt).getHours();
      // map hour into one of our 12 intervals
      const intervalIdx = Math.floor(((hr - 6 + 24) % 24) / 2);
      if (intervalIdx >= 0 && intervalIdx < 12) {
        const pQty = p.entries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);
        hours[intervalIdx].val += pQty;
      }
    });

    const maxVal = Math.max(...hours.map(h => h.val), 1);
    return hours.map(h => ({
      ...h,
      pct: (h.val / maxVal) * 80 + 5 // percentage scale for bars
    }));
  }, [filteredPalettes]);

  // Simple product-perfume-quantity matrix for printing
  const productPerfumeMatrix = useMemo(() => {
    const map: { [key: string]: { product: string; perfume: string; qty: number } } = {};
    
    filteredPalettes.forEach(p => {
      p.entries.forEach(e => {
        const total = e.quantityDay + e.quantityNight;
        if (total === 0) return;
        const key = `${p.gammeName}|||${e.perfume}`;
        if (!map[key]) {
          map[key] = {
            product: p.gammeName,
            perfume: e.perfume,
            qty: total
          };
        } else {
          map[key].qty += total;
        }
      });
    });

    return Object.values(map).sort((a, b) => {
      const cmp = a.product.localeCompare(b.product);
      if (cmp !== 0) return cmp;
      return a.perfume.localeCompare(b.perfume);
    });
  }, [filteredPalettes]);

  // Max info about active filters
  const dateIntervalInfo = useMemo(() => {
    if (dateFilter === 'today') {
      return `Aujourd'hui, le ${new Date().toLocaleDateString('fr-FR')}`;
    }
    if (dateFilter === 'week') {
      const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toLocaleDateString('fr-FR');
      const end = new Date().toLocaleDateString('fr-FR');
      return `7 derniers jours (du ${start} au ${end})`;
    }
    if (dateFilter === 'custom' && customDate) {
      const parts = customDate.split('-');
      if (parts.length === 3) {
        return `Le ${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return `Le ${customDate}`;
    }
    if (dateFilter === 'range') {
      const startStr = startDate ? startDate.split('-').reverse().join('/') : '...';
      const endStr = endDate ? endDate.split('-').reverse().join('/') : '...';
      return `Du ${startStr} au ${endStr}`;
    }
    // 'all'
    if (filteredPalettes.length === 0) {
      return "Toutes dates";
    }
    const dates = filteredPalettes.map(p => new Date(p.createdAt).getTime());
    const minD = new Date(Math.min(...dates)).toLocaleDateString('fr-FR');
    const maxD = new Date(Math.max(...dates)).toLocaleDateString('fr-FR');
    if (minD === maxD) {
      return `Le ${minD}`;
    }
    return `Du ${minD} au ${maxD}`;
  }, [dateFilter, customDate, startDate, endDate, filteredPalettes]);

  const handlePrint = () => {
    setPendingPrint(true);
  };

  const resetFilters = () => {
    setShiftFilter('all');
    setDateFilter('all');
    setCustomDate('');
    setStartDate('');
    setEndDate('');
    setGammeFilter('all');
    setPerfumeFilter('all');
    setAgentFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5.5 h-5.5 text-indigo-600" /> 
            {currentUser.isAdmin ? "Tableau de Bord & Statistiques" : "Vos Statistiques Personnelles"}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {currentUser.isAdmin 
              ? "Vision d'ensemble sur l'avancement de production et de conditionnement"
              : `Consultez votre volume de palettes préparées en tant qu'opérateur`
            }
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap justify-end">
          <button
            onClick={resetFilters}
            className="p-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer font-semibold"
            title="Effacer tous les filtres"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 bg-indigo-600 font-semibold text-white rounded-xl text-xs hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" /> Afficher l'Aperçu avant Impression
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5 bg-white"
          >
            Imprimer
          </button>
        </div>
      </div>

      {/* FILTERS CARD */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Options de Filtre
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Shift Filter */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Shift équipe</span>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Tous les Shifts</option>
              <option value="jour">Shift Jour ☀️</option>
              <option value="nuit">Shift Nuit 🌙</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Période</span>
            <div className="flex flex-col gap-1.5">
              <select
                value={dateFilter}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setDateFilter(val);
                  if (val === 'custom' && !customDate) {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    setCustomDate(`${year}-${month}-${day}`);
                  } else if (val === 'range') {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    const formatted = `${year}-${month}-${day}`;
                    if (!startDate) setStartDate(formatted);
                    if (!endDate) setEndDate(formatted);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 cursor-pointer"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Derniers 7 jours</option>
                <option value="custom">Date précise... 📅</option>
                <option value="range">Choisir une période... 🗓️</option>
              </select>

               {dateFilter === 'custom' && (
                <FrenchDatePicker
                  value={customDate}
                  onChange={(val) => setCustomDate(val)}
                  placeholder="Choisir date"
                />
              )}

              {dateFilter === 'range' && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-400 font-medium pl-0.5">Du:</span>
                    <FrenchDatePicker
                      value={startDate}
                      onChange={(val) => setStartDate(val)}
                      placeholder="Du"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-400 font-medium pl-0.5">Au:</span>
                    <FrenchDatePicker
                      value={endDate}
                      onChange={(val) => setEndDate(val)}
                      placeholder="Au"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gamme Filter */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Gamme / Produit</span>
            <select
              value={gammeFilter}
              onChange={(e) => {
                setGammeFilter(e.target.value);
                setPerfumeFilter('all'); // Recalibrate perfume filter
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Toutes les gammes</option>
              {gammes.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Perfume Filter */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Parfum</span>
            <select
              value={perfumeFilter}
              onChange={(e) => setPerfumeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Tous les parfums</option>
              {availablePerfumes.map((perfume, idx) => (
                <option key={idx} value={perfume}>{perfume}</option>
              ))}
            </select>
          </div>

          {/* Agent Filter (Admin Only) */}
          {currentUser.isAdmin ? (
            <div className="col-span-2 md:col-span-1 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Opérateur</span>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 cursor-pointer"
              >
                <option value="all">Tous les agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Votre Compte</span>
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 truncate">
                {currentUser.name}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* METRICS COUNT Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Palettes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] tracking-wider uppercase font-bold text-slate-400 block">Total Palettes</span>
            <span className="text-2xl font-black font-sans text-slate-800">{stats.palettesCount}</span>
          </div>
        </div>

        {/* Total Units */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] tracking-wider uppercase font-bold text-slate-400 block">Total Quantité</span>
            <span className="text-2xl font-black font-mono text-slate-800">{stats.totalQty} u.</span>
          </div>
        </div>

        {/* Day Shift split */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] tracking-wider uppercase font-bold text-slate-400 block">Volume Jour</span>
            <span className="text-xl font-bold font-mono text-slate-800">{stats.dayQty} u.</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ({stats.totalQty > 0 ? Math.round((stats.dayQty / stats.totalQty) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Night Shift split */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] tracking-wider uppercase font-bold text-slate-400 block">Volume Nuit</span>
            <span className="text-xl font-bold font-mono text-slate-800">{stats.nightQty} u.</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ({stats.totalQty > 0 ? Math.round((stats.nightQty / stats.totalQty) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>

      {/* VISUALS ANALYTICS GRID */}
      {filteredPalettes.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-100 text-center text-slate-450 text-xs italic">
          Sélectionnez d'autres critères de filtre. Aucune palette enregistrée ne correspond à la recherche.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Trend chart card (using high-end custom responsive SVG visualizer) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Profil d'Activité de Production</h3>
              <p className="text-slate-400 text-[10px]">Quantités d'unités emballées par tranches horaires de 2 heures (départ 06:00)</p>
            </div>

            {/* Custom SVG Bar Graph */}
            <div className="h-60 w-full relative flex items-end justify-between border-b border-l border-slate-150 pb-2 pt-6 pl-2 pr-1">
              {hourlyTrend.map((pt, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-xs pointer-events-none z-10 whitespace-nowrap">
                    {pt.val} u
                  </div>
                  {/* Dynamic column colored depending on production spikes */}
                  <div 
                    className="w-4 sm:w-6 lg:w-8 bg-indigo-500 rounded-t-sm group-hover:bg-indigo-600 transition-all duration-300 shadow-2xs shadow-indigo-200"
                    style={{ height: `${pt.pct}%` }}
                  />
                  <span className="text-[9px] font-mono text-slate-400 mt-2 font-bold">{pt.hourLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Popular lists */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Palmarès des Parfums</h3>
              <p className="text-slate-400 text-[10px]">Classement des parfums les plus conditionnés</p>
            </div>

            {stats.popularPerfumes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucune donnée disponible</p>
            ) : (
              <div className="space-y-4">
                {stats.popularPerfumes.map((perf, index) => {
                  const maxVal = stats.popularPerfumes[0].value || 1;
                  const pct = Math.round((perf.value / maxVal) * 100);
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 truncate max-w-[150px]">{perf.name}</span>
                        <span className="font-semibold text-slate-500 font-mono">{perf.value} units</span>
                      </div>
                      <div className="w-full bg-slate-50 rounded-full h-2 overflow-hidden border border-slate-100/40">
                        <div 
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Filtered Records log table */}
      {filteredPalettes.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-0.5">Détail des pièces d'activité filtrées</h3>
            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">{filteredPalettes.length} palettes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-405 uppercase tracking-wider text-[9px] font-bold">
                  <th className="py-2.5">Palette Code</th>
                  <th className="py-2.5">Gamme</th>
                  <th className="py-2.5">Type</th>
                  <th className="py-2.5">Détails compositions</th>
                  <th className="py-2.5">Shift</th>
                  <th className="py-2.5">Opérateur</th>
                  <th className="py-2.5 text-right">Création</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {filteredPalettes.map(p => {
                  const total = p.entries.reduce((sum, e) => sum + e.quantityDay + e.quantityNight, 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold font-mono text-indigo-600">N° {p.numberCode}</td>
                      <td className="py-3 font-semibold">{p.gammeName}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                          p.type === 'mono' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1 max-w-sm">
                          {p.entries.map((e, idx) => (
                            <div key={idx} className="flex gap-1">
                              <span className="font-semibold text-slate-800">{e.perfume}</span>
                              <span className="text-slate-400 font-mono">
                                (J: {e.quantityDay} / N: {e.quantityNight})
                              </span>
                            </div>
                          ))}
                          <span className="text-[10px] font-semibold font-mono text-slate-500">Total : {total} Carton</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="capitalize font-semibold text-xs inline-flex items-center gap-1">
                          {p.lastUpdatedShift === 'jour' ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-purple-500" />}
                          {p.lastUpdatedShift}
                        </span>
                      </td>
                      <td className="py-3 font-semibold inline-flex items-center gap-1 mt-1.5"><User className="w-3.5 h-3.5 text-slate-450" />{p.agentName}</td>
                      <td className="py-3 text-right text-slate-400 font-mono">
                        {new Date(p.createdAt).toLocaleDateString('fr-FR')} {new Date(p.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STATISTICAL REPORT - PRINT-ONLY PORT */}
      {pendingPrint && createPortal(
        <div className="hidden print:block bg-white text-black p-0" id="print-stats-area">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-0 font-normal">
                  <div className="flex justify-between items-start border-b border-black pb-4 mb-6 text-left">
                    <div>
                      <h1 className="text-xl font-black uppercase tracking-tight font-sans">Rapport Statistique de Production</h1>
                      <p className="text-gray-500 text-[10px] mt-1 font-sans">Émis le {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', hour12: false})}</p>
                    </div>
                    <div className="text-right text-[10px] font-sans">
                      <p className="font-bold text-slate-900">Opérateur demandeur : {currentUser.name}</p>
                      <p className="text-gray-500">Statut : {currentUser.isAdmin ? 'Administrateur' : 'Opérateur'}</p>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-0">
                  <div className="space-y-6 font-sans text-xs">
                    {/* Selected Filtres overview with maximum details */}
                    <div className="bg-slate-50 border border-black p-4 rounded-xl space-y-3 break-inside-avoid print:break-inside-avoid text-left">
                      <p className="font-extrabold uppercase tracking-wider text-xs border-b pb-1 text-slate-800">
                        Informations de Filtrage & Paramètres Appliqués
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[10px]">
                        <div><span className="font-bold">Date / Période :</span> {dateIntervalInfo}</div>
                        <div><span className="font-bold">Shift de travail :</span> {shiftFilter === 'all' ? 'Tous les shifts (Jour & Nuit)' : shiftFilter === 'jour' ? 'Shift Jour uniquement' : 'Shift Nuit uniquement'}</div>
                        <div><span className="font-bold">Gamme de produit :</span> {gammeFilter === 'all' ? 'Toutes les gammes' : (gammes.find(g => g.id === gammeFilter)?.name || gammeFilter)}</div>
                        <div><span className="font-bold">Parfum spécifique :</span> {perfumeFilter === 'all' ? 'Toutes compositions' : perfumeFilter}</div>
                        <div><span className="font-bold">Opérateur / Saisie :</span> {activeAgentFilter === 'all' ? 'Tous les opérateurs' : (agents.find(a => a.id === activeAgentFilter)?.name || currentUser.name)}</div>
                        <div><span className="font-bold">Palettes totales concernées :</span> {stats.palettesCount} palettes</div>
                      </div>
                      <div className="border-t pt-2 font-mono text-[10px] grid grid-cols-3 gap-2">
                        <div><span className="font-bold">Volume Global :</span> {stats.totalQty} Carton</div>
                        <div><span className="font-bold">Volume Jour :</span> {stats.dayQty} Carton</div>
                        <div><span className="font-bold">Volume Nuit :</span> {stats.nightQty} Carton</div>
                      </div>
                    </div>

                    {/* Simple Product - Perfume - Quantity array */}
                    <div className="space-y-3 text-left">
                      <h2 className="text-sm font-extrabold border-b border-black pb-1 uppercase tracking-wide">
                        Tableau de Conditionnement (Produit – Parfum – Quantité)
                      </h2>
                      <table className="w-full text-left text-xs border border-collapse border-black">
                        <thead>
                          <tr className="border-b border-black bg-slate-100 font-bold uppercase text-[10px]">
                            <th className="py-2 px-3 border-r border-black">Produit (Gamme)</th>
                            <th className="py-2 px-3 border-r border-black">Parfum</th>
                            <th className="py-2 px-3 text-right">Quantité Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                          {productPerfumeMatrix.map((item, idx) => (
                            <tr key={idx} className="break-inside-avoid print:break-inside-avoid">
                              <td className="py-2.5 px-3 border-r border-black font-semibold">{item.product}</td>
                              <td className="py-2.5 px-3 border-r border-black">{item.perfume}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">{item.qty} Carton</td>
                            </tr>
                          ))}
                          {productPerfumeMatrix.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-8 text-center italic text-gray-500">Aucune donnée avec ces filtres</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Signature block floating seamlessly */}
                    <div className="break-inside-avoid print:break-inside-avoid pt-6 border-t border-black flex justify-between items-center text-[10px] text-slate-500 font-sans">
                      <div>
                        <p className="font-bold text-slate-700 uppercase">Rapport de Production Validé</p>
                        <p className="text-slate-400 mt-0.5">Certifié sous réserve de modification par l'administrateur</p>
                      </div>
                      <div className="w-36 h-12 border border-dashed border-slate-300 rounded flex items-center justify-center italic text-slate-300 font-serif">
                        Signature Admin
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
                <h3 className="text-sm font-bold text-slate-900 font-semibold font-sans">Aperçu avant Impression — Activité de Production</h3>
                <p className="text-[11px] text-slate-500 font-sans">Visualisation exacte du rapport d'activité destiné à l'impression</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPendingPrint(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" /> Imprimer Réellement
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Simulated Paper Sheet */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <div className="bg-white border border-slate-300 w-full max-w-3xl p-8 rounded-xl shadow-md min-h-[20cm] flex flex-col justify-between text-slate-800 relative font-sans">
                
                {/* Simulated Stamp indicator */}
                <div className="absolute top-8 right-8 border border-slate-400 rounded-lg px-2 py-1 text-[10px] uppercase font-bold text-slate-500 rotate-3">
                  Rapport Conforme
                </div>

                <div className="space-y-6">
                  {/* Print Document Header */}
                  <div className="flex justify-between items-start border-b border-slate-300 pb-5">
                    <div>
                      <h1 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase font-sans">Rapport Statistique de Production</h1>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-sans">
                        <span className="font-semibold text-slate-700">YETISTOCK SUIVI</span>
                        <span>•</span>
                        <span>Récapitulatif Global de Conditionnement</span>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-600 space-y-0.5 font-sans">
                      <p className="font-bold text-slate-900">Agent connecté : {currentUser.name}</p>
                      <p>Généré le : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', hour12: false})}</p>
                    </div>
                  </div>

                  {/* Filter overview badge with maximum details */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[10px] text-slate-600 space-y-3 font-sans break-inside-avoid text-left">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Paramètres de filtrage actifs :
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                      <p><span className="font-bold text-slate-700">Date / Période :</span> {dateIntervalInfo}</p>
                      <p><span className="font-bold text-slate-700">Shift :</span> {shiftFilter === 'all' ? 'TOUS (JOUR & NUIT)' : shiftFilter.toUpperCase()}</p>
                      <p><span className="font-bold text-slate-700">Gamme :</span> {gammeFilter === 'all' ? 'TOUTES' : (gammes.find(g => g.id === gammeFilter)?.name || gammeFilter).toUpperCase()}</p>
                      <p><span className="font-bold text-slate-700">Parfum :</span> {perfumeFilter.toUpperCase()}</p>
                      <p><span className="font-bold text-slate-700">Opérateur :</span> {(activeAgentFilter === 'all' ? 'TOUS' : (agents.find(a => a.id === activeAgentFilter)?.name || currentUser.name)).toUpperCase()}</p>
                      <p><span className="font-bold text-slate-700">Palettes filtrées :</span> {stats.palettesCount}</p>
                    </div>
                    <div className="border-t border-slate-200 pt-2 font-mono text-[9px] grid grid-cols-3 gap-2">
                      <p><span className="font-bold text-slate-700">Volume Global :</span> {stats.totalQty} Carton</p>
                      <p><span className="font-bold text-slate-700">Volume Jour :</span> {stats.dayQty} Carton</p>
                      <p><span className="font-bold text-slate-700">Volume Nuit :</span> {stats.nightQty} Carton</p>
                    </div>
                  </div>

                  {/* Simple Product - Perfume - Quantity table representation */}
                  <div className="space-y-3 font-sans text-left">
                    <h3 className="text-xs font-bold text-slate-900 border-b border-slate-300 pb-1.5 uppercase font-sans tracking-wide">
                      Recensement de Production (Produit – Parfum – Quantité)
                    </h3>
                    <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-3 border border-slate-200">Produit (Gamme)</th>
                          <th className="py-2.5 px-3 border border-slate-200">Parfum</th>
                          <th className="py-2.5 px-3 border border-slate-200 text-right font-sans">Quantité</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-700 bg-white">
                        {productPerfumeMatrix.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/20 break-inside-avoid">
                            <td className="py-2.5 px-3 border border-slate-100 font-semibold">{item.product}</td>
                            <td className="py-0 px-3 border border-slate-100 font-medium text-slate-600">{item.perfume}</td>
                            <td className="py-2 px-3 border border-slate-100 text-right font-mono font-bold text-indigo-600">{item.qty} Carton</td>
                          </tr>
                        ))}
                        {productPerfumeMatrix.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-6 text-center italic text-slate-400">Aucune donnée correspondante</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Simulated signature box */}
                <div className="border-t border-slate-200 pt-5 flex justify-between items-center text-[10px] text-slate-500 mt-10 font-sans">
                  <div>
                    <p className="font-bold text-slate-700 uppercase font-sans">Rapport de Production Validé</p>
                    <p className="text-slate-400 mt-0.5 font-sans">Certifié sous réserve de modification par l'administrateur</p>
                  </div>
                  <div className="w-36 h-12 border border-dashed border-slate-300 rounded flex items-center justify-center italic text-slate-300 font-serif">
                    Signature Admin
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
