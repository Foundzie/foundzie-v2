// src/app/data/places.ts

// single source of truth for places used on mobile
export const mockPlaces = [
  {
    id: "1",
    name: "Sunny Café",
    category: "Coffee",
    distanceMiles: 0.3,
    rating: 4.8,
    reviews: 124,
    openUntil: "9:00 PM",
    trending: true,
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
  },
  {
    id: "3",
    name: "Tech Hub",
    category: "Workspace",
    distanceMiles: 0.8,
    rating: 4.6,
    reviews: 45,
    openUntil: "6:00 PM",
    trending: false,
  },
  {
    id: "4",
    name: "Bistro 41",
    category: "Restaurant",
    distanceMiles: 1.2,
    rating: 4.7,
    reviews: 203,
    openUntil: "11:00 PM",
    trending: false,
  },
  {
    id: "5",
    name: "Urban Market",
    category: "Shopping",
    distanceMiles: 1.6,
    rating: 4.5,
    reviews: 76,
    openUntil: "10:00 PM",
    trending: false,
  },
  {
    id: "6",
    name: "Riverside Events",
    category: "Events",
    distanceMiles: 2.1,
    rating: 4.4,
    reviews: 31,
    openUntil: "10:30 PM",
    trending: false,
  },
];

export type Place = (typeof mockPlaces)[number];
