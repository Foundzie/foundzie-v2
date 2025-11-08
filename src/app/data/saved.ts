// src/app/data/saved.ts

export type SavedPlace = {
  id: string;
  name: string;
  category: string;
  distanceMiles?: number;
  description?: string;
  openUntil?: string;
  status?: string;
};

export const mockSavedPlaces: SavedPlace[] = [
  {
    id: "1",
    name: "Sunny Café",
    category: "Coffee",
    distanceMiles: 0.3,
    description: "Your go-to morning spot.",
    openUntil: "9:00 PM",
    status: "Moderate",
  },
  {
    id: "3",
    name: "Tech Hub",
    category: "Workspace",
    distanceMiles: 0.8,
    description: "Quiet place to work.",
    openUntil: "6:00 PM",
    status: "Quiet",
  },
  {
    id: "5",
    name: "Urban Market",
    category: "Shopping",
    distanceMiles: 1.5,
    description: "Local artisan goods.",
    openUntil: "10:00 PM",
    status: "Moderate",
  },
];