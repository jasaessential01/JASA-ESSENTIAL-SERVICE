
import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, ...props }, ref) => {
    if (prefix) {
      return (
        <div className={cn(
          "flex h-10 w-full items-center rounded-md border border-input bg-background text-base ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:text-sm",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}>
          <span className="px-3 text-muted-foreground">{prefix}</span>
          <input
            type={type}
            className="h-full w-full bg-transparent pr-3 outline-none placeholder:text-muted-foreground"
            ref={ref}
            {...props}
          />
        </div>
      )
    }
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
