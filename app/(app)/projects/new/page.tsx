import Link from "next/link";
import { createProject } from "../actions";
import { Button, Card } from "@/components/ui";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link href="/dashboard" className="text-sm text-muted hover:underline">
          ← Proyectos
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nuevo proyecto</h1>
        <p className="text-sm text-muted">
          Crea el cliente y su kit. Se generan los 10 entregables en estado pendiente (D2–D8
          bloqueados hasta aprobar el Manual Maestro).
        </p>
      </div>

      <Card className="p-6">
        <form action={createProject} className="space-y-4">
          <Field name="cliente_nombre" label="Nombre del cliente" required placeholder="Marcelo Pérez" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="cliente_ciudad" label="Ciudad" placeholder="Curicó" />
            <Field name="cliente_rubro" label="Rubro" placeholder="Arriería / cordillera" />
          </div>
          <Field name="cliente_email" label="Email del cliente" type="email" placeholder="cliente@correo.cl" />
          <Field name="proyecto_nombre" label="Nombre del proyecto" placeholder="(por defecto: Kit + nombre)" />
          <div className="flex justify-end gap-2 pt-2">
            <Link href="/dashboard">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" variant="primary">Crear proyecto</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
