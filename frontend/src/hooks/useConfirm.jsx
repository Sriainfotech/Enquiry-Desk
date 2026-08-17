import React, { createContext, useContext, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  return (
    <ConfirmContext.Provider value={{ askConfirm: setDialog }}>
      {children}
      <ConfirmDialog dialog={dialog} onClose={() => setDialog(null)} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.askConfirm;
}
