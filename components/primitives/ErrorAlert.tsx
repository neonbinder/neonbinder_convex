import React from "react";

interface ErrorAlertProps {
  error: string | null;
}

export const ErrorAlert = React.forwardRef<HTMLDivElement, ErrorAlertProps>(
  ({ error }, ref) => {
    if (!error) return null;

    return (
      <div
        ref={ref}
        className="bg-neon-pink/10 border-2 border-neon-pink rounded-lg p-4"
      >
        <p className="text-neon-pink text-sm font-medium">Error: {error}</p>
      </div>
    );
  }
);

ErrorAlert.displayName = "ErrorAlert";
