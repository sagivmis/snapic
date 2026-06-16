import { useEffect, useState } from "react";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

export interface NetworkStatus {
  online: boolean;
  saveData: boolean;
  effectiveType: string | null;
  isSlowConnection: boolean;
}

function getConnection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function readNetworkStatus(): NetworkStatus {
  const connection = getConnection();
  const effectiveType = connection?.effectiveType ?? null;
  const saveData = Boolean(connection?.saveData);
  const isSlowConnection =
    saveData || effectiveType === "slow-2g" || effectiveType === "2g";

  return {
    online: navigator.onLine,
    saveData,
    effectiveType,
    isSlowConnection,
  };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => readNetworkStatus());

  useEffect(() => {
    function update() {
      setStatus(readNetworkStatus());
    }

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const connection = getConnection();
    connection?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return status;
}
