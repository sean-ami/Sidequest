import { useEffect } from "react";

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Side Quest Forge` : "Side Quest Forge · Original characters, original lo-fi";
  }, [title]);
}
