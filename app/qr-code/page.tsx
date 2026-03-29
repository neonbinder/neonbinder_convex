import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import NeonButton from "../../components/modules/NeonButton";
import {
  QrCodeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

function generateAmountImage(amount: string): string {
  const canvas = document.createElement("canvas");
  const text = `$${amount}`;

  // High-res canvas for print clarity (3x scale)
  // Size the canvas tightly around the text with minimal padding
  const scale = 3;
  const fontSize = 56 * scale;
  const vPad = 6 * scale;
  canvas.width = Math.max(120, text.length * 34 + 24) * scale;
  canvas.height = fontSize + vPad * 2;

  const ctx = canvas.getContext("2d")!;
  const radius = 10 * scale;

  // White pill background for print contrast
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
  ctx.fill();

  // Dollar amount text in black — Impact for max readability at small sizes
  ctx.fillStyle = "#000000";
  ctx.font = `${fontSize}px Impact, Arial Black, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL("image/png");
}

export default function QrCodePage() {
  const myProfile = useQuery(api.publicProfile.getMyPublicProfile);
  const [amount, setAmount] = useState("");
  const [generatedAmount, setGeneratedAmount] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<any>(null);

  const handleGenerate = useCallback(async () => {
    if (!myProfile?.username || !amount) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 9999.99)
      return;

    const formatted = parsedAmount % 1 === 0
      ? parsedAmount.toString()
      : parsedAmount.toFixed(2);
    const url = `https://neonbinder.io/u/${myProfile.username}/sale?amt=${formatted}`;

    setGeneratedAmount(formatted);
    setGeneratedUrl(url);

    const amountImage = generateAmountImage(formatted);

    // Dynamic import to avoid SSR issues
    const QRCodeStyling = (await import("qr-code-styling")).default;

    if (qrInstanceRef.current) {
      qrInstanceRef.current.update({
        data: url,
        image: amountImage,
      });
    } else {
      const qrCode = new QRCodeStyling({
        width: 800,
        height: 800,
        type: "canvas",
        data: url,
        image: amountImage,
        margin: 8,
        dotsOptions: {
          color: "#000000",
          type: "dots",
        },
        backgroundOptions: {
          color: "#FFFFFF",
        },
        cornersSquareOptions: {
          color: "#000000",
          type: "extra-rounded",
        },
        cornersDotOptions: {
          color: "#00D558",
          type: "dot",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 4,
          imageSize: 0.35,
          hideBackgroundDots: true,
        },
        qrOptions: {
          errorCorrectionLevel: "H",
        },
      });

      qrInstanceRef.current = qrCode;

      if (qrRef.current) {
        qrRef.current.innerHTML = "";
        qrCode.append(qrRef.current);
      }
    }
  }, [myProfile?.username, amount]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      qrInstanceRef.current = null;
    };
  }, []);

  const handleDownload = () => {
    qrInstanceRef.current?.download({
      name: `neonbinder-qr-${generatedAmount}`,
      extension: "png",
    });
  };

  const handlePrint = async () => {
    if (!qrInstanceRef.current) return;
    const blob = await qrInstanceRef.current.getRawData("png");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>NeonBinder QR - $${generatedAmount}</title></head>
        <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh">
          <img src="${url}" style="max-width:100%;max-height:100vh" onload="window.print();window.close()" />
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGenerate();
  };

  const isValidAmount =
    amount !== "" &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= 9999.99;

  // Profile still loading
  if (myProfile === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No public profile set up
  if (myProfile === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <QrCodeIcon className="w-20 h-20 text-neon-pink mb-6" />
        <h1 className="text-3xl font-bold mb-3">QR Code Generator</h1>
        <p className="text-gray-400 max-w-md mb-6">
          Set up your public profile first to generate sale QR codes.
        </p>
        <a href="/profile">
          <NeonButton>Go to Profile</NeonButton>
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 py-12 px-4">
      <div className="text-center">
        <QrCodeIcon className="w-16 h-16 text-neon-green mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">QR Code Generator</h1>
        <p className="text-gray-400 max-w-md">
          Generate QR codes for in-person card sales. Buyers scan to add items
          to their running total.
        </p>
      </div>

      {/* Amount input */}
      <div className="w-full max-w-xs">
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Sale Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-bold">
            $
          </span>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            max="9999.99"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-8 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-lg font-bold placeholder-gray-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green/30 transition-colors"
          />
        </div>
      </div>

      {/* Generate button */}
      <NeonButton
        disabled={!isValidAmount}
        onClick={handleGenerate}
        size="3"
      >
        Generate QR Code
      </NeonButton>

      {/* QR Code display */}
      {generatedUrl && (
        <div className="flex flex-col items-center gap-6">
          <div
            ref={qrRef}
            className="rounded-2xl p-4 bg-white border border-neon-green/30 [&_canvas]:w-[280px] [&_canvas]:h-[280px]"
            style={{ boxShadow: "0 0 20px rgba(0, 213, 88, 0.15)" }}
          />

          <p className="text-xs text-gray-500 break-all max-w-xs text-center">
            {generatedUrl}
          </p>

          <div className="flex gap-3">
            <NeonButton secondary onClick={handleDownload} size="3">
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Download
            </NeonButton>
            <NeonButton onClick={handlePrint} size="3">
              <PrinterIcon className="w-5 h-5 mr-2" />
              Print
            </NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}
