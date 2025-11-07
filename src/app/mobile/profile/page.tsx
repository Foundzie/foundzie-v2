'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import { Settings, LogOut, Heart, MapPin, Award, Share2, Edit2, ChevronRight } from 'lucide-react';

const savedPlaces = [
  { id: 1, name: 'Sunny Café', category: 'Coffee', distance: '0.3 mi' },
  { id: 2, name: 'Central Park', category: 'Parks', distance: '0.5 mi' },
  { id: 3, name: 'Tech Hub', category: 'Workspace', distance: '0.8 mi' },
  { id: 4, name: 'Bistro 41', category: 'Restaurant', distance: '1.2 mi' },
];

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Settings */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Settings className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </header>

      {/* Profile Card */}
      <section className="px-4 py-4">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl font-bold text-purple-600">
                K
              </div>
              <div>
                <h2 className="text-xl font-bold">Kashif Yusuf</h2>
                <p className="text-sm opacity-90">Local Explorer</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">24</p>
              <p className="text-xs opacity-90">Places Visited</p>
            </div>
            <div>
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs opacity-90">Saved</p>
            </div>
            <div>
              <p className="text-2xl font-bold">4.8</p>
              <p className="text-xs opacity-90">Avg Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Saved Places */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Saved Places
          </h3>
          <a href="#" className="text-purple-600 text-sm font-medium hover:underline">
            See all
          </a>
        </div>

        <div className="space-y-2">
          {savedPlaces.map((place) => (
            <div
              key={place.id}
              className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:shadow-md transition"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{place.name}</p>
                <p className="text-xs text-gray-500">{place.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{place.distance}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-4">
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          Your Stats
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">156</p>
            <p className="text-xs text-gray-600 mt-1">Reviews Written</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">89</p>
            <p className="text-xs text-gray-600 mt-1">Helpful Votes</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">42</p>
            <p className="text-xs text-gray-600 mt-1">Photos Shared</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-pink-600">18</p>
            <p className="text-xs text-gray-600 mt-1">Followers</p>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="px-4 py-4">
        <div className="space-y-2">
          <button className="w-full bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition">
            <span className="flex items-center gap-2 text-gray-900 font-medium text-sm">
              <Share2 className="w-4 h-4" />
              Share Profile
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button className="w-full bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition">
            <span className="flex items-center gap-2 text-gray-900 font-medium text-sm">
              <Settings className="w-4 h-4" />
              Settings
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button className="w-full bg-white border border-red-200 rounded-lg p-3 flex items-center justify-between hover:bg-red-50 transition">
            <span className="flex items-center gap-2 text-red-600 font-medium text-sm">
              <LogOut className="w-4 h-4" />
              Sign Out
            </span>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}