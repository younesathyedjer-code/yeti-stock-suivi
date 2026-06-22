/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Agent, Gamme, InventoryItem } from '../types';
import { 
  Users, Layers, Settings, ShieldAlert, Plus, Edit2, Trash2, 
  Check, X, ShieldCheck, Sparkles, Key, AlertOctagon, HelpCircle,
  ClipboardCheck, Printer, Eye, Clock, User
} from 'lucide-react';

interface EspaceAdminProps {
  agents: Agent[];
  gammes: Gamme[];
  inventories: InventoryItem[];
  currentUser: Agent;
  onAddAgent: (name: string, pin: string, isAdmin: boolean) => void;
  onUpdateAgent: (id: string, name: string, pin: string, isAdmin: boolean) => void;
  onDeleteAgent: (id: string) => void;
  onAddGamme: (name: string, perfumes: string[], standardQuantity?: number, perfumeAbbreviations?: Record<string, string>) => void;
  onUpdateGamme: (id: string, name: string, perfumes: string[], standardQuantity?: number, perfumeAbbreviations?: Record<string, string>) => void;
  onDeleteGamme: (id: string) => void;
  onResetAllPalettes: () => void;
  onDeleteInventoryItem: (id: string) => void;
}

export interface AgentConsolidatedInventory {
  id: string; // agentId
  numberCode: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  type: 'global';
  entries: {
    gammeId: string;
    gammeName: string;
    perfume: string;
    quantity: number;
  }[];
}

// Helper to group inventories by agent and consolidate their entries
export const getConsolidatedInventories = (allInventories: InventoryItem[]): AgentConsolidatedInventory[] => {
  const agentMap: Record<string, {
    agentId: string;
    agentName: string;
    createdAt: string;
    rawItems: InventoryItem[];
  }> = {};

  allInventories.forEach(item => {
    if (!agentMap[item.agentId]) {
      agentMap[item.agentId] = {
        agentId: item.agentId,
        agentName: item.agentName,
        createdAt: item.createdAt,
        rawItems: []
      };
    }
    agentMap[item.agentId].rawItems.push(item);
    if (new Date(item.createdAt) > new Date(agentMap[item.agentId].createdAt)) {
      agentMap[item.agentId].createdAt = item.createdAt;
    }
  });

  // Sort agents chronologically based on their latest inventory entry time DESC (most recent first)
  const sortedAgents = Object.values(agentMap).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sortedAgents.map((agentGroup, index) => {
    const numCode = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
    
    // Sum quantities by [gammeId + ':' + perfume]
    const sumMap: Record<string, {
      gammeId: string;
      gammeName: string;
      perfume: string;
      quantity: number;
    }> = {};

    agentGroup.rawItems.forEach(item => {
      item.entries.forEach(entry => {
        const key = `${item.gammeId}:${entry.perfume}`;
        if (!sumMap[key]) {
          sumMap[key] = {
            gammeId: item.gammeId,
            gammeName: item.gammeName,
            perfume: entry.perfume,
            quantity: 0
          };
        }
        sumMap[key].quantity += entry.quantity;
      });
    });

    const entries = Object.values(sumMap).sort((a, b) => {
      const gammeCompare = a.gammeName.localeCompare(b.gammeName);
      if (gammeCompare !== 0) return gammeCompare;
      return a.perfume.localeCompare(b.perfume);
    });

    return {
      id: agentGroup.agentId,
      numberCode: numCode,
      agentId: agentGroup.agentId,
      agentName: agentGroup.agentName,
      createdAt: agentGroup.createdAt,
      type: 'global',
      entries
    };
  });
};

export default function EspaceAdmin({
  agents,
  gammes,
  inventories,
  currentUser,
  onAddAgent,
  onUpdateAgent,
  onDeleteAgent,
  onAddGamme,
  onUpdateGamme,
  onDeleteGamme,
  onResetAllPalettes,
  onDeleteInventoryItem
}: EspaceAdminProps) {
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

  const [activeSubTab, setActiveSubTab] = useState<'agents' | 'gammes' | 'inventaires' | 'maintenance'>('agents');
  
  // Selected inventory for view or print
  const [selectedInvForView, setSelectedInvForView] = useState<AgentConsolidatedInventory | null>(null);
  const [selectedInvForPrint, setSelectedInvForPrint] = useState<AgentConsolidatedInventory | null>(null);

  useEffect(() => {
    if (selectedInvForPrint) {
      const timer = setTimeout(() => {
        window.focus();
        window.print();
        setSelectedInvForPrint(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedInvForPrint]);

  const handlePrintSingleInventory = (item: AgentConsolidatedInventory) => {
    setSelectedInvForPrint(item);
  };

  // Paginate gammes for printing/previews with dynamic height estimation for A4 boundaries
  const getFormattedPrintPagesForAgent = (agentId: string) => {
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

  // Messages states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Agent form state
  const [isAgentFormOpen, setIsAgentFormOpen] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);
  const [agentNameInput, setAgentNameInput] = useState('');
  const [agentPinInput, setAgentPinInput] = useState('');
  const [agentIsAdminInput, setAgentIsAdminInput] = useState(false);

  // Gamme form state
  const [isGammeFormOpen, setIsGammeFormOpen] = useState(false);
  const [editGammeId, setEditGammeId] = useState<string | null>(null);
  const [gammeNameInput, setGammeNameInput] = useState('');
  const [perfumesInput, setPerfumesInput] = useState(''); // comma-separated strings
  const [standardQuantityInput, setStandardQuantityInput] = useState<number>(100);
  const [abbreviationsInput, setAbbreviationsInput] = useState<Record<string, string>>({});

  // Hard maintenance confirm
  const [maintenanceConfirmName, setMaintenanceConfirmName] = useState('');

  // Deletion confirmation states
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [gammeToDelete, setGammeToDelete] = useState<{ id: string; name: string } | null>(null);
  const [inventoryToDelete, setInventoryToDelete] = useState<AgentConsolidatedInventory | null>(null);

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const triggerErrorMsg = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  // --- Operator Actions ---
  const handleOpenNewAgent = () => {
    setEditAgentId(null);
    setAgentNameInput('');
    setAgentPinInput('');
    setAgentIsAdminInput(false);
    setIsAgentFormOpen(true);
    setErrorMsg(null);
  };

  const handleOpenEditAgent = (agent: Agent) => {
    setEditAgentId(agent.id);
    setAgentNameInput(agent.name);
    setAgentPinInput(agent.pin);
    setAgentIsAdminInput(agent.isAdmin);
    setIsAgentFormOpen(true);
    setErrorMsg(null);
  };

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!agentNameInput.trim()) {
      triggerErrorMsg("Le nom complet est obligatoire de saisie.");
      return;
    }
    if (agentPinInput.length < 4) {
      triggerErrorMsg("Le code PIN doit contenir au moins 4 chiffres.");
      return;
    }

    try {
      if (editAgentId) {
        onUpdateAgent(editAgentId, agentNameInput.trim(), agentPinInput, agentIsAdminInput);
        triggerSuccessMsg(`Opérateur "${agentNameInput}" mis à jour.`);
      } else {
        onAddAgent(agentNameInput.trim(), agentPinInput, agentIsAdminInput);
        triggerSuccessMsg(`Opérateur "${agentNameInput}" enregistré avec succès.`);
      }
      setIsAgentFormOpen(false);
    } catch (err: any) {
      triggerErrorMsg(err.message || "Erreur lors de la sauvegarde de l'agent.");
    }
  };

  const handleDeleteAgentEx = (id: string, name: string) => {
    setAgentToDelete({ id, name });
  };

  const confirmDeleteAgent = () => {
    if (!agentToDelete) return;
    try {
      onDeleteAgent(agentToDelete.id);
      triggerSuccessMsg(`Opérateur "${agentToDelete.name}" supprimé.`);
    } catch (err: any) {
      triggerErrorMsg(err.message || "Impossible de supprimer cet opérateur.");
    } finally {
      setAgentToDelete(null);
    }
  };

  // --- Gamme Actions ---
  const handleOpenNewGamme = () => {
    setEditGammeId(null);
    setGammeNameInput('');
    setPerfumesInput('');
    setStandardQuantityInput(100);
    setAbbreviationsInput({});
    setIsGammeFormOpen(true);
    setErrorMsg(null);
  };

  const handleOpenEditGamme = (g: Gamme) => {
    setEditGammeId(g.id);
    setGammeNameInput(g.name);
    setPerfumesInput(g.perfumes.join(', '));
    setStandardQuantityInput(g.standardQuantity || 100);
    setAbbreviationsInput(g.perfumeAbbreviations || {});
    setIsGammeFormOpen(true);
    setErrorMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveGamme = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!gammeNameInput.trim()) {
      triggerErrorMsg("Le nom de la gamme est requis.");
      return;
    }

    const separatedPerfumes = perfumesInput
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (separatedPerfumes.length === 0) {
      triggerErrorMsg("Veuillez saisir au moins un parfum dans la gamme.");
      return;
    }

    const quantityVal = standardQuantityInput > 0 ? standardQuantityInput : 100;

    // Build the clean abbreviation map containing only active perfumes
    const finalAbbreviations: Record<string, string> = {};
    separatedPerfumes.forEach(p => {
      const abbreviation = abbreviationsInput[p]?.trim() || '';
      if (abbreviation) {
        finalAbbreviations[p] = abbreviation.toUpperCase();
      }
    });

    try {
      if (editGammeId) {
        onUpdateGamme(editGammeId, gammeNameInput.trim(), separatedPerfumes, quantityVal, finalAbbreviations);
        triggerSuccessMsg(`Gamme "${gammeNameInput}" mise à jour.`);
      } else {
        onAddGamme(gammeNameInput.trim(), separatedPerfumes, quantityVal, finalAbbreviations);
        triggerSuccessMsg(`Gamme "${gammeNameInput}" configurée.`);
      }
      setIsGammeFormOpen(false);
    } catch (err: any) {
      triggerErrorMsg(err.message || "Erreur de configuration.");
    }
  };

  const handleDeleteGammeEx = (id: string, name: string) => {
    setGammeToDelete({ id, name });
  };

  const confirmDeleteGamme = () => {
    if (!gammeToDelete) return;
    try {
      onDeleteGamme(gammeToDelete.id);
      triggerSuccessMsg(`Gamme "${gammeToDelete.name}" supprimée.`);
    } catch (err: any) {
      triggerErrorMsg(err.message || "Impossible de détruire la gamme.");
    } finally {
      setGammeToDelete(null);
    }
  };

  const confirmDeleteInventory = () => {
    if (!inventoryToDelete) return;
    try {
      const toDelete = inventories.filter(inv => inv.agentId === inventoryToDelete.agentId);
      toDelete.forEach(inv => onDeleteInventoryItem(inv.id));
      triggerSuccessMsg(`L'inventaire de ${inventoryToDelete.agentName} a été supprimé avec succès.`);
    } catch (err: any) {
      triggerErrorMsg("Erreur lors de la suppression de l'inventaire.");
    } finally {
      setInventoryToDelete(null);
    }
  };

  // --- Maintenance Restores ---
  const handleSystemRestoreReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (maintenanceConfirmName.toUpperCase() !== "RESET") {
      triggerErrorMsg("Action refusée. Veuillez saisir exactement 'RESET' pour confirmer la dissolution.");
      return;
    }

    onResetAllPalettes();
    triggerSuccessMsg("RÉALISÉ : Toutes les palettes de fabrication ont été effacées. L'ID séquentiel est réinitialisé à 01.");
    setMaintenanceConfirmName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Zone d'Administration Sécurisée
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Espace Administrateur</h2>
          <p className="text-slate-400 text-xs mt-1">Gérer les utilisateurs, les nomenclatures produits et les restaurations de fabrication</p>
        </div>

        {/* Administration navigation subtabs */}
        <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 w-full md:w-auto">
          <button
            onClick={() => setActiveSubTab('agents')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'agents' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Opérateurs
          </button>
          <button
            onClick={() => setActiveSubTab('gammes')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'gammes' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Nomenclatures
          </button>
          <button
            onClick={() => setActiveSubTab('inventaires')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'inventaires' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" /> Inventaires Saisis
          </button>
          <button
            onClick={() => setActiveSubTab('maintenance')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'maintenance' ? 'bg-red-600/90 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Réinitialisation
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
          <AlertOctagon className="w-4 h-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* SUB-TABS INTERACTIVE SPACES */}

      {/* SECTION 1: AGENTS ADMINISTRATIONS */}
      {activeSubTab === 'agents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Contrôle des Accès Utilisateurs</h3>
              <p className="text-slate-400 text-[11px]">Consultez et modifiez les codes PIN de connexion des agents</p>
            </div>
            {!isAgentFormOpen && (
              <button
                onClick={handleOpenNewAgent}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Ajouter un Opérateur
              </button>
            )}
          </div>

          {/* User addition / updating slider form */}
          {isAgentFormOpen && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-inner animate-fade-in">
              <form onSubmit={handleSaveAgent} className="space-y-4 max-w-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                  {editAgentId ? "Modifier l'Opérateur" : "Enregistrer un Nouvel Opérateur"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Nom d'usage de l'agent</label>
                    <input
                      type="text"
                      required
                      value={agentNameInput}
                      onChange={(e) => setAgentNameInput(e.target.value)}
                      placeholder="Ex : Matthieu G."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/25"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Code PIN Unique (4 à 6 chiffres)</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={agentPinInput}
                      onChange={(e) => setAgentPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex : 1234"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4.5 py-2 text-xs font-mono font-bold text-slate-800 outline-none text-center focus:ring-2 focus:ring-emerald-500/25 tracking-widest text-base"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/50">
                  <input
                    type="checkbox"
                    id="isAdminInput"
                    checked={agentIsAdminInput}
                    onChange={(e) => setAgentIsAdminInput(e.target.checked)}
                    className="rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5"
                  />
                  <div className="text-xs select-none">
                    <label htmlFor="isAdminInput" className="font-bold text-slate-700 block">Attribuer les accès Administrateur</label>
                    <span className="text-slate-400 text-[10px]">Permet de modifier les nomenclatures, réinitialiser la production et d'administrer les comptes.</span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
                  >
                    Confirmer l'Enregistrement
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAgentFormOpen(false)}
                    className="border border-slate-205 text-slate-500 hover:bg-slate-100 text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
                  >
                    Abandonner
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List existing operators */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5 font-bold">Opérateur</th>
                    <th className="py-3 font-bold">Code PIN</th>
                    <th className="py-3 font-bold">Fonction administrative</th>
                    <th className="py-3 font-bold">Intégration system</th>
                    <th className="py-3 px-5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {agents.map((agent) => {
                    const isSelf = currentUser.id === agent.id;
                    return (
                      <tr key={agent.id} className="hover:bg-slate-50/30">
                        <td className="py-3.5 px-5 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-250 text-xs">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <span>
                              {agent.name} {isSelf && <span className="text-indigo-600 font-medium text-[9px] bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded-full ml-1">Moi-même</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 font-mono font-bold text-slate-400 tracking-wider">
                          •••• {currentUser.isAdmin ? `(${agent.pin})` : ''}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            agent.isAdmin 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-250/20' 
                              : 'bg-slate-50 text-slate-500'
                          }`}>
                            {agent.isAdmin ? 'Administrateur' : 'Opérateur'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                          {new Date(agent.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3.5 px-5 text-right flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditAgent(agent)}
                            className="p-1 px-2 border border-slate-205 rounded-lg hover:bg-slate-50 hover:text-slate-800 text-slate-500 transition-all font-semibold cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAgentEx(agent.id, agent.name)}
                            disabled={isSelf}
                            className={`p-1 px-2 border border-slate-205 rounded-lg text-slate-400 transition-all font-semibold ${
                              isSelf ? 'opacity-30 cursor-not-allowed' : 'hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 cursor-pointer'
                            }`}
                            title={isSelf ? 'Votre propre compte connecté' : 'Désactiver'}
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
          </div>
        </div>
      )}

      {/* SECTION 2: PRODUCT LINES & PERFUMES */}
      {activeSubTab === 'gammes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Configuration des Gammes & Parfums</h3>
              <p className="text-slate-400 text-[11px]">Configurez et liez les parfums disponibles par gamme de produits</p>
            </div>
            {!isGammeFormOpen && (
              <button
                onClick={handleOpenNewGamme}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nouvelle Gamme
              </button>
            )}
          </div>

          {/* Gamme Form Builder panel */}
          {isGammeFormOpen && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-inner animate-fade-in">
              <form onSubmit={handleSaveGamme} className="space-y-4 max-w-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                  {editGammeId ? "Mise à Jour de la Nomenclature" : "Créer une Gamme de parfums"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Désignation Gamme / Produit</label>
                    <input
                      type="text"
                      required
                      value={gammeNameInput}
                      onChange={(e) => setGammeNameInput(e.target.value)}
                      placeholder="Ex : Collection Privée, Édition d'Été"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/25"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Qté standard par palette du produit</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={standardQuantityInput}
                      onChange={(e) => setStandardQuantityInput(parseInt(e.target.value, 10) || 0)}
                      placeholder="Ex : 100"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/25"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center pl-0.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Liste des parfums (séparés par des virgules)</label>
                    <span className="text-[10px] text-slate-400 font-semibold">Ex: Santal, Oud, Jasmin, Rose de Crète</span>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={perfumesInput}
                    onChange={(e) => setPerfumesInput(e.target.value)}
                    placeholder="Saisissez vos parfumes, séparez chacun par une virgule..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/25 font-sans leading-relaxed resize-none"
                  />
                </div>

                {/* Custom Abbreviation Assignment Grid */}
                {(() => {
                  const currentParsed = perfumesInput
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                  
                  if (currentParsed.length === 0) return null;

                  return (
                    <div className="space-y-2 p-4 bg-slate-100/50 rounded-xl border border-slate-200/60">
                      <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                        <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Abonner une Abréviation aux Parfums (facultatif)</label>
                        <span className="text-[9px] text-slate-400 font-semibold italic">Par défaut, les initiales seront utilisées</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5">
                        {currentParsed.map((perfume, index) => {
                          return (
                            <div key={index} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-150 shadow-2xs">
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={perfume}>
                                {perfume}
                              </span>
                              <input
                                type="text"
                                maxLength={6}
                                placeholder={perfume.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().substring(0, 3) || 'ABR'}
                                value={abbreviationsInput[perfume] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAbbreviationsInput(prev => ({
                                    ...prev,
                                    [perfume]: val
                                  }));
                                }}
                                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono text-xs font-black uppercase text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
                  >
                    Enregistrer Nomenclature
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsGammeFormOpen(false)}
                    className="border border-slate-205 text-slate-500 hover:bg-slate-100 text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Gamme rows list */}
          {gammes.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 h-40 flex flex-col items-center justify-center p-6 text-slate-400 text-xs text-center">
              <Layers className="w-8 h-8 opacity-40 mb-1" />
              <p className="font-semibold">Aucune nomenclature configurée.</p>
              <p className="text-[11px] mt-0.5">Cliquez sur "Nouvelle Gamme" pour modéliser vos parfums de production.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gammes.map((g) => (
                <div key={g.id} className="bg-white border border-slate-100 shadow-xs hover:shadow-xs rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-base font-bold text-slate-800 uppercase tracking-tight block">{g.name}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-bold inline-block mt-1">
                          Qté standard : {g.standardQuantity ?? 100}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded font-bold">
                        {g.perfumes.length} Parfums
                      </span>
                    </div>

                    {/* Perfume List visualization tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {g.perfumes.map((perfume, idx) => (
                        <span 
                          key={idx} 
                          className="bg-slate-50 text-slate-600 font-medium text-[11px] px-2.5 py-1 rounded-lg border border-slate-100 inline-flex items-center gap-1"
                        >
                          <span>{perfume}</span>
                          {g.perfumeAbbreviations?.[perfume] && (
                            <span className="text-[9px] font-black font-mono text-emerald-700 bg-emerald-100/75 px-1 py-0.1 rounded border border-emerald-200">
                              {g.perfumeAbbreviations[perfume]}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3 flex justify-end gap-1.5 align-middle">
                    <button
                      type="button"
                      onClick={() => handleOpenEditGamme(g)}
                      className="p-1 px-2.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGammeEx(g.id, g.name)}
                      className="p-1 px-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: SYSTEM HARD SHIFT MAINTENANCE RESETS */}
      {activeSubTab === 'maintenance' && (
        <div className="bg-rose-50/30 border border-rose-100 p-6 rounded-3xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-950">Zone d'Effacement Complet & Purge</h3>
              <p className="text-rose-700/80 text-xs mt-0.5 max-w-xl leading-relaxed">
                Cette action supprimera irréversiblement l'intégralité des saisies de palettes enregistrées dans ce terminal. La numérotation automatique reprendra strictement au numéro 01.
              </p>
            </div>
          </div>

          <div className="border border-rose-100 bg-white p-5 rounded-2xl max-w-xl space-y-4">
            <span className="text-xs font-bold text-rose-900 block uppercase tracking-wide">Validation Requise</span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Pour initier la réinitialisation de l'index de fabrication et supprimer toutes les palettes existantes, merci de saisir exactement <code className="bg-rose-50 text-rose-600 font-mono font-extrabold px-1.5 py-0.5 rounded text-[11px] border border-rose-100">RESET</code> ci-dessous :
            </p>

            <form onSubmit={handleSystemRestoreReset} className="flex gap-2 w-full max-w-md">
              <input
                type="text"
                required
                value={maintenanceConfirmName}
                onChange={(e) => setMaintenanceConfirmName(e.target.value)}
                placeholder="Taper RESET"
                className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs font-mono font-black text-slate-800 outline-none text-center tracking-widest focus:ring-2 focus:ring-rose-500/20 uppercase"
              />
              <button
                type="submit"
                disabled={maintenanceConfirmName.toUpperCase() !== "RESET"}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
              >
                Réinitialiser la production
              </button>
            </form>
          </div>
        </div>
      )}



      {/* SECTION 4: INVENTAIRES SAISIS MANAGEMENT */}
      {activeSubTab === 'inventaires' && (
        <div className="space-y-4 animate-fade-in no-print">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800">Registre Historique des Inventaires</h3>
            <p className="text-slate-400 text-[11px]">Consultez et imprimez individuellement les inventaires physiques saisis par les agents opérateurs</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {inventories.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs italic">
                Aucun inventaire n'a été saisi pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {getConsolidatedInventories(inventories).map((item) => {
                  const dateObj = new Date(item.createdAt);
                  const formattedDate = dateObj.toLocaleDateString('fr-FR');
                  const formattedTime = dateObj.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });

                  return (
                    <div 
                      key={item.id}
                      className="p-4 px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/55 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-md font-bold text-[10px] px-2 py-0.5 tracking-tight uppercase">
                            Inventaire Global {item.numberCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-semibold text-slate-600">
                            Inventaire Agent
                          </span>
                        </div>

                        {/* Exact requested display string format */}
                        <div className="text-slate-800 font-bold text-xs mt-1.5 flex items-center gap-1">
                          <span className="font-mono bg-slate-100/80 px-2 py-0.5 rounded font-extrabold text-slate-800 tracking-wide text-[10px]">
                            {`inventaire ${item.numberCode} ${formattedDate} ${formattedTime} et ${item.agentName}`}
                          </span>
                        </div>

                        <p className="text-slate-400 text-[11px] font-medium pt-1">
                          Nombre de parfums recensés : <strong className="text-slate-700">{item.entries.length} parfum(s)</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedInvForView(item)}
                          className="flex-1 sm:flex-initial bg-white border border-slate-205 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visualiser
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSingleInventory(item)}
                          className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" /> Imprimer
                        </button>
                        <button
                          type="button"
                          onClick={() => setInventoryToDelete(item)}
                          className="flex-1 sm:flex-initial bg-rose-50 border border-rose-100 hover:border-rose-300 hover:bg-rose-100 text-rose-700 font-semibold text-xs px-3.5 py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                          title="Supprimer cet inventaire"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODAL CARD */}
      {selectedInvForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl text-slate-800">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                  Saisie d'Inventaire #{selectedInvForView.numberCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Détail de l'inventaire {selectedInvForView.numberCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvForView(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Dernière activité d'inventaire</span>
                  <p className="text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(selectedInvForView.createdAt).toLocaleDateString('fr-FR')} {new Date(selectedInvForView.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Agent Saisisseur</span>
                  <p className="text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {selectedInvForView.agentName}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Type de Document</span>
                  <p className="text-blue-700 text-xs font-bold uppercase tracking-tight">
                    Inventaire Global Agent
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Conditionnement</span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Consolidé (Tous formats)
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pl-1">
                  Produits et Parfums Recensés
                </h4>
                
                {/* Inventories Aggregation Blocks */}
                <div className="space-y-4 text-slate-800">
                  {gammes.map(g => {
                    const hasCounts = g.perfumes.some(perfume => {
                      const relevantItems = inventories.filter(inv => {
                        const isOwn = inv.agentId === selectedInvForView.agentId && inv.gammeId === g.id;
                        if (!isOwn) return false;
                        if (inv.type === 'mono') {
                          return inv.entries.some(e => e.perfume === perfume);
                        } else {
                          return getDominantPerfumeForMixte(inv) === perfume;
                        }
                      });
                      return relevantItems.length > 0;
                    });

                    if (!hasCounts) return null;

                    return (
                      <div key={g.id} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 break-inside-avoid shadow-2xs text-left">
                        {/* Gamme / Product title */}
                        <h3 className="font-extrabold text-xs uppercase tracking-wide border-b border-slate-200 pb-2 text-slate-900 bg-slate-50/50 px-2 rounded-t">
                          {g.name}
                        </h3>
                        
                        {/* Perfumes list */}
                        <div className="divide-y divide-slate-100">
                          {g.perfumes.map(perfume => {
                            const relevantItems = inventories.filter(inv => {
                              const isOwn = inv.agentId === selectedInvForView.agentId && inv.gammeId === g.id;
                              if (!isOwn) return false;
                              if (inv.type === 'mono') {
                                return inv.entries.some(e => e.perfume === perfume);
                              } else {
                                return getDominantPerfumeForMixte(inv) === perfume;
                              }
                            });

                            if (relevantItems.length === 0) return null;

                            return (
                              <div key={perfume} className="flex items-center justify-between gap-6 py-2 px-2">
                                {/* Perfume on the left side */}
                                <div className="w-1/4 min-w-[100px] font-semibold text-xs text-slate-800 font-sans">
                                  {perfume}
                                </div>
                                
                                {/* Horizontal series of circles representing pallets with quantities inside */}
                                <div className="flex-1 flex flex-wrap gap-2.5 items-center">
                                  {relevantItems.map((item, idx) => {
                                    const entry = item.entries.find(e => e.perfume === perfume);
                                    const count = entry ? entry.quantity : 0;
                                    return (
                                      <div key={idx} className="flex flex-col items-center justify-center gap-0.5">
                                        {item.type === 'mixte' ? (
                                          <>
                                            <div className="w-8 h-8 rounded-lg border-2 border-amber-600 bg-amber-50 text-amber-950 flex items-center justify-center font-extrabold text-xs shadow-2xs">
                                              {count}
                                            </div>
                                            {(() => {
                                              const initials = getOtherPerfumesInitials(item, perfume);
                                              return initials ? (
                                                <span className="text-[8px] font-bold text-amber-700 font-mono tracking-tighter uppercase leading-none">
                                                  {initials}
                                                </span>
                                              ) : null;
                                            })()}
                                          </>
                                        ) : (
                                          <span className="w-8 h-8 rounded-full border-2 border-slate-850 bg-slate-50 text-slate-900 flex items-center justify-center font-extrabold text-xs shadow-2xs">
                                            {count}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="text-right font-mono text-xs font-bold text-slate-900 border-l border-slate-100 pl-3 min-w-[70px]">
                                  Total : {getPerfumeTotalQuantity(g.id, perfume, selectedInvForView.agentId)} Carton
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end p-2 pr-4 text-xs font-bold text-slate-800 bg-slate-50 rounded-lg">
                  Total Général : {selectedInvForView.entries.reduce((acc, entry) => acc + entry.quantity, 0)} Carton
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-3xl">
              <button
                type="button"
                onClick={() => handlePrintSingleInventory(selectedInvForView)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Printer className="w-4 h-4" /> Imprimer cette fiche
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvForView(null)}
                className="bg-white border border-slate-205 text-slate-600 hover:bg-slate-100 font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY INDEPENDENT SHEET VIEW */}
      {selectedInvForPrint && createPortal(
        <div className="hidden print:block bg-white text-black p-0" id="print-single-inventory-area">
          {(() => {
            const printedPages = getFormattedPrintPagesForAgent(selectedInvForPrint.agentId);
            const totalActivePalettes = inventories.filter(inv => inv.agentId === selectedInvForPrint.agentId).length;
            const grandTotalQty = inventories.filter(inv => inv.agentId === selectedInvForPrint.agentId).reduce((acc, item) => acc + item.entries.reduce((sum, e) => sum + e.quantity, 0), 0);

            return printedPages.map((page, pageIdx) => (
              <div key={pageIdx} className="page-break-after p-0 w-full flex flex-col justify-start gap-6 bg-white text-slate-800 relative font-sans" style={{ pageBreakAfter: 'always' }}>
                <div className="space-y-6">
                  {/* Print Document Header */}
                  <div className="flex justify-between items-start border-b border-gray-300 pb-4 text-left">
                    <div>
                      <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        Rapport d'Inventaire Individuel Consolidé {printedPages.length > 1 ? `(${pageIdx + 1}/${printedPages.length})` : ''}
                      </h1>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span>Comptage {selectedInvForPrint.numberCode}</span>
                        <span>•</span>
                        <span>YETISTOCK SUIVI</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                      <p className="font-bold text-slate-900">Opérateur : {selectedInvForPrint.agentName}</p>
                      <p>Dernière activité : {new Date(selectedInvForPrint.createdAt).toLocaleDateString('fr-FR')} {new Date(selectedInvForPrint.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', hour12: false})}</p>
                      <p className="font-semibold text-blue-700">Total Palettes : {totalActivePalettes}</p>
                    </div>
                  </div>

                  {/* Inventories Aggregation Blocks */}
                  {page.rows.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 italic text-xs">
                      Aucune palette physique dans cet inventaire.
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
                        <p className="font-bold text-slate-700 uppercase">Document Certifié Conforme pour Archivage</p>
                        <p className="text-slate-400 mt-0.5">Signature de l'agent ayant effectué la saisie physique</p>
                      </div>
                      <div className="w-36 h-12 border border-dashed border-slate-300 rounded flex items-center justify-center italic text-gray-300 font-serif bg-white">
                        Signature Agent
                      </div>
                    </div>
                    <div className="text-center text-[8px] text-slate-400 border-t pt-2 uppercase font-mono tracking-wider">
                      Rapport d'Archivage • YETISTOCK SUIVI • Rapport Continu Optimisé
                    </div>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>,
        document.body
      )}

      {/* Custom Confirmation Modal for Deleting Gammes */}
      {gammeToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in no-print">
          <div className="bg-white border border-slate-100 shadow-2xl rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Supprimer la Gamme ?</h4>
                <p className="text-[11px] text-slate-400">Cette action est irréversible.</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-xs leading-relaxed">
              Êtes-vous certain de vouloir archiver et supprimer la gamme <strong className="text-slate-900 uppercase">{gammeToDelete.name}</strong> ? Les parfums correspondants ne seront plus saisissables.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={confirmDeleteGamme}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setGammeToDelete(null)}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Agents */}
      {agentToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in no-print">
          <div className="bg-white border border-slate-100 shadow-2xl rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Retirer cet Opérateur ?</h4>
                <p className="text-[11px] text-slate-400">Cette action est définitive.</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-xs leading-relaxed">
              Voulez-vous vraiment désactiver l'accès de l'opérateur <strong className="text-slate-900">{agentToDelete.name}</strong> ? Son terminal de saisie sera révoqué.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={confirmDeleteAgent}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
              >
                Retirer
              </button>
              <button
                type="button"
                onClick={() => setAgentToDelete(null)}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
              >
                Conserver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Inventories */}
      {inventoryToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in no-print">
          <div className="bg-white border border-slate-100 shadow-2xl rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-up text-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Supprimer l'inventaire ?</h4>
                <p className="text-[11px] text-slate-400">Cette action est irréversible.</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-xs leading-relaxed">
              Êtes-vous certain de vouloir supprimer l'inventaire de <strong className="text-slate-900 uppercase">{inventoryToDelete.agentName}</strong> ? Toutes les saisies physiques de cet opérateur seront effacées définitivement.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={confirmDeleteInventory}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setInventoryToDelete(null)}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
