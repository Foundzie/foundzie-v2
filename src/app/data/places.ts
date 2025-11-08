// src/app/data/places.ts

export type Place = {
  id: string;
  name: string;
  category: string;
  distanceMiles: number;
  rating: number;
  reviews: number;
  openUntil: string;
  trending?: boolean;
  description?: string;
};

export const mockPlaces: Place[] = [
  {
    id: "1",
    name: "Sunny Café",
    category: "Coffee",
    distanceMiles: 0.3,
    rating: 4.8,
    reviews: 124,
    openUntil: "9:00 PM",
    trending: true,
    description: "Cozy spot with great vibes",
  },
  {
    id: "2",
    name: "Central Park",
    category: "Parks",
    distanceMiles: 0.5,
    rating: 4.9,
    reviews: 892,
    openUntil: "Always open",
    trending: true,
    description: "Perfect for weekend walks",
  },
  {
    id: "3",
    name: "Tech Hub",
    category: "Workspaces",
    distanceMiles: 0.8,
    rating: 4.6,
    reviews: 45,
    openUntil: "6:00 PM",
    description: "Quiet place to work",
  },
  {
    id: "4",
    name: "Bistro 41",
    category: "Restaurant",
    distanceMiles: 1.2,
    rating: 4.7,
    reviews: 203,
    openUntil: "11:00 PM",
    description: "Amazing brunch menu",
  },
  {
    id: "5",
    name: "Urban Market",
    category: "Shopping",
    distanceMiles: 1.6,
    rating: 4.3,
    reviews: 76,
    openUntil: "10:00 PM",
    description: "Local shops and vendors",
  },
  {
    id: "6",
    name: "Riverside Events",
    category: "Events",
    distanceMiles: 2.1,
    rating: 4.5,
    reviews: 32,
    openUntil: "10:30 PM",
    description: "Live music and meetups",
  },
];
