import * as React from "react"
import { cn } from "@/lib/utils"

export function OzLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 117 107"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
      {...props}
    >
      <path
        d="M99.9375 12.1591L94.2294 25.4391L117 41.3409V48.6364H87.75L76.4956 84.5484L87.75 107H75.5625L63.375 82.6818L53.625 92.4091H58.5L65.8125 107H53.625L48.75 97.2727L39 107H0L0.00952148 81.4374L35.9865 87.7687L4.35132 69.5443L11.6638 56.9102L43.2942 75.1251L19.8142 47.2115L31.0162 37.8357L54.5057 65.7636L42.0088 31.5044L55.7531 26.5173L68.25 60.767V24.3182H80.4423L73.2155 17.113L70.6875 7.29545L82.9702 9.81752L87.75 20.9412V9.72727L92.625 0L99.9375 12.1591Z"
        fill="currentColor"
      />
    </svg>
  )
}

