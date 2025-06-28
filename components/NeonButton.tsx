import { Button, ButtonProps } from "@radix-ui/themes";
import React from "react";

interface NeonButtonProps extends ButtonProps {
  cancel?: boolean;
  children: React.ReactNode;
}

export default function NeonButton({
  cancel = false,
  children,
  ...props
}: NeonButtonProps) {
  let colorClass: ButtonProps["color"] = "green";
  if (cancel) {
    colorClass = "pink";
  }
  return (
    <Button {...props} color={colorClass}>
      {children}
    </Button>
  );
}
