import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";

export type CellRef = {
  shapeId: number;
  number: number;
  regionId: number;
};

export type ClueNode = {
  id: string;
  title: string;
  summary?: string;
  cellRefs: CellRef[];
  discovered: boolean;
};

export type DeductionSlot = {
  id: string;
  clueId: string;
  label: string;
};

export type DeductionSentence = {
  id: string;
  text: string;
  slots: DeductionSlot[];
  validated: boolean;
};

type DeductionState = {
  clues: Record<string, ClueNode>;
  sentences: Record<string, DeductionSentence>;
};

type HydratePayload = {
  clues: ClueNode[];
  sentences: DeductionSentence[];
};

type DeductionAction =
  | { type: "HYDRATE"; payload: HydratePayload }
  | { type: "SET_CLUE_DISCOVERED"; id: string; discovered: boolean }
  | { type: "SET_SENTENCE_VALIDATED"; id: string; validated: boolean };

const initialState: DeductionState = {
  clues: {},
  sentences: {},
};

function mergeMaps<T extends { id: string }>(
  current: Record<string, T>,
  nextItems: T[],
  merge: (existing: T | undefined, incoming: T) => T
) {
  const nextMap: Record<string, T> = {};
  const incomingIds = new Set<string>();
  nextItems.forEach((item) => {
    incomingIds.add(item.id);
    nextMap[item.id] = merge(current[item.id], item);
  });
  // Drop entities that are no longer present
  Object.keys(current).forEach((id) => {
    if (!incomingIds.has(id)) {
      delete nextMap[id];
    }
  });
  return nextMap;
}

function deductionReducer(state: DeductionState, action: DeductionAction): DeductionState {
  switch (action.type) {
    case "HYDRATE": {
      const { clues, sentences } = action.payload;
      const mergedClues = mergeMaps(state.clues, clues, (existing, incoming) => ({
        ...incoming,
        discovered: existing?.discovered ?? incoming.discovered ?? false,
      }));
      const mergedSentences = mergeMaps(state.sentences, sentences, (existing, incoming) => ({
        ...incoming,
        validated: existing?.validated ?? incoming.validated ?? false,
      }));
      return {
        clues: mergedClues,
        sentences: mergedSentences,
      };
    }
    case "SET_CLUE_DISCOVERED": {
      if (!state.clues[action.id]) return state;
      return {
        ...state,
        clues: {
          ...state.clues,
          [action.id]: {
            ...state.clues[action.id],
            discovered: action.discovered,
          },
        },
      };
    }
    case "SET_SENTENCE_VALIDATED": {
      if (!state.sentences[action.id]) return state;
      return {
        ...state,
        sentences: {
          ...state.sentences,
          [action.id]: {
            ...state.sentences[action.id],
            validated: action.validated,
          },
        },
      };
    }
    default:
      return state;
  }
}

type DeductionContextValue = DeductionState & {
  hydrate: (clues: ClueNode[], sentences: DeductionSentence[]) => void;
  setClueDiscovered: (id: string, discovered?: boolean) => void;
  setSentenceValidated: (id: string, validated?: boolean) => void;
};

const DeductionStoreContext = createContext<DeductionContextValue | undefined>(undefined);

export const DeductionStoreProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(deductionReducer, initialState);

  const hydrate = useCallback((clues: ClueNode[], sentences: DeductionSentence[]) => {
    dispatch({ type: "HYDRATE", payload: { clues, sentences } });
  }, []);

  const setClueDiscovered = useCallback((id: string, discovered: boolean = true) => {
    dispatch({ type: "SET_CLUE_DISCOVERED", id, discovered });
  }, []);

  const setSentenceValidated = useCallback((id: string, validated: boolean = true) => {
    dispatch({ type: "SET_SENTENCE_VALIDATED", id, validated });
  }, []);

  const value = useMemo<DeductionContextValue>(() => ({
    ...state,
    hydrate,
    setClueDiscovered,
    setSentenceValidated,
  }), [state, hydrate, setClueDiscovered, setSentenceValidated]);

  return <DeductionStoreContext.Provider value={value}>{children}</DeductionStoreContext.Provider>;
};

export function useDeductionStore(): DeductionContextValue {
  const ctx = useContext(DeductionStoreContext);
  if (!ctx) {
    throw new Error("useDeductionStore must be used within a DeductionStoreProvider");
  }
  return ctx;
}

