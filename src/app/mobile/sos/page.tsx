"use client"; // ✅ Add this line at the very top

import BottomNav from "../../components/BottomNav";

export default function SOSPage() {
  const handleSOS = () => {
    alert("🚨 SOS Activated — Live integration coming soon!");
  };

  return (
    <main className="min-h-screen bg-white pb-16 flex flex-col justify-center items-center">
      <h1 className="text-2xl font-bold text-red-600 mb-3">Emergency Mode</h1>
      <p className="text-gray-500 text-sm mb-8 text-center px-6">
        If you’re in danger, tap below to alert your saved contacts and nearest
        responders.
      </p>

      <button
        style={{
          background: "#dc2626",
          color: "white",
          fontSize: "16px",
          fontWeight: 600,
          padding: "14px 28px",
          borderRadius: "12px",
          boxShadow: "0 2px 6px rgba(220,38,38,0.4)",
        }}
        onClick={handleSOS}
      >
        SEND SOS
      </button>

      <BottomNav />
    </main>
  );
}