// src/app/data/places.ts

export interface Place {
  id: number;
  name: string;
  category: string;
  distance: number;
  rating: number;
  reviews: number;
  description: string;
  image?: string; // optional so card won't crash / Vercel won't complain
  trending?: boolean;
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
    description: 'Cozy spot with great vibes',
    image: '☕',
    trending: true,
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
    description: 'Perfect for weekend walks',
    image: '🌳',
    trending: true,
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
    description: 'Quiet place to work',
    image: '💻',
    busy: 'Quiet',
  },
  {
    id: 4,
    name: 'Bistro 41',
    category: 'Restaurant',
    distance: 1.2,
    rating: 4.7,
    reviews: 203,
    description: 'Amazing brunch menu',
    image: '🍽️',
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
    description: 'Local artisan goods',
    image: '🛍️',
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
    description: 'Family-friendly weekend events',
    image: '🎟️',
    busy: 'Moderate',
  },
];

export default mockPlaces;