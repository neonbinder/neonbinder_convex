"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LandingPage() {
  const router = useRouter();

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Neon Binder" width={40} height={40} />
          <span className="neon-header">Neon Binder</span>
        </div>
        <div className="flex items-center gap-3">
          <SignInButton mode="modal">
            <button className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white transition-colors">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors">
              Create Account
            </button>
          </SignUpButton>
        </div>
      </header>
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center py-16">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo.png"
                alt="Neon Binder"
                width={120}
                height={120}
                className="animate-pulse"
              />
            </div>
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              Neon Binder
            </h1>
            <p className="text-2xl text-slate-600 dark:text-slate-400 mb-8">
              Your digital card collection hub
            </p>
            <div className="flex gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="px-8 py-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-lg font-semibold transition-colors">
                  Get Started
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-8 py-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-lg font-semibold transition-colors">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-8 my-16">
            <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">
                Multi-Platform Search
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Search across multiple card platforms including BuySportsCards,
                SportLots, and more.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Smart Filters</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Find exactly what you're looking for with powerful filtering
                options for sports, years, manufacturers, and more.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold mb-2">Secure Storage</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Your credentials are encrypted and stored securely in Google
                Cloud Secret Manager.
              </p>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="my-16 p-8 rounded-lg bg-gradient-to-br from-green-900/20 to-blue-900/20 border border-green-500/30">
            <h2 className="text-3xl font-bold mb-8 text-center">
              How It Works
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Connect Your Accounts
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Securely store your login credentials for supported card
                    marketplaces.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Build Your Set Criteria
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Define what you're looking for with detailed set parameters
                    and filters.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Search & Discover
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Let Neon Binder search across platforms to find cards
                    matching your criteria.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center my-16">
            <h2 className="text-4xl font-bold mb-4">
              Ready to Build Your Collection?
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
              Join Neon Binder and start discovering cards across multiple
              platforms.
            </p>
            <div className="flex gap-4 justify-center">
              <SignUpButton mode="modal">
                <button className="px-8 py-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-lg font-semibold transition-colors">
                  Create Free Account
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
