"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function ComingSoon() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const handleProfileClick = () => {
    router.push("/profile");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden font-sans">
      {/* 90s Construction Stripes Background */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `repeating-linear-gradient(
            45deg,
            #FFE600,
            #FFE600 20px,
            #000000 20px,
            #000000 40px
          )`,
          }}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 text-center">
        {/* Construction Sign */}
        <div className="mb-12 inline-block">
          <div className="bg-neon-yellow text-black px-8 py-6 transform -rotate-2 shadow-2xl border-4 border-black">
            <div className="text-5xl font-bold mb-3">🚧</div>
            <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'Lexend', sans-serif" }}>
              COMING SOON
            </div>
            <div className="text-base font-bold" style={{ fontFamily: "'Lexend', sans-serif" }}>
              UNDER CONSTRUCTION
            </div>
          </div>
        </div>

        {/* Main Heading - Using Neon Font */}
        <h1
          className="text-7xl font-bold mb-8 text-neon-green"
          style={{
            fontFamily: "'Neon', sans-serif",
            textShadow: "0 0 20px rgba(0, 213, 88, 0.8), 0 0 40px rgba(0, 213, 88, 0.4)",
            letterSpacing: "3px",
            fontWeight: "bold",
          }}
        >
          NEON BINDER
        </h1>

        {/* Subtitle */}
        <div className="mb-12 space-y-6">
          <p
            className="text-3xl font-bold text-neon-blue"
            style={{
              fontFamily: "'Lexend', sans-serif",
              textShadow: "0 0 10px rgba(0, 194, 255, 0.6)",
            }}
          >
            Your Collection Management Hub
          </p>

          {/* Features Box */}
          <div className="bg-black border-4 border-neon-purple p-10 space-y-5">
            <p className="text-2xl text-white font-bold leading-relaxed" style={{ fontFamily: "'Lexend', sans-serif" }}>
              📦{" "}
              <span className="text-neon-green" style={{ textShadow: "0 0 10px rgba(0, 213, 88, 0.6)" }}>
                Maintain
              </span>{" "}
              your complete trading card collection in one powerful platform
            </p>
            <p className="text-2xl text-white font-bold leading-relaxed" style={{ fontFamily: "'Lexend', sans-serif" }}>
              🔄{" "}
              <span className="text-neon-blue" style={{ textShadow: "0 0 10px rgba(0, 194, 255, 0.6)" }}>
                Convert
              </span>{" "}
              your inventory into listings across all major card selling platforms
            </p>
            <p className="text-2xl text-white font-bold leading-relaxed" style={{ fontFamily: "'Lexend', sans-serif" }}>
              💰{" "}
              <span className="text-neon-yellow text-black" style={{ textShadow: "0 0 8px rgba(255, 230, 0, 0.8)" }}>
                Maximize
              </span>{" "}
              your sales with multi-platform distribution
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="flex justify-center gap-6 text-5xl py-6">
            <span>💾</span>
            <span>🎴</span>
            <span>💳</span>
            <span>🎴</span>
            <span>💾</span>
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-6">
          <p className="text-2xl font-bold text-neon-pink" style={{ fontFamily: "'Lexend', sans-serif" }}>
            ✨ Get Ready for Launch ✨
          </p>
          {isSignedIn && (
            <button
              onClick={handleProfileClick}
              className="px-10 py-4 bg-neon-green text-black font-bold text-xl rounded-lg hover:bg-neon-yellow transition-all duration-200 transform hover:scale-105 shadow-lg border-3 border-black"
              style={{
                fontFamily: "'Lexend', sans-serif",
                textShadow: "0 0 8px rgba(0, 213, 88, 0.4)",
              }}
            >
              Complete Your Profile →
            </button>
          )}
          <p className="text-lg font-bold text-neon-purple" style={{ fontFamily: "'Lexend', sans-serif" }}>
            Complete your profile information to be ready when we launch
          </p>
        </div>

        {/* 90s Footer Elements */}
        <div className="mt-16 pt-8 border-t-4 border-neon-purple space-y-3">
          <p className="text-lg font-bold text-neon-pink animate-pulse" style={{ fontFamily: "'Lexend', sans-serif" }}>
            ▓▓▓▓▓▓▓░░░░░░░░ 35% Complete
          </p>
          <p className="text-sm text-gray-500" style={{ fontFamily: "'Lexend', sans-serif" }}>
            Built with retro vibes for the modern collector
          </p>
        </div>
      </div>
    </div>
  );
}
