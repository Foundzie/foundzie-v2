// src/app/data/places.ts

export interface Place {
  id: number;
  name: string;
  category: string;
  distance: number;
  rating: number;
  reviews: number;
  image: string; // <- image is required
  trending?: boolean;
  description: string;
  openUntil?: string;
  busy?: 'Quiet' | 'Moderate' | 'Busy';
}

export const mockPlaces: Place[] = [
  {
    id: 1,
    name: 'Sunny Café',
    category: 'Coffee',
    distance: 0.3,
    rating: 4.8,
    reviews: 124,
    image: '☕',
    trending: true,
    description: 'Cozy spot with great vibes',
    openUntil: '9:00 PM',
    busy: 'Moderate',
  },
  {
    id: 2,
    name: 'Central Park',
    category: 'Parks',
    distance: 0.5,
    rating: 4.9,
    reviews: 892,
    image: '🌳',
    trending: true,
    description: 'Perfect for weekend walks',
    openUntil: 'Always open',
    busy: 'Quiet',
  },
  {
    id: 3,
    name: 'Tech Hub',
    category: 'Workspace',
    distance: 0.8,
    rating: 4.6,
    reviews: 45,
    image: '💻',
    description: 'Quiet place to work',
    openUntil: '10:00 PM',
    busy: 'Quiet',
  },
  {
    id: 4,
    name: 'Bistro 41',
    category: 'Restaurant',
    distance: 1.2,
    rating: 4.7,
    reviews: 203,
    image: '🍽️',
    description: 'Amazing brunch menu',
    openUntil: '11:00 PM',
    busy: 'Busy',
  },
  {
    id: 5,
    name: 'Urban Market',
    category: 'Shopping',
    distance: 1.5,
    rating: 4.5,
    reviews: 156,
    image: '🛍️',
    description: 'Local artisan goods',
    openUntil: '10:00 PM',
    busy: 'Moderate',
  },
  {
    id: 6,
    name: 'Riverside Events',
    category: 'Events',
    distance: 2.1,
    rating: 4.3,
    reviews: 88,
    image: '🎟️',
    description: 'Family-friendly weekend events',
    openUntil: '8:00 PM',
    busy: 'Moderate',
  },
];