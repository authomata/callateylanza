"use client";

import { Button } from "@/components/ui";

export default function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      Imprimir / Guardar como PDF
    </Button>
  );
}
