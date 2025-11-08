// src/app/data/sos.ts

export interface SosContact {
  id: number;
  name: string;
  role: string;
  phone: string;
  distance?: string; // e.g. "0.8 mi"
  notes?: string;
  type: 'police' | 'medical' | 'fire' | 'general';
}

const sosContacts: SosContact[] = [
  {
    id: 1,
    name: 'Local Police',
    role: 'Emergency dispatch',
    phone: '911',
    distance: '—',
    notes: 'Call for police or urgent safety issues',
    type: 'police',
  },
  {
    id: 2,
    name: 'Nearby Hospital',
    role: 'Emergency room',
    phone: '+1 (331) 555-2010',
    distance: '1.2 mi',
    notes: 'Open 24/7',
    type: 'medical',
  },
  {
    id: 3,
    name: 'Fire Department',
    role: 'Fire & rescue',
    phone: '+1 (331) 555-3011',
    distance: '0.9 mi',
    notes: 'For fire or rescue situations',
    type: 'fire',
  },
  {
    id: 4,
    name: 'City Helpline',
    role: 'Non-emergency city services',
    phone: '+1 (331) 555-4000',
    distance: '—',
    notes: 'For non-urgent issues',
    type: 'general',
  },
];

export default sosContacts;