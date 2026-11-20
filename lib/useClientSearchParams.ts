"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** Reads the query string on the client without `useSearchParams()` (avoids static → CSR bailout). */
export function useClientSearchParams(): URLSearchParams {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(typeof window !== "undefined" ? window.location.search : "");
  }, [pathname]);

  return useMemo(() => new URLSearchParams(search.replace(/^\?/, "")), [search]);
}