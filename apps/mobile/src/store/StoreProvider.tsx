import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Profile } from "@taxgabay/tax-engine";
import * as React from "react";
import { EMPTY_STATE, parseState, reducer, serializeState, STORAGE_KEY, type AppState } from "./core";

interface Store {
  state: AppState;
  ready: boolean;
  saveProfile: (p: Profile) => void;
  toggleObligation: (id: string) => void;
  reset: () => void;
}

const StoreContext = React.createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, EMPTY_STATE);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) dispatch({ type: "hydrate", state: parseState(raw) });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after hydration only, so an empty first render never overwrites saved data.
  React.useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, serializeState(state)).catch(() => undefined);
  }, [state, ready]);

  const value = React.useMemo<Store>(
    () => ({
      state,
      ready,
      saveProfile: (profile) => dispatch({ type: "saveProfile", profile }),
      toggleObligation: (id) => dispatch({ type: "toggleObligation", id }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [state, ready],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = React.useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
