'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import { Bell, MapPin, Zap, Users, X, Archive } from 'lucide-react';

const mockNotifications = [
  {
    id: 1,
    type: 'trending',
    title: 'Sunny Café is trending',
    description: 'Popular spot getting attention right now',
    distance: '0.3 mi',
    time: '2 mins ago',
    icon: Zap,
    color: 'bg-yellow-50 border-yellow-200',
    actionColor: 'text-yellow-700',
  },
  {
    id: 2,
    type: 'nearby',
    title: 'New place nearby: Urban Market',
    description: 'Shopping spot just added to your area',
    distance: '1.5 mi',
    time: '15 mins ago',
    icon: MapPin,
    color: 'bg-blue-50 border-blue-200',
    actionColor: 'text-blue-700',
  },
  {
    id: 3,
    type: 'event',
    title: 'Weekend event: Tech Meetup',
    description: 'Join local developers at Central Park',
    distance: '0.5 mi',
    time: '1 hour ago',
    icon: Users,
    color: 'bg-purple-50 border-purple-200',
    actionColor: 'text-purple-700',
  },
  {
    id: 4,
    type: 'recommendation',
    title: 'Someone recommended Bistro 41',
    description: 'Your friend Sarah loved this place',
    distance: '1.2 mi',
    time: '3 hours ago',
    icon: Users,
    color: 'bg-green-50 border-green-200',
    actionColor: 'text-green-700',
  },
  {
    id: 5,
    type: 'alert',
    title: 'Crowded alert: Central Park',
    description: 'Peak hours detected, consider visiting later',
    distance: '0.5 mi',
    time: '5 hours ago',
    icon: Bell,
    color: 'bg-red-50 border-red-200',
    actionColor: 'text-red-700',
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const handleDismiss = (id: number) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const handleArchive = (id: number) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Notifications</h1>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`py-2 px-4 text-sm font-medium rounded-lg transition ${
                filter === 'all'
                  ? 'bg-purple-100 text-purple-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`py-2 px-4 text-sm font-medium rounded-lg transition ${
                filter === 'unread'
                  ? 'bg-purple-100 text-purple-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread
            </button>
          </div>
        </div>
      </header>

      {/* Notifications List */}
      <section className="px-4 py-4">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const IconComponent = notif.icon;
              return (
                <div
                  key={notif.id}
                  className={`border rounded-lg p-4 ${notif.color} hover:shadow-md transition`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center ${notif.actionColor}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">
                        {notif.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2">
                        {notif.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{notif.distance}</span>
                          <span>•</span>
                          <span>{notif.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleArchive(notif.id)}
                        className="p-1 hover:bg-white rounded transition"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                      </button>
                      <button
                        onClick={() => handleDismiss(notif.id)}
                        className="p-1 hover:bg-white rounded transition"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                      </button>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button className="w-full mt-3 py-2 px-3 bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium rounded-lg transition border border-gray-200">
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No notifications</p>
            <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
          </div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}