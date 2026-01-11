"use client";

import {
  useAuth,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ComingSoon from "./ComingSoon";
import Image from "next/image";
import NeonButton from "../../components/modules/NeonButton";

export default function DashboardPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Neon Binder" width={40} height={40} />
          <span className="neon-header">Neon Binder</span>
        </div>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton />
            <SignUpButton />
          </SignedOut>
          <SignedIn>
            <ProfileButton />
            <UserButton />
            <SignOutButton />
          </SignedIn>
        </div>
      </header>
      <main className="flex-1">
        <ComingSoon />
      </main>
    </>
  );
}

function ProfileButton() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  if (!isSignedIn) {
    return null;
  }

  return (
    <button
      onClick={() => router.push("/profile")}
      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title="Profile Settings"
    >
      <svg
        className="w-6 h-6 text-slate-600 dark:text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </button>
  );
}

function SignOutButton() {
  const { isSignedIn, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <>
      {isSignedIn && (
        <NeonButton cancel onClick={handleSignOut}>
          Sign out
        </NeonButton>
      )}
    </>
  );
}
