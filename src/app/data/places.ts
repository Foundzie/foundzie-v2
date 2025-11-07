// src/data/places.ts

export type PlaceCategory =
  | "Coffee"
  | "Parks"
  | "Workspace"
  | "Restaurant"
  | "Emergency"
  | "Other";

export interface Place {
  id: number;
  name: string;
  category: PlaceCategory;
  distance: number; // miles / km later
  rating: number;
  reviews: number;
  image?: string;
  trending?: boolean;
  description?: string;
}

export const mockPlaces: Place[] = [
  {
    id: 1,
    name: "Sunny Café",
    category: "Coffee",
    distance: 0.3,
    rating: 4.8,
    reviews: 124,
    trending: true,
    description: "Cozy spot with great vibes",
  },
  {
    id: 2,
    name: "Central Park",
    category: "Parks",
    distance: 0.5,
    rating: 4.9,
    reviews: 892,
    trending: true,
    description: "Perfect for weekend walks",
  },
  {
    id: 3,
    name: "Tech Hub",
    category: "Workspace",
    distance: 0.8,
    rating: 4.6,
    reviews: 45,
    description: "Quiet place to work",
  },
  {
    id: 4,
    name: "Bistro 41",
    category: "Restaurant",
    distance: 1.2,
    rating: 4.7,
    reviews: 203,
    description: "Amazing brunch menu",
  },
  {
    id: 5,
    name: "Community Center",
    category: "Other",
    distance: 1.5,
    rating: 4.2,
    reviews: 55,
    description: "Local events and activities",
  },
];