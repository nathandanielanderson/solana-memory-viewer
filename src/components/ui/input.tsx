import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  // Custom props for Solana Memory Viewer
  isMemoryAddress?: boolean;
  isHexValue?: boolean;
  maxHexLength?: number;
  onHexChange?: (value: string) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, isMemoryAddress, isHexValue, maxHexLength, onHexChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isHexValue) {
        const hexValue = event.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        const truncatedValue = maxHexLength ? hexValue.slice(0, maxHexLength) : hexValue;
        event.target.value = truncatedValue;
        if (onHexChange) {
          onHexChange(truncatedValue);
        }
      }
      if (props.onChange) {
        props.onChange(event);
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isMemoryAddress ? "font-mono" : "",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }