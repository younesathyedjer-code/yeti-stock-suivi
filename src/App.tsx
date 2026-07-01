/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from './hooks/useAppState';
import PinPad from './components/PinPad';
import SaisiePalette from './components/SaisiePalette';
import Inventaire from './components/Inventaire';
import Etiquettes from './components/Etiquettes';
import Statistiques from './components/Statistiques';
import EspaceAdmin from './components/EspaceAdmin';

import { 
  Droplet, LogOut, User, FolderLock, LayoutGrid, 
  Tag, ClipboardList, BarChart3, Settings, ShieldCheck, Sparkles 
} from 'lucide-react';

export default function App() {
  const {
    agents,
    gammes,
    palettes,
    inventories,
    currentUser,
    currentPaletteSeq,
    registerFirstAdmin,
    loginWithPin,
    logout,
    addAgent,
    updateAgent,
    deleteAgent,
    addGamme,
    updateGamme,
    deleteGamme,
    addMonoPalette,
    addMixtePalette,
    deletePalette,
    updatePalette,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    resetAllPalettes,
  } = useAppState();

  // Force document title for printing or browser tabs
  useEffect(() => {
    document.title = 'YETISTOCK SUIVI';
  }, []);

  // Active view state
  const [activeTab, setActiveTab] = useState<string>('saisie');

  // If there's no connected user, force login / PinPad setup
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center">
        <PinPad
          agentsCount={agents.length}
          onLogin={loginWithPin}
          onRegisterFirstAdmin={registerFirstAdmin}
        />
      </div>
    );
  }

  // Determine authorized tabs
  // Operators can only see: Saisie Palette, Inventaire, Stats Personnelles
  const isUserAdmin = currentUser.isAdmin;

  // Key generator to force component recreation when gammes (nomenclature) changes
  const gammesKey = gammes.map(g => `${g.id}-${g.name}-${g.perfumes.length}-${g.standardQuantity ?? 100}`).join('_');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between print-container">
      {/* Visual Navigation Header */}
      <header className="bg-white border-b border-slate-100 shadow-2xs sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Left Title Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Droplet className="w-5.5 h-5.5 fill-white/10" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none uppercase">YETISTOCK SUIVI</h1>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase block mt-1">Gestion de Palettes</span>
            </div>
          </div>

          {/* Connected User Badge */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
                {isUserAdmin ? (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-150 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="bg-slate-50 border border-slate-205 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Agent Opérateur
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">ID: {currentUser.pin}</span>
            </div>

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-600 border border-slate-100 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
              title="Déconnecter la session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Tab system navigation */}
        <div className="bg-slate-50 border-t border-slate-150/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 py-1.5 overflow-x-auto scrollbar-none">
              
              <button
                onClick={() => setActiveTab('saisie')}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'saisie'
                    ? 'bg-white text-emerald-700 shadow-sm font-bold border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ClipboardList className={`w-4 h-4 ${activeTab === 'saisie' ? 'text-emerald-600' : 'text-slate-400'}`} />
                Saisie Palette
              </button>

              <button
                onClick={() => setActiveTab('inventaire')}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'inventaire'
                    ? 'bg-white text-emerald-700 shadow-sm font-bold border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className={`w-4 h-4 ${activeTab === 'inventaire' ? 'text-emerald-600' : 'text-slate-400'}`} />
                Inventaire
              </button>

              {/* Normal operators also have direct access to labels printing tab */}
              <button
                onClick={() => setActiveTab('etiquettes')}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'etiquettes'
                    ? 'bg-white text-emerald-700 shadow-sm font-bold border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Tag className={`w-4 h-4 ${activeTab === 'etiquettes' ? 'text-emerald-600' : 'text-slate-400'}`} />
                Étiquettes
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'stats'
                    ? 'bg-white text-emerald-700 shadow-sm font-bold border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className={`w-4 h-4 ${activeTab === 'stats' ? 'text-emerald-600' : 'text-slate-400'}`} />
                {isUserAdmin ? "Statistiques Globales" : "Vos Statistiques"}
              </button>

              {isUserAdmin && (
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-4.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer flex items-center gap-2 whitespace-nowrap transition-all ${
                    activeTab === 'config'
                      ? 'bg-white text-emerald-700 shadow-sm font-bold border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Settings className={`w-4 h-4 ${activeTab === 'config' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  Espace Admin
                </button>
              )}

            </nav>
          </div>
        </div>
      </header>

      {/* Main tab content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 no-print">
        {activeTab === 'saisie' && (
          <SaisiePalette
            key={`saisie-${gammesKey}`}
            gammes={gammes}
            palettes={palettes}
            currentSeqNum={currentPaletteSeq}
            onAddMono={addMonoPalette}
            onAddMixte={addMixtePalette}
            onDeletePalette={deletePalette}
            onUpdatePalette={updatePalette}
            agentName={currentUser.name}
          />
        )}

        {activeTab === 'inventaire' && (
          <Inventaire
            key={`inventaire-${gammesKey}`}
            gammes={gammes}
            inventories={inventories}
            currentUser={currentUser}
            onAddInventoryItem={addInventoryItem}
            onUpdateInventoryItem={updateInventoryItem}
            onDeleteInventoryItem={deleteInventoryItem}
          />
        )}

        {activeTab === 'etiquettes' && (
          <Etiquettes
            palettes={palettes}
          />
        )}

        {activeTab === 'stats' && (
          <Statistiques
            palettes={palettes}
            gammes={gammes}
            agents={agents}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'config' && isUserAdmin && (
          <EspaceAdmin
            agents={agents}
            gammes={gammes}
            inventories={inventories}
            currentUser={currentUser}
            onAddAgent={addAgent}
            onUpdateAgent={updateAgent}
            onDeleteAgent={deleteAgent}
            onAddGamme={addGamme}
            onUpdateGamme={updateGamme}
            onDeleteGamme={deleteGamme}
            onResetAllPalettes={resetAllPalettes}
            onDeleteInventoryItem={deleteInventoryItem}
          />
        )}
      </main>

      {/* Footer credits block (Humble, clean, and proportional) */}
      <footer className="py-5 text-center text-[10px] text-slate-500 border-t border-slate-200 bg-white no-print">
        <p className="font-semibold select-none uppercase tracking-widest text-slate-400">© 25 YETISTOCK SUIVI — Gestion de Conditionnement de Parfums</p>
      </footer>
    </div>
  );
}
