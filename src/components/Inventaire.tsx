/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Gamme, InventoryItem } from '../types';
import { 
  ClipboardCheck, Sparkles, Folder, RefreshCw, Layers, Plus, 
  Trash2, ShieldCheck, AlertCircle, Printer, Calendar, User,
  Edit2, Save, X, Check, QrCode, Camera, Keyboard
} from 'lucide-react';

interface InventaireProps {
  key?: string;
  gammes: Gamme[];
  inventories: InventoryItem[];
  currentUser: { name: string; id: string; isAdmin: boolean };
  onAddInventoryItem: (
    gammeId: string, 
    gammeName: string, 
    type: 'mono' | 'mixte', 
    entries: { perfume: string; qty: number }[],
    validationId?: string,
    validationNumber?: number,
    validationTimestamp?: string
  ) => Promise<any>;
  onUpdateInventoryItem: (id: string, entries: { perfume: string; quantity: number }[]) => Promise<void>;
  onDeleteInventoryItem: (id: string) => void;
}

export interface ValidatedSession {
  id: string;
  numberCode: string;
  validationNumber: number;
  agentId: string;
  agentName: string;
  createdAt: string;
  items: {
    id: string;
    gammeId: string;
    gammeName: string;
    type: 'mono' | 'mixte';
    entries: { perfume: string; quantity: number }[];
  }[];
}

export function getValidatedSessions(allInventories: InventoryItem[]): ValidatedSession[] {
  const sessionMap: Record<string, {
    id: string;
    agentId: string;
    agentName: string;
    createdAt: string;
    rawItems: InventoryItem[];
  }> = {};

  allInventories.forEach(item => {
    const sId = item.validationId || item.id;
    if (!sessionMap[sId]) {
      sessionMap[sId] = {
        id: sId,
        agentId: item.agentId,
        agentName: item.agentName,
        createdAt: item.validationTimestamp || item.createdAt,
        rawItems: []
      };
    }
    sessionMap[sId].rawItems.push(item);
    
    const itemTime = new Date(item.validationTimestamp || item.createdAt).getTime();
    const mapTime = new Date(sessionMap[sId].createdAt).getTime();
    if (itemTime < mapTime) {
      sessionMap[sId].createdAt = item.validationTimestamp || item.createdAt;
    }
  });

  const sortedSessionsAsc = Object.values(sessionMap).sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const sessions: ValidatedSession[] = sortedSessionsAsc.map((session, index) => {
    const valNum = index + 1;
    const numCode = valNum < 10 ? `0${valNum}` : `${valNum}`;

    const items = session.rawItems.map(raw => ({
      id: raw.id,
      gammeId: raw.gammeId,
      gammeName: raw.gammeName,
      type: raw.type,
      entries: raw.entries.map(e => ({ perfume: e.perfume, quantity: e.quantity }))
    }));

    return {
      id: session.id,
      numberCode: numCode,
      validationNumber: valNum,
      agentId: session.agentId,
      agentName: session.agentName,
      createdAt: session.createdAt,
      items
    };
  });

  return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function Inventaire({
  gammes,
  inventories,
  currentUser,
  onAddInventoryItem,
  onUpdateInventoryItem,
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

  const getPerfumeTotalQuantity = (gammeId: string, perfume: string, agentId: string, validationId?: string) => {
    return inventories
      .filter(inv => {
        const matchesSession = validationId 
          ? (inv.validationId === validationId || (!inv.validationId && inv.id === validationId))
          : (inv.agentId === agentId);
        return matchesSession && inv.gammeId === gammeId;
      })
      .reduce((sum, inv) => {
        const entry = inv.entries.find(e => e.perfume === perfume);
        return sum + (entry ? entry.quantity : 0);
      }, 0);
  };

  const [selectedGammeId, setSelectedGammeId] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Draft inventories state with persistence in localStorage
  const [draftInventories, setDraftInventories] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem(`yetistock_draft_inventories_${currentUser.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Auto-persist drafts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`yetistock_draft_inventories_${currentUser.id}`, JSON.stringify(draftInventories));
    } catch (err) {
      console.error("Error writing draft inventories to localStorage:", err);
    }
  }, [draftInventories, currentUser.id]);

  // Mixed inventory builder
  const [isMixedMode, setIsMixedMode] = useState<boolean>(false);
  const [mixedEntries, setMixedEntries] = useState<{ perfume: string; qty: number }[]>([]);
  const [activePerfumeInput, setActivePerfumeInput] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Manage custom entered quantities per product card
  const [monoCustomQuantities, setMonoCustomQuantities] = useState<Record<string, string>>({});
  const [pendingPrint, setPendingPrint] = useState<boolean>(false);
  const [selectedSessionForPrint, setSelectedSessionForPrint] = useState<any | null>(null);

  // Reliable print effect triggered after DOM rendering is complete
  useEffect(() => {
    if (selectedSessionForPrint) {
      const timer = setTimeout(() => {
        window.focus();
        window.print();
        setSelectedSessionForPrint(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedSessionForPrint]);

  // Session editing states
  interface EditingItem {
    id: string;
    isNew?: boolean;
    gammeId: string;
    gammeName: string;
    type: 'mono' | 'mixte';
    entries: { perfume: string; quantity: number }[];
  }

  const [editingSession, setEditingSession] = useState<ValidatedSession | null>(null);
  const [editingItems, setEditingItems] = useState<EditingItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [isUpdatingSession, setIsUpdatingSession] = useState<boolean>(false);

  // New palette addition state inside edit session modal
  const [showAddPaletteForm, setShowAddPaletteForm] = useState<boolean>(false);
  const [editAddGammeId, setEditAddGammeId] = useState<string>('');
  const [editAddType, setEditAddType] = useState<'mono' | 'mixte'>('mono');
  const [editAddPerfume, setEditAddPerfume] = useState<string>('');
  const [editAddQty, setEditAddQty] = useState<number>(100);
  const [editAddMixedEntries, setEditAddMixedEntries] = useState<{ perfume: string; qty: number }[]>([]);
  const [editAddActivePerfume, setEditAddActivePerfume] = useState<string | null>(null);
  const [editAddMixedQtyInput, setEditAddMixedQtyInput] = useState<string>('100');

  // QR & Barcode scanner states
  const [isSimulationOpen, setIsSimulationOpen] = useState<boolean>(false);
  const [simulationPayload, setSimulationPayload] = useState<string>('');
  const [douchetteInput, setDouchetteInput] = useState<string>('');

  const handleProcessScannedCode = (scannedText: string) => {
    try {
      if (!scannedText || !scannedText.startsWith('PALETTE|')) {
        triggerErrorMsg("Code-barres / QR Code invalide ou non reconnu pour l'inventaire.");
        return;
      }

      const parts = scannedText.split('|');
      if (parts.length < 6) {
        triggerErrorMsg("Données du QR Code incomplètes.");
        return;
      }

      const paletteId = parts[1];
      const gammeId = parts[2];
      const gammeName = parts[3];
      const type = parts[4] as 'mono' | 'mixte';
      const entriesRaw = parts[5];

      if (!entriesRaw) {
        triggerErrorMsg("La palette scannée est vide (aucun parfum).");
        return;
      }

      const entries = entriesRaw.split(';').map(item => {
        const [perfume, qtyStr] = item.split(':');
        return { perfume, qty: parseInt(qtyStr, 10) || 0 };
      }).filter(e => e.qty > 0);

      if (entries.length === 0) {
        triggerErrorMsg("Aucune quantité valide trouvée dans la palette scannée.");
        return;
      }

      // Check if this palette has already been scanned to avoid duplicates
      const isAlreadyAdded = draftInventories.some(item => item.id === `scanned_${paletteId}`);
      if (isAlreadyAdded) {
        triggerErrorMsg(`Cette palette (N° ${paletteId}) a déjà été scannée et ajoutée au comptage en cours.`);
        return;
      }

      const newItem = {
        id: `scanned_${paletteId}`,
        gammeId,
        gammeName,
        type,
        entries,
        agentId: currentUser.id,
        agentName: currentUser.name
      };

      setDraftInventories(prev => [...prev, newItem]);
      triggerSuccessMsg(`Palette scannée avec succès ! ${gammeName} (${type === 'mono' ? 'Mono' : 'Mixte'}) - ${entries.map(e => `${e.perfume}: ${e.qty}`).join(', ')}`);
    } catch (e: any) {
      triggerErrorMsg(`Erreur lors du traitement du scan: ${e.message || e}`);
    }
  };

  const handleDouchetteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!douchetteInput.trim()) return;
    handleProcessScannedCode(douchetteInput.trim());
    setDouchetteInput('');
  };

  // Keep handleProcessScannedCode up-to-date for global native Android triggers
  const handleProcessScannedCodeRef = React.useRef(handleProcessScannedCode);
  useEffect(() => {
    handleProcessScannedCodeRef.current = handleProcessScannedCode;
  }, [handleProcessScannedCode]);

  useEffect(() => {
    // Register global bridge callbacks that the native Android app (APK container) will call on detection
    (window as any).onQRCodeScanned = (scannedText: string) => {
      console.log("[Native Android] onQRCodeScanned callback invoked:", scannedText);
      handleProcessScannedCodeRef.current(scannedText);
    };

    (window as any).onBarcodeScanned = (scannedText: string) => {
      console.log("[Native Android] onBarcodeScanned callback invoked:", scannedText);
      handleProcessScannedCodeRef.current(scannedText);
    };

    (window as any).handleAndroidBarcode = (scannedText: string) => {
      console.log("[Native Android] handleAndroidBarcode callback invoked:", scannedText);
      handleProcessScannedCodeRef.current(scannedText);
    };

    return () => {
      delete (window as any).onQRCodeScanned;
      delete (window as any).onBarcodeScanned;
      delete (window as any).handleAndroidBarcode;
    };
  }, []);

  const triggerNativeAndroidScanner = async () => {
    let triggered = false;

    // 1. Android WebView JavascriptInterface (Standard custom native bridges)
    const androidObj = (window as any).Android || (window as any).AndroidInterface || (window as any).AndroidScanner || (window as any).JSInterface;
    if (androidObj) {
      try {
        if (typeof androidObj.startQRScanner === 'function') {
          androidObj.startQRScanner();
          triggered = true;
        } else if (typeof androidObj.startScan === 'function') {
          androidObj.startScan();
          triggered = true;
        } else if (typeof androidObj.scanQRCode === 'function') {
          androidObj.scanQRCode();
          triggered = true;
        } else if (typeof androidObj.scanBarCode === 'function') {
          androidObj.scanBarCode();
          triggered = true;
        } else if (typeof androidObj.triggerScanner === 'function') {
          androidObj.triggerScanner();
          triggered = true;
        } else if (typeof androidObj.scan === 'function') {
          androidObj.scan();
          triggered = true;
        }
      } catch (err) {
        console.error("Error triggering native Android scanner interface:", err);
      }
    }

    // 2. Capacitor native plugin dynamic execution (works offline, based on ML Kit Barcode scanning)
    if (!triggered && (window as any).Capacitor) {
      try {
        const cap = (window as any).Capacitor;
        if (cap.Plugins) {
          // Option A: @capacitor-mlkit/barcode-scanning
          const BarcodeScanning = cap.Plugins.BarcodeScanning;
          if (BarcodeScanning && typeof BarcodeScanning.scan === 'function') {
            const result = await BarcodeScanning.scan();
            if (result && result.barcode && result.barcode.displayValue) {
              handleProcessScannedCode(result.barcode.displayValue);
            } else if (result && result.value) {
              handleProcessScannedCode(result.value);
            }
            triggered = true;
          }

          // Option B: @capacitor-community/barcode-scanner
          const BarcodeScanner = cap.Plugins.BarcodeScanner;
          if (!triggered && BarcodeScanner && typeof BarcodeScanner.startScan === 'function') {
            if (typeof BarcodeScanner.hideBackground === 'function') {
              await BarcodeScanner.hideBackground();
            }
            document.body.classList.add("scanner-active");
            const result = await BarcodeScanner.startScan({ targetedFormats: ['QR_CODE'] });
            document.body.classList.remove("scanner-active");
            if (typeof BarcodeScanner.showBackground === 'function') {
              await BarcodeScanner.showBackground();
            }
            if (result && result.hasContent) {
              handleProcessScannedCode(result.content);
            }
            triggered = true;
          }
        }
      } catch (err) {
        console.error("Error calling Capacitor plugins:", err);
      }
    }

    // 3. Browser simulation mode: If not inside the native wrapper, open the tester/simulator modal
    if (!triggered) {
      setIsSimulationOpen(true);
    }
  };

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
  const getFormattedPrintPages = (agentId: string, validationId?: string) => {
    const activeGammes = gammes.filter(g => {
      return g.perfumes.some(perfume => {
        return inventories.some(inv => {
          const matchesSession = validationId 
            ? (inv.validationId === validationId || (!inv.validationId && inv.id === validationId))
            : (inv.agentId === agentId);
          const isOwn = matchesSession && inv.gammeId === g.id;
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
          const matchesSession = validationId 
            ? (inv.validationId === validationId || (!inv.validationId && inv.id === validationId))
            : (inv.agentId === agentId);
          return matchesSession && inv.gammeId === g.id && (inv.type === 'mono' ? inv.entries.some(e => e.perfume === p) : getDominantPerfumeForMixte(inv) === p);
        });
      });
      return gPerfumes[gPerfumes.length - 1];
    };
    const lastActivePerfumeOfLastGamme = lastGamme ? getLastActivePerfume(lastGamme) : null;

    activeGammes.forEach(gamme => {
      const activePerfumes = gamme.perfumes.filter(perfume => {
        return inventories.some(inv => {
          const matchesSession = validationId 
            ? (inv.validationId === validationId || (!inv.validationId && inv.id === validationId))
            : (inv.agentId === agentId);
          const isOwn = matchesSession && inv.gammeId === gamme.id;
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
          const matchesSession = validationId 
            ? (inv.validationId === validationId || (!inv.validationId && inv.id === validationId))
            : (inv.agentId === agentId);
          const isOwn = matchesSession && inv.gammeId === gamme.id;
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
      const newItem = {
        id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        gammeId,
        gammeName,
        type: 'mono' as const,
        entries: [{ perfume, qty }],
        agentId: currentUser.id,
        agentName: currentUser.name
      };
      setDraftInventories(prev => [...prev, newItem]);
      triggerSuccessMsg(`Saisie ajoutée : 1 palette (${perfume}) de ${qty} u. en cours. Cliquez sur « Valider » en bas pour sauvegarder définitivement.`);
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
      const newItem = {
        id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        gammeId: activeG.id,
        gammeName: activeG.name,
        type: 'mixte' as const,
        entries: mixedEntries.map(e => ({ perfume: e.perfume, qty: e.qty })),
        agentId: currentUser.id,
        agentName: currentUser.name
      };
      setDraftInventories(prev => [...prev, newItem]);
      triggerSuccessMsg("Saisie mixte ajoutée au comptage en cours. Cliquez sur « Valider » en bas pour sauvegarder définitivement.");
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

  const handleSaveAllDrafts = async () => {
    if (draftInventories.length === 0) {
      triggerErrorMsg("Aucun comptage d'inventaire en cours à enregistrer.");
      return;
    }
    setIsSavingAll(true);
    try {
      const existingValidationNumbers = inventories
        .map(inv => inv.validationNumber || 0)
        .filter(Boolean);
      const nextValidationNumber = existingValidationNumbers.length > 0
        ? Math.max(...existingValidationNumbers) + 1
        : 1;

      const validationId = `validation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const validationTimestamp = new Date().toISOString();

      for (const item of draftInventories) {
        await onAddInventoryItem(
          item.gammeId, 
          item.gammeName, 
          item.type, 
          item.entries, 
          validationId, 
          nextValidationNumber, 
          validationTimestamp
        );
      }
      triggerSuccessMsg(`L'inventaire complet N°${nextValidationNumber} (${draftInventories.length} ligne(s)) a été sauvegardé définitivement avec succès !`);
      setDraftInventories([]);
    } catch (e: any) {
      triggerErrorMsg(e.message || "Erreur lors de la validation de l'inventaire.");
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDeleteDraftItem = (id: string) => {
    setDraftInventories(prev => prev.filter(item => item.id !== id));
    triggerSuccessMsg("Saisie en cours retirée.");
  };

  const handleStartEditSession = (session: ValidatedSession) => {
    setEditingSession(session);
    const initialItems: EditingItem[] = session.items.map(item => ({
      id: item.id,
      gammeId: item.gammeId,
      gammeName: item.gammeName,
      type: item.type,
      entries: item.entries.map((e: any) => ({
        perfume: e.perfume,
        quantity: e.quantity
      }))
    }));
    setEditingItems(initialItems);
    setDeletedItemIds([]);
    setShowAddPaletteForm(false);
    setEditAddGammeId('');
    setEditAddPerfume('');
    setEditAddMixedEntries([]);
  };

  const handleUpdateEditingItemQty = (itemId: string, perfume: string, newQty: number) => {
    setEditingItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        entries: item.entries.map(e => e.perfume === perfume ? { ...e, quantity: Math.max(0, newQty) } : e)
      };
    }));
  };

  const handleDeleteEditingItem = (itemId: string) => {
    setEditingItems(prev => {
      const itemToDelete = prev.find(i => i.id === itemId);
      if (itemToDelete && !itemToDelete.isNew) {
        setDeletedItemIds(d => [...d, itemId]);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const handleAddPaletteToEditSession = () => {
    const g = gammes.find(x => x.id === editAddGammeId);
    if (!g) {
      triggerErrorMsg("Veuillez sélectionner une gamme.");
      return;
    }

    if (editAddType === 'mono') {
      if (!editAddPerfume) {
        triggerErrorMsg("Veuillez sélectionner un parfum.");
        return;
      }
      if (editAddQty <= 0) {
        triggerErrorMsg("La quantité doit être supérieure à 0.");
        return;
      }
      const newItem: EditingItem = {
        id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        isNew: true,
        gammeId: g.id,
        gammeName: g.name,
        type: 'mono',
        entries: [{ perfume: editAddPerfume, quantity: editAddQty }]
      };
      setEditingItems(prev => [...prev, newItem]);
      setEditAddPerfume('');
      setShowAddPaletteForm(false);
      triggerSuccessMsg(`Palette (${g.name} - ${editAddPerfume}) ajoutée à la modification.`);
    } else {
      if (editAddMixedEntries.length === 0) {
        triggerErrorMsg("Veuillez ajouter au moins un parfum pour la palette mixte.");
        return;
      }
      const newItem: EditingItem = {
        id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        isNew: true,
        gammeId: g.id,
        gammeName: g.name,
        type: 'mixte',
        entries: editAddMixedEntries.map(e => ({ perfume: e.perfume, quantity: e.qty }))
      };
      setEditingItems(prev => [...prev, newItem]);
      setEditAddMixedEntries([]);
      setEditAddActivePerfume(null);
      setShowAddPaletteForm(false);
      triggerSuccessMsg(`Palette mixte (${g.name}) ajoutée à la modification.`);
    }
  };

  const handleSaveSessionEdit = async () => {
    if (!editingSession) return;
    setIsUpdatingSession(true);
    try {
      // 1. Delete items removed during editing from Firestore
      for (const id of deletedItemIds) {
        await onDeleteInventoryItem(id);
      }

      // 2. Add new items or Update existing items
      for (const item of editingItems) {
        if (item.isNew) {
          await onAddInventoryItem(
            item.gammeId,
            item.gammeName,
            item.type,
            item.entries.map(e => ({ perfume: e.perfume, qty: e.quantity })),
            editingSession.id,
            editingSession.validationNumber,
            editingSession.createdAt
          );
        } else {
          await onUpdateInventoryItem(item.id, item.entries);
        }
      }

      triggerSuccessMsg(`L'inventaire N°${editingSession.numberCode} a été modifié et enregistré avec succès !`);
      setEditingSession(null);
      setEditingItems([]);
      setDeletedItemIds([]);
    } catch (e: any) {
      triggerErrorMsg(e.message || "Erreur lors de la modification de l'inventaire.");
    } finally {
      setIsUpdatingSession(false);
    }
  };

  const handleDeleteSession = async (session: any) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'inventaire N°${session.numberCode} ?`)) {
      try {
        for (const item of session.items) {
          await onDeleteInventoryItem(item.id);
        }
        triggerSuccessMsg(`L'inventaire N°${session.numberCode} a été supprimé.`);
      } catch (e: any) {
        triggerErrorMsg("Erreur lors de la suppression de l'inventaire.");
      }
    }
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

      {/* SCANNER & SAISIE RAPIDE SECTION */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600 animate-pulse" /> Scanner d'Inventaire Intégré
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Scannez directement le QR Code d'une étiquette imprimée pour charger instantanément les détails de la palette (Gamme, Parfums et Quantités) dans votre inventaire en cours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* CAMERA PHONE SCANNER - NATIVE ANDROID */}
          <div className="border border-slate-200/80 p-5 rounded-2xl bg-slate-50 flex flex-col justify-between space-y-4">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Option A : Caméra Mobile (Android Natif)</span>
              <p className="text-xs text-slate-650 font-semibold mt-1">Utilise l'appareil photo avec Google ML Kit natif de l'appareil sans demande de permission média web.</p>
            </div>

            <button
              type="button"
              onClick={triggerNativeAndroidScanner}
              className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-indigo-150 group"
            >
              <QrCode className="w-4 h-4 group-hover:scale-110 transition-transform animate-pulse" /> 
              <span>Scanner un QR Code</span>
            </button>
          </div>

          {/* PHYSICAL DOUCHETTE BARCODE SCANNER */}
          <form onSubmit={handleDouchetteSubmit} className="border border-slate-200/80 p-5 rounded-2xl bg-slate-50 flex flex-col justify-between space-y-4">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Option B : Douchette Code-barres / Clavier</span>
              <p className="text-xs text-slate-650 font-semibold mt-1">Utilisez une douchette classique ou saisissez le code copié manuellement.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                    <Keyboard className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cliquez ici puis scannez avec la douchette..."
                    value={douchetteInput}
                    onChange={(e) => setDouchetteInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Valider
                </button>
              </div>
              <p className="text-[10px] text-slate-400 italic text-left">
                💡 Astuce : Sélectionnez la case ci-dessus, puis scannez avec votre douchette pour un enregistrement automatique.
              </p>
            </div>
          </form>

        </div>
      </div>

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

      {/* Saisies en cours de validation (Draft list) with the Valider button */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-4.5 h-4.5 text-emerald-400" /> Saisies en cours de validation
            </h3>
            <p className="text-slate-400 text-[11px]">Données saisies localement en attente de sauvegarde définitive</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 text-emerald-400 px-3 py-1 rounded-full font-semibold border border-slate-700/50">
              {draftInventories.length} palette(s) à valider
            </span>
          </div>
        </div>

        {draftInventories.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs italic">
            Aucune saisie en cours. Cliquez sur les parfums des gammes ci-dessus pour ajouter des données de comptage.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 font-bold">Gamme / Produit</th>
                    <th className="py-2.5 font-bold">Type</th>
                    <th className="py-2.5 font-bold">Comptage & Parfums</th>
                    <th className="py-2.5 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {draftInventories.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 font-semibold text-white">{item.gammeName}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.type === 'mono' ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50' : 'bg-amber-900/40 text-amber-300 border border-amber-800/50'
                        }`}>
                          {item.type === 'mono' ? 'Simple' : 'Palette Mixte'}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-col gap-1">
                          {item.entries.map((e: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-slate-300 font-medium">
                              <span>{e.perfume}</span>: 
                              <span className="font-mono bg-slate-800 text-emerald-300 px-1.5 rounded text-[10px] font-bold border border-slate-700/40">
                                {e.qty} u
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteDraftItem(item.id)}
                          className="p-1 px-2 border border-slate-800 rounded-lg hover:bg-rose-950 hover:border-rose-800 hover:text-rose-400 text-slate-500 transition-all font-semibold cursor-pointer"
                          title="Retirer cette saisie"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Validate/Submit Inventory button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveAllDrafts}
                disabled={isSavingAll}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enregistrement définitif en cours...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-200" />
                    Valider et Enregistrer Définitivement l'Inventaire ({draftInventories.length} ligne(s))
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Complete Inventories logs grouped by validation session */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Registre Global d'Inventaire Actif</h3>
            <p className="text-slate-400 text-[11px]">Saisies de comptage physique en temps réel par les opérateurs, classées par inventaire validé</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
              Total inventaires validés : {getValidatedSessions(inventories).length}
            </span>
          </div>
        </div>

        {getValidatedSessions(inventories).length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            Aucun comptage d'inventaire enregistré à ce jour.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 font-bold">Inventaire</th>
                  <th className="py-2.5 font-bold">Opérateur</th>
                  <th className="py-2.5 font-bold">Horodatage</th>
                  <th className="py-2.5 font-bold">Contenu (Gammes & Parfums)</th>
                  <th className="py-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {getValidatedSessions(inventories).map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/50">
                    <td className="py-4 font-bold text-slate-900 align-top">
                      <span className="bg-blue-50 border border-blue-100 text-blue-700 rounded-md font-bold text-xs px-2.5 py-1 tracking-tight uppercase inline-flex items-center gap-1">
                        Inventaire {session.validationNumber}
                      </span>
                    </td>
                    <td className="py-4 align-top">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {session.agentName}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 font-mono align-top">
                      {new Date(session.createdAt).toLocaleDateString('fr-FR')} {new Date(session.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col gap-2 max-w-md">
                        {session.items.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] text-left">
                            <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                              <span>{item.gammeName}</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-semibold ${
                                item.type === 'mono' ? 'bg-blue-100/50 text-blue-700' : 'bg-amber-100/50 text-amber-700'
                              }`}>
                                {item.type === 'mono' ? 'Simple' : 'Palette Mixte'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-600">
                              {item.entries.map((e, eIdx) => (
                                <div key={eIdx} className="flex items-center gap-1 font-medium">
                                  <span>{e.perfume}</span>: 
                                  <span className="font-mono bg-slate-200/50 text-slate-800 px-1 rounded text-[10px] font-bold">
                                    {e.quantity} u
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Normal operators can modify/delete only their own inventory records, admins can do any */}
                        {(currentUser.isAdmin || session.agentId === currentUser.id) ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedSessionForPrint(session);
                              }}
                              className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-all font-semibold cursor-pointer flex items-center gap-1"
                              title="Imprimer cet inventaire"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Imprimer</span>
                            </button>
                            <button
                              onClick={() => handleStartEditSession(session)}
                              className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-all font-semibold cursor-pointer flex items-center gap-1"
                              title="Modifier cet inventaire"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Modifier</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session)}
                              className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 text-slate-400 transition-all font-semibold cursor-pointer flex items-center gap-1"
                              title="Supprimer cet inventaire"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Supprimer</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-300 text-[10px] font-semibold italic">Verrouillé</span>
                        )}
                      </div>
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
            const userSessions = getValidatedSessions(inventories).filter(s => s.agentId === currentUser.id);
            const mostRecentSessionId = userSessions.length > 0 ? userSessions[0].id : undefined;
            const printedPages = getFormattedPrintPages(currentUser.id, mostRecentSessionId);
            const totalActivePalettes = inventories.filter(inv => mostRecentSessionId ? (inv.validationId === mostRecentSessionId || (!inv.validationId && inv.id === mostRecentSessionId)) : inv.agentId === currentUser.id).length;
            const grandTotalQty = inventories.filter(inv => mostRecentSessionId ? (inv.validationId === mostRecentSessionId || (!inv.validationId && inv.id === mostRecentSessionId)) : inv.agentId === currentUser.id).reduce((acc, item) => acc + item.entries.reduce((sum, e) => sum + e.quantity, 0), 0);

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
                const userSessions = getValidatedSessions(inventories).filter(s => s.agentId === currentUser.id);
                const mostRecentSessionId = userSessions.length > 0 ? userSessions[0].id : undefined;
                const printedPages = getFormattedPrintPages(currentUser.id, mostRecentSessionId);
                const totalActivePalettes = inventories.filter(inv => mostRecentSessionId ? (inv.validationId === mostRecentSessionId || (!inv.validationId && inv.id === mostRecentSessionId)) : inv.agentId === currentUser.id).length;
                const grandTotalQty = inventories.filter(inv => mostRecentSessionId ? (inv.validationId === mostRecentSessionId || (!inv.validationId && inv.id === mostRecentSessionId)) : inv.agentId === currentUser.id).reduce((acc, item) => acc + item.entries.reduce((sum, e) => sum + e.quantity, 0), 0);

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

      {/* EDIT SESSION MODAL */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl text-slate-850">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" /> Modifier l'Inventaire {editingSession.numberCode}
                </h3>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  Saisie d'origine par {editingSession.agentName} le {new Date(editingSession.createdAt).toLocaleDateString('fr-FR')} à {new Date(editingSession.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', hour12: false})}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setEditingItems([]);
                  setDeletedItemIds([]);
                }}
                className="bg-white border border-slate-200 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Metrics Summary Bar */}
            {(() => {
              const totalPalettes = editingItems.length;
              const totalCartons = editingItems.reduce((sum, item) => sum + item.entries.reduce((eSum, e) => eSum + e.quantity, 0), 0);
              return (
                <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-3 flex items-center justify-between text-xs text-blue-900 font-medium">
                  <div className="flex items-center gap-4">
                    <span>Total Palettes : <strong className="font-extrabold text-blue-950">{totalPalettes}</strong></span>
                    <span>Total Cartons : <strong className="font-extrabold text-blue-950">{totalCartons}</strong></span>
                  </div>
                  {deletedItemIds.length > 0 && (
                    <span className="text-[11px] text-rose-600 font-semibold italic">
                      {deletedItemIds.length} palette(s) supprimée(s)
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* Existing / Added Palettes List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Palettes dans l'inventaire ({editingItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPaletteForm(!showAddPaletteForm);
                      if (!editAddGammeId && gammes.length > 0) {
                        setEditAddGammeId(gammes[0].id);
                        if (gammes[0].perfumes.length > 0) {
                          setEditAddPerfume(gammes[0].perfumes[0]);
                        }
                        setEditAddQty(gammes[0].standardQuantity || 100);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-all border border-blue-200 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showAddPaletteForm ? "Masquer formulaire" : "Ajouter une palette"}
                  </button>
                </div>

                {/* Form to Add a New Palette */}
                {showAddPaletteForm && (
                  <div className="bg-blue-50/40 border-2 border-dashed border-blue-200 p-4 rounded-2xl space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-900 uppercase">Nouvelle Palette</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditAddType('mono')}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                            editAddType === 'mono' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          Simple (Mono)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditAddType('mixte')}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                            editAddType === 'mixte' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          Palette Mixte
                        </button>
                      </div>
                    </div>

                    {/* Gamme Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Gamme :</label>
                      <select
                        value={editAddGammeId}
                        onChange={(e) => {
                          const gid = e.target.value;
                          setEditAddGammeId(gid);
                          const selectedG = gammes.find(g => g.id === gid);
                          if (selectedG) {
                            if (selectedG.perfumes.length > 0) {
                              setEditAddPerfume(selectedG.perfumes[0]);
                            }
                            setEditAddQty(selectedG.standardQuantity || 100);
                          }
                          setEditAddMixedEntries([]);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-250 rounded-xl bg-white font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      >
                        {gammes.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Mono Palette Controls */}
                    {editAddType === 'mono' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Parfum :</label>
                          <select
                            value={editAddPerfume}
                            onChange={(e) => setEditAddPerfume(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-250 rounded-xl bg-white font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                          >
                            {(gammes.find(g => g.id === editAddGammeId)?.perfumes || []).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Quantité Cartons :</label>
                          <input
                            type="number"
                            min="1"
                            value={editAddQty}
                            onChange={(e) => setEditAddQty(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 text-xs border border-slate-250 rounded-xl bg-white font-bold font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Mixte Palette Controls */}
                    {editAddType === 'mixte' && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {(gammes.find(g => g.id === editAddGammeId)?.perfumes || []).map(perfume => {
                            const isSelected = editAddMixedEntries.some(e => e.perfume === perfume);
                            const active = editAddActivePerfume === perfume;
                            return (
                              <button
                                key={perfume}
                                type="button"
                                onClick={() => {
                                  setEditAddActivePerfume(active ? null : perfume);
                                  const selG = gammes.find(g => g.id === editAddGammeId);
                                  setEditAddMixedQtyInput(selG?.standardQuantity?.toString() || '100');
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                                  isSelected 
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                    : active 
                                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {perfume} {isSelected && '✓'}
                              </button>
                            );
                          })}
                        </div>

                        {editAddActivePerfume && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-800">{editAddActivePerfume}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={editAddMixedQtyInput}
                                onChange={(e) => setEditAddMixedQtyInput(e.target.value)}
                                className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono font-bold text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const q = parseInt(editAddMixedQtyInput, 10) || 0;
                                  if (q <= 0) return;
                                  setEditAddMixedEntries(prev => [
                                    ...prev.filter(e => e.perfume !== editAddActivePerfume),
                                    { perfume: editAddActivePerfume, qty: q }
                                  ]);
                                  setEditAddActivePerfume(null);
                                }}
                                className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 cursor-pointer"
                              >
                                Valider Parfum
                              </button>
                            </div>
                          </div>
                        )}

                        {editAddMixedEntries.length > 0 && (
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Parfums choisis :</span>
                            <div className="flex flex-wrap gap-2">
                              {editAddMixedEntries.map(e => (
                                <span key={e.perfume} className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                                  {e.perfume}: <strong>{e.qty}</strong>
                                  <button
                                    type="button"
                                    onClick={() => setEditAddMixedEntries(prev => prev.filter(x => x.perfume !== e.perfume))}
                                    className="text-amber-600 hover:text-amber-900 cursor-pointer font-bold"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleAddPaletteToEditSession}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Confirmer l'ajout de cette palette
                      </button>
                    </div>
                  </div>
                )}

                {/* List of items */}
                {editingItems.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs text-slate-400 italic">
                      Aucune palette dans cet inventaire. Vous pouvez en ajouter une ci-dessus.
                    </p>
                  </div>
                ) : (
                  editingItems.map((item, idx) => (
                    <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400 font-mono">#{idx + 1}</span>
                          <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">{item.gammeName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.type === 'mono' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.type === 'mono' ? 'Simple' : 'Palette Mixte'}
                          </span>
                          {item.isNew && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                              Nouveau
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEditingItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                          title="Supprimer cette palette"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-[10px] font-semibold hidden sm:inline">Supprimer</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {item.entries.map((entry, entryIdx) => (
                          <div key={entryIdx} className="flex items-center justify-between gap-4 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                            <span className="text-xs font-semibold text-slate-700">{entry.perfume}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={entry.quantity}
                                onChange={(e) => handleUpdateEditingItemQty(item.id, entry.perfume, parseInt(e.target.value, 10) || 0)}
                                className="w-20 px-2 py-1 text-xs text-right border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono font-bold text-slate-800 bg-slate-50"
                              />
                              <span className="text-[10px] font-bold text-slate-400">cartons</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}

              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setEditingItems([]);
                  setDeletedItemIds([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-850 cursor-pointer bg-white border border-slate-200 rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveSessionEdit}
                disabled={isUpdatingSession}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-blue-200"
              >
                {isUpdatingSession ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer les modifications
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SCANNER SIMULATION MODAL (FOR WEB PREVIEW COMPATIBILITY & OFFLINE TESTING) */}
      {isSimulationOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl text-slate-850">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-600 animate-pulse" /> Simulateur Scanner Android Natif
                </h3>
                <p className="text-[11px] text-slate-500 font-sans">
                  Mode Émulation Web (Google ML Kit simulé)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulationOpen(false)}
                className="bg-white border border-slate-200 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-left">
              <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-xl space-y-1.5">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">💡 Comportement Réel de l'APK</h4>
                <p className="text-[11px] text-indigo-750 leading-relaxed font-semibold">
                  Dans l'application Android (.APK), cliquer sur ce bouton ouvre instantanément l'appareil photo avec un lecteur de codes-barres matériel natif basé sur <strong className="font-extrabold">Google ML Kit</strong>.
                </p>
                <ul className="text-[10px] text-indigo-750 list-disc list-inside space-y-1">
                  <li>Aucun bug de permission WebRTC ou navigateur</li>
                  <li>Détection instantanée et fermeture automatique du scanner</li>
                  <li>Fonctionne entièrement <strong className="font-bold">hors ligne</strong> dans les hangars de stockage</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 block uppercase">Entrez ou Collez un payload QR de Palette :</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="PALETTE|N°_Palette|ID_Gamme|Nom_Gamme|mono/mixte|Parfum:Qte"
                    value={simulationPayload}
                    onChange={(e) => setSimulationPayload(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-250 rounded-xl text-xs font-mono bg-slate-50 text-slate-800 outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                  <button
                    onClick={() => {
                      if (!simulationPayload.trim()) return;
                      handleProcessScannedCode(simulationPayload.trim());
                      setSimulationPayload('');
                      setIsSimulationOpen(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Simuler Scan
                  </button>
                </div>
              </div>

              {/* Quick simulation shortcuts */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Raccourcis de Test Rapide (Gamme & Parfums réels) :</span>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {gammes.flatMap(g => 
                    g.perfumes.map(p => {
                      const payload = `PALETTE|sc_${Math.floor(100 + Math.random() * 900)}|${g.id}|${g.name}|mono|${p}:${g.standardQuantity || 100}`;
                      return (
                        <button
                          key={`${g.id}-${p}`}
                          onClick={() => {
                            handleProcessScannedCode(payload);
                            setIsSimulationOpen(false);
                          }}
                          className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer transition-all"
                        >
                          <span className="truncate max-w-[280px] font-bold text-slate-850">{g.name} — <span className="font-semibold text-indigo-600">{p}</span></span>
                          <span className="text-[10px] text-slate-400 font-mono">Simuler</span>
                        </button>
                      );
                    })
                  ).slice(0, 5)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex justify-end">
              <button
                type="button"
                onClick={() => setIsSimulationOpen(false)}
                className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-850 bg-white border border-slate-200 rounded-xl cursor-pointer transition-all"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT-ONLY SPECIFIC SESSION */}
      {selectedSessionForPrint && createPortal(
        <div className="hidden print:block bg-white text-black p-0" id="print-specific-session-area">
          {(() => {
            const printedPages = getFormattedPrintPages(selectedSessionForPrint.agentId, selectedSessionForPrint.id);
            const totalActivePalettes = inventories.filter(inv => (inv.validationId === selectedSessionForPrint.id || (!inv.validationId && inv.id === selectedSessionForPrint.id))).length;
            const grandTotalQty = inventories.filter(inv => (inv.validationId === selectedSessionForPrint.id || (!inv.validationId && inv.id === selectedSessionForPrint.id))).reduce((acc, item) => acc + item.entries.reduce((sum, e) => sum + e.quantity, 0), 0);

            return printedPages.map((page, pageIdx) => (
              <div key={pageIdx} className="page-break-after p-0 w-full flex flex-col justify-start gap-6 bg-white text-slate-800 relative font-sans" style={{ pageBreakAfter: 'always' }}>
                <div className="space-y-6">
                  {/* Print Document Header */}
                  <div className="flex justify-between items-start border-b border-slate-350 pb-4 text-left">
                    <div>
                      <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        Rapport d'Inventaire Individuel Consolidé {printedPages.length > 1 ? `(${pageIdx + 1}/${printedPages.length})` : ''}
                      </h1>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span>Comptage {selectedSessionForPrint.numberCode}</span>
                        <span>•</span>
                        <span>YETISTOCK SUIVI</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                      <p className="font-bold text-slate-900">Opérateur : {selectedSessionForPrint.agentName}</p>
                      <p>Dernière activité : {new Date(selectedSessionForPrint.createdAt).toLocaleDateString('fr-FR')} {new Date(selectedSessionForPrint.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', hour12: false})}</p>
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
                                <tr key={`g-row-${rowIdx}`} className="bg-slate-100/90 font-extrabold text-xs uppercase tracking-wider border-b border-slate-355">
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
                  <div className="break-inside-avoid print:break-inside-avoid space-y-4 pt-4 border-t border-slate-200 mt-4 bg-white text-left">
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

    </div>
  );
}
