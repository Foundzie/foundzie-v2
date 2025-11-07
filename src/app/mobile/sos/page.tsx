'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import { AlertTriangle, Phone, MapPin, Clock, X, CheckCircle } from 'lucide-react';

const emergencyContacts = [
  { id: 1, name: 'Mom', phone: '(555) 123-4567', relation: 'Family' },
  { id: 2, name: 'Sarah', phone: '(555) 987-6543', relation: 'Friend' },
  { id: 3, name: 'Emergency Services', phone: '911', relation: 'Official' },
];

export default function SOSPage() {
  const [sosActive, setSOSActive] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSOS = () => {
    setSOSActive(true);
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Simulate SOS sent
          setTimeout(() => {
            setSOSActive(false);
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancel = () => {
    setSOSActive(false);
    setCountdown(0);
  };

  if (sosActive) {
    return (
      <main className="min-h-screen bg-red-50 pb-20 flex flex-col justify-center items-center">
        <div className="text-center">
          {countdown > 0 ? (
            <>
              <div className="mb-6">
                <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
              </div>
              <h1 className="text-3xl font-bold text-red-600 mb-2">SOS ACTIVATED</h1>
              <p className="text-gray-600 text-sm mb-8">Sending alert in {countdown}...</p>

              <div className="bg-white rounded-lg p-6 mb-6 shadow-lg max-w-sm">
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span>Chicago, IL</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-green-600 mb-2">SOS Sent!</h1>
              <p className="text-gray-600 text-sm mb-8">
                Emergency contacts and responders have been notified
              </p>

              <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Alerts Sent To:</h3>
                <div className="space-y-2">
                  {emergencyContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{contact.name}</span>
                      <span className="text-green-600 font-medium">✓ Sent</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSOSActive(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition"
              >
                Done
              </button>
            </>
          )}
        </div>

        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-red-50 to-white pb-20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-red-600">Emergency Mode</h1>
          <p className="text-xs text-gray-500">Alert your contacts and responders</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8">
        <AlertTriangle className="w-20 h-20 text-red-600 mb-6" />

        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Are you in danger?
        </h2>
        <p className="text-gray-600 text-center mb-8 max-w-sm">
          Tap the button below to immediately alert your emergency contacts and nearby responders with your location.
        </p>

        {/* SOS Button */}
        <button
          onClick={handleSOS}
          className="w-32 h-32 rounded-full bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-2xl shadow-2xl hover:shadow-3xl transition transform hover:scale-105 flex items-center justify-center mb-8"
        >
          SOS
        </button>

        <p className="text-xs text-gray-500 text-center mb-12">
          Hold or tap to send emergency alert
        </p>
      </div>

      {/* Emergency Contacts */}
      <section className="px-4 py-4 bg-white border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Emergency Contacts</h3>

        <div className="space-y-2">
          {emergencyContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{contact.name}</p>
                <p className="text-xs text-gray-500">{contact.relation}</p>
              </div>
              <button className="p-2 hover:bg-white rounded-full transition">
                <Phone className="w-4 h-4 text-green-600" />
              </button>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 py-2 px-4 text-purple-600 font-medium text-sm border border-purple-200 rounded-lg hover:bg-purple-50 transition">
          Manage Contacts
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
