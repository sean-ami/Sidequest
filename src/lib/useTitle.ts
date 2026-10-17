import { useEffect } from "react";

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Side Quest Maidens` : "Side Quest Maidens · Original characters, original lo-fi";
  }, [title]);
}
