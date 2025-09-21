import { Button, ButtonProps } from "@radix-ui/themes";
import React from "react";

interface NeonButtonProps extends ButtonProps {
  cancel?: boolean;
  secondary?: boolean;
  children: React.ReactNode;
}

export default function NeonButton({
  cancel = false,
  secondary = false,
  children,
  ...props
}: NeonButtonProps) {
  let colorClass: ButtonProps["color"] = "green";
  if (cancel) {
    colorClass = "pink";
  }
  if (secondary) {
    colorClass = "blue";
  }
  return (
    <Button {...props} color={colorClass}>
      {children}
    </Button>
  );
}
