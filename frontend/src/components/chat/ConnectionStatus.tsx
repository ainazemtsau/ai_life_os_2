/**
 * Connection Status indicator component.
 */

import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const isConnected = useConnectionStatus();

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          isConnected ? "bg-green-500" : "bg-red-500"
        )}
      />
      <span className="text-sm text-muted-foreground">
        {isConnected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
