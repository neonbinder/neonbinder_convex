import { QrCodeIcon } from "@heroicons/react/24/outline";

export default function QrCodePage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <QrCodeIcon className="w-20 h-20 text-neon-pink mb-6" />
      <h1 className="text-3xl font-bold mb-3">QR Code Generator</h1>
      <p className="text-lg text-gray-400 max-w-md">
        Generate QR codes for your collection, listings, and public profile.
      </p>
      <div className="mt-8 bg-neon-yellow text-black px-6 py-4 transform -rotate-1 border-4 border-black inline-block">
        <div className="text-2xl font-bold mb-1">Coming Soon</div>
        <div className="text-sm font-bold">Under Construction</div>
      </div>
    </div>
  );
}
