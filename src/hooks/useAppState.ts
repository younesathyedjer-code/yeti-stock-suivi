/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, getDocFromServer } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Agent, Gamme, Palette, InventoryItem, PaletteEntry, InventoryEntry } from '../types';

export function useAppState() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [gammes, setGammes] = useState<Gamme[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);

  const [currentUser, setCurrentUser] = useState<Agent | null>(() => {
    try {
      const data = sessionStorage.getItem('parfums_current_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  // Test Firestore Connection on Boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or network status.");
        }
      }
    }
    testConnection();
  }, []);

  // Sync Current User with sessionStorage
  useEffect(() => {
    try {
      if (currentUser) {
        sessionStorage.setItem('parfums_current_user', JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem('parfums_current_user');
      }
    } catch (e) {
      console.error('Error saving session:', e);
    }
  }, [currentUser]);

  // Real-time Listeners for Firestore Collections
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'agents'), (snapshot) => {
      const list: Agent[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Agent);
      });
      setAgents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agents');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'gammes'), (snapshot) => {
      const list: Gamme[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Gamme);
      });
      setGammes(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gammes');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'palettes'), (snapshot) => {
      const list: Palette[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Palette);
      });
      // Sort palettes chronologically by creation date
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setPalettes(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'palettes');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventories'), (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as InventoryItem);
      });
      // Sort inventories descending by creation time (most recent first)
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInventories(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventories');
    });
    return () => unsub();
  }, []);

  // Auto-sync Current User attributes when changed in the Database (or log-out if deleted)
  useEffect(() => {
    if (currentUser) {
      const updatedMe = agents.find((a) => a.id === currentUser.id);
      if (updatedMe) {
        if (JSON.stringify(updatedMe) !== JSON.stringify(currentUser)) {
          setCurrentUser(updatedMe);
        }
      } else if (agents.length > 0) {
        // If agents list has loaded and I'm not in it anymore, log out
        setCurrentUser(null);
      }
    }
  }, [agents, currentUser]);

  // Dynamically compute next sequence codes from real-time database state
  const currentPaletteSeq = palettes.length > 0
    ? Math.max(...palettes.map(p => parseInt(p.numberCode, 10) || 0)) + 1
    : 1;

  const currentInventorySeq = inventories.length > 0
    ? Math.max(...inventories.map(i => parseInt(i.numberCode, 10) || 0)) + 1
    : 1;

  // Format Helper e.g. 01, 09, 10
  const formatSeqNumber = (seq: number): string => {
    return seq < 10 ? `0${seq}` : `${seq}`;
  };

  // Safe unique ID generator
  const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `id_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
  };

  // --- Auth / Security Actions ---
  const registerFirstAdmin = async (name: string, pin: string) => {
    const newAdmin: Agent = {
      id: generateUUID(),
      name,
      pin,
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'agents', newAdmin.id), newAdmin);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `agents/${newAdmin.id}`);
    }
    setCurrentUser(newAdmin);
    return newAdmin;
  };

  const loginWithPin = (pin: string): { success: boolean; error?: string } => {
    const foundAgent = agents.find(a => a.pin === pin);
    if (foundAgent) {
      setCurrentUser(foundAgent);
      return { success: true };
    }
    return { success: false, error: 'Code PIN incorrect.' };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // --- Agent Operators Management ---
  const addAgent = async (name: string, pin: string, isAdmin: boolean) => {
    if (agents.some(a => a.pin === pin)) {
      throw new Error('Ce code PIN est déjà attribué à un autre agent.');
    }
    const newAgent: Agent = {
      id: generateUUID(),
      name,
      pin,
      isAdmin,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'agents', newAgent.id), newAgent);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `agents/${newAgent.id}`);
    }
    return newAgent;
  };

  const updateAgent = async (id: string, name: string, pin: string, isAdmin: boolean) => {
    if (agents.some(a => a.pin === pin && a.id !== id)) {
      throw new Error('Ce code PIN est déjà attribué à un autre agent.');
    }
    try {
      await updateDoc(doc(db, 'agents', id), { name, pin, isAdmin });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `agents/${id}`);
    }
  };

  const deleteAgent = async (id: string) => {
    if (currentUser?.id === id) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte administrateur connecté.');
    }
    try {
      await deleteDoc(doc(db, 'agents', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `agents/${id}`);
    }
  };

  const updateAdminPin = async (newPin: string) => {
    if (!currentUser) throw new Error('Aucun utilisateur n\'est connecté.');
    await updateAgent(currentUser.id, currentUser.name, newPin, currentUser.isAdmin);
  };

  // --- Gammes & Perfumes Management ---
  const addGamme = async (name: string, perfumes: string[], standardQuantity?: number, perfumeAbbreviations?: Record<string, string>) => {
    if (gammes.some(g => g.name.toLowerCase().trim() === name.toLowerCase().trim())) {
      throw new Error('Cette gamme de produits existe déjà.');
    }
    const filteredPerfumes = perfumes.map(p => p.trim()).filter(p => p.length > 0);
    const newGamme: Gamme = {
      id: generateUUID(),
      name: name.trim(),
      perfumes: filteredPerfumes,
      perfumeAbbreviations: perfumeAbbreviations || {},
      standardQuantity: standardQuantity || 100,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'gammes', newGamme.id), newGamme);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `gammes/${newGamme.id}`);
    }
    return newGamme;
  };

  const updateGamme = async (id: string, name: string, perfumes: string[], standardQuantity?: number, perfumeAbbreviations?: Record<string, string>) => {
    if (gammes.some(g => g.name.toLowerCase().trim() === name.toLowerCase().trim() && g.id !== id)) {
      throw new Error('Une autre gamme avec ce nom existe déjà.');
    }
    const filteredPerfumes = perfumes.map(p => p.trim()).filter(p => p.length > 0);
    try {
      await updateDoc(doc(db, 'gammes', id), { 
        name: name.trim(), 
        perfumes: filteredPerfumes, 
        standardQuantity: standardQuantity || 100,
        perfumeAbbreviations: perfumeAbbreviations || {}
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gammes/${id}`);
    }
  };

  const deleteGamme = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'gammes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gammes/${id}`);
    }
  };

  // --- Palettes (Saisie) Actions ---
  const addMonoPalette = async (
    gammeId: string,
    gammeName: string,
    perfume: string,
    qty: number,
    shift: 'jour' | 'nuit'
  ) => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');

    const numCode = formatSeqNumber(currentPaletteSeq);
    const newPalette: Palette = {
      id: generateUUID(),
      numberCode: numCode,
      agentId: currentUser.id,
      agentName: currentUser.name,
      gammeId,
      gammeName,
      type: 'mono',
      entries: [
        {
          perfume,
          quantityDay: shift === 'jour' ? qty : 0,
          quantityNight: shift === 'nuit' ? qty : 0,
        },
      ],
      lastUpdatedShift: shift,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'palettes', newPalette.id), newPalette);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `palettes/${newPalette.id}`);
    }
    return newPalette;
  };

  const addMixtePalette = async (
    gammeId: string,
    gammeName: string,
    perfumeEntries: { perfume: string; qty: number; shift: 'jour' | 'nuit' }[]
  ) => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    if (perfumeEntries.length === 0) throw new Error('Aucun parfum sélectionné pour la palette mixte.');

    const entriesMap: { [perfume: string]: { day: number; night: number } } = {};
    let lastShift: 'jour' | 'nuit' = 'jour';

    perfumeEntries.forEach(entry => {
      if (!entriesMap[entry.perfume]) {
        entriesMap[entry.perfume] = { day: 0, night: 0 };
      }
      if (entry.shift === 'jour') {
        entriesMap[entry.perfume].day += entry.qty;
      } else {
        entriesMap[entry.perfume].night += entry.qty;
      }
      lastShift = entry.shift;
    });

    const entries: PaletteEntry[] = Object.keys(entriesMap).map(perfume => ({
      perfume,
      quantityDay: entriesMap[perfume].day,
      quantityNight: entriesMap[perfume].night,
    }));

    const numCode = formatSeqNumber(currentPaletteSeq);
    const newPalette: Palette = {
      id: generateUUID(),
      numberCode: numCode,
      agentId: currentUser.id,
      agentName: currentUser.name,
      gammeId,
      gammeName,
      type: 'mixte',
      entries,
      lastUpdatedShift: lastShift,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'palettes', newPalette.id), newPalette);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `palettes/${newPalette.id}`);
    }
    return newPalette;
  };

  const updatePaletteShiftQty = async (
    paletteId: string,
    perfume: string,
    qty: number,
    shift: 'jour' | 'nuit'
  ) => {
    const p = palettes.find(item => item.id === paletteId);
    if (!p) return;

    const existingEntryIndex = p.entries.findIndex(e => e.perfume === perfume);
    const updatedEntries = [...p.entries];

    if (existingEntryIndex !== -1) {
      const entry = updatedEntries[existingEntryIndex];
      updatedEntries[existingEntryIndex] = {
        ...entry,
        quantityDay: shift === 'jour' ? entry.quantityDay + qty : entry.quantityDay,
        quantityNight: shift === 'nuit' ? entry.quantityNight + qty : entry.quantityNight,
      };
    } else {
      updatedEntries.push({
        perfume,
        quantityDay: shift === 'jour' ? qty : 0,
        quantityNight: shift === 'nuit' ? qty : 0,
      });
    }

    try {
      await updateDoc(doc(db, 'palettes', paletteId), {
        entries: updatedEntries,
        lastUpdatedShift: shift,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `palettes/${paletteId}`);
    }
  };

  const deletePalette = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'palettes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `palettes/${id}`);
    }
  };

  const updatePalette = async (
    id: string,
    gammeId: string,
    gammeName: string,
    type: 'mono' | 'mixte',
    entries: PaletteEntry[],
    lastUpdatedShift: 'jour' | 'nuit'
  ) => {
    try {
      await updateDoc(doc(db, 'palettes', id), {
        gammeId,
        gammeName,
        type,
        entries,
        lastUpdatedShift,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `palettes/${id}`);
    }
  };

  // --- Independent Inventories Actions ---
  const addInventoryItem = async (
    gammeId: string,
    gammeName: string,
    type: 'mono' | 'mixte',
    entriesList: { perfume: string; qty: number }[]
  ) => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');

    const numCode = formatSeqNumber(currentInventorySeq);
    const entries: InventoryEntry[] = entriesList.map(e => ({
      perfume: e.perfume,
      quantity: e.qty,
    }));

    const newItem: InventoryItem = {
      id: generateUUID(),
      numberCode: numCode,
      agentId: currentUser.id,
      agentName: currentUser.name,
      gammeId,
      gammeName,
      type,
      entries,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'inventories', newItem.id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `inventories/${newItem.id}`);
    }
    return newItem;
  };

  const deleteInventoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventories/${id}`);
    }
  };

  // --- Global Admin Resets ---
  const resetAllPalettes = async () => {
    try {
      const promises = palettes.map(p => deleteDoc(doc(db, 'palettes', p.id)));
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'palettes/all');
    }
  };

  return {
    agents,
    gammes,
    palettes,
    inventories,
    currentUser,
    currentPaletteSeq,
    currentInventorySeq,
    registerFirstAdmin,
    loginWithPin,
    logout,
    addAgent,
    updateAgent,
    deleteAgent,
    updateAdminPin,
    addGamme,
    updateGamme,
    deleteGamme,
    addMonoPalette,
    addMixtePalette,
    updatePaletteShiftQty,
    deletePalette,
    updatePalette,
    addInventoryItem,
    deleteInventoryItem,
    resetAllPalettes,
  };
}
