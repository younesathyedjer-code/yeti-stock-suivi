/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Agent {
  id: string;
  name: string;
  pin: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Gamme {
  id: string;
  name: string;
  perfumes: string[]; // List of perfume names
  perfumeAbbreviations?: Record<string, string>; // Maps perfume name to abbreviation
  standardQuantity?: number; // Standard palette quantity default (defaults to e.g. 100)
  createdAt: string;
}

export interface PaletteEntry {
  perfume: string;
  quantityDay: number;
  quantityNight: number;
}

export interface Palette {
  id: string;
  numberCode: string; // "01", "02", "03" ...
  agentId: string;
  agentName: string;
  gammeId: string;
  gammeName: string;
  type: 'mono' | 'mixte';
  entries: PaletteEntry[];
  lastUpdatedShift: 'jour' | 'nuit';
  createdAt: string;
}

// Separate independent model for Inventory
export interface InventoryEntry {
  perfume: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  numberCode: string; // sequential numbering for inventory palettes too, e.g., "01", "02"
  agentId: string;
  agentName: string;
  gammeId: string;
  gammeName: string;
  type: 'mono' | 'mixte';
  entries: InventoryEntry[];
  createdAt: string;
  validationId?: string;
  validationNumber?: number;
  validationTimestamp?: string;
}
