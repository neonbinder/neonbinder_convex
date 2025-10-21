"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NeonButton from "../../components/modules/NeonButton";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="neon-header text-neon-green mb-2">NEONBINDER</h1>
          <p className="text-white text-lg font-medium">
            {flow === "signIn" ? "Welcome back" : "Join the collection"}
          </p>
          <p className="text-slate-400 mt-2">
            {flow === "signIn"
              ? "Sign in to access your card collection"
              : "Create your account to start collecting"}
          </p>
        </div>

        {/* Form */}
        <form
          className="space-y-6"
          suppressHydrationWarning
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            formData.set("flow", flow);
            void signIn("password", formData)
              .catch((error) => {
                setError(error.message);
              })
              .then(() => {
                router.push("/");
              });
          }}
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-green focus:border-transparent transition-all duration-200"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-white mb-2"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-green focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg p-4">
              <p className="text-neon-pink text-sm font-medium">
                Error: {error}
              </p>
            </div>
          )}

          <NeonButton
            type="submit"
            className="w-full py-3 text-base font-medium"
          >
            {flow === "signIn" ? "Sign In" : "Create Account"}
          </NeonButton>

          <div className="text-center">
            <span className="text-slate-400">
              {flow === "signIn"
                ? "Don't have an account? "
                : "Already have an account? "}
            </span>
            <button
              type="button"
              className="text-neon-green hover:text-neon-green/80 font-medium transition-colors duration-200"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              {flow === "signIn" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm">
          <p>Secure authentication powered by Convex</p>
        </div>
      </div>
    </div>
  );
}
