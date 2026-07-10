// Hand-written DB row types (subset used by the app). Keep in sync with supabase/migrations.

export type UserRol = "admin" | "operador" | "cliente";
export type ProjectEstado =
  | "onboarding" | "en_produccion" | "en_revision" | "entregado" | "activo_seguimiento" | "cerrado";
export type DeliverableTipo = "D0" | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";
export type DeliverableEstado =
  | "pendiente" | "generando" | "borrador" | "en_edicion"
  | "listo_para_revision" | "aprobado" | "publicado" | "rechazado";
export type InputTipo = "transcripcion" | "conclusiones" | "foto_referencia" | "otro";
export type VoiceEstado = "borrador" | "en_edicion" | "aprobado";
export type GeneradoPor = "ia" | "humano";

export interface AppUser {
  id: string; nombre: string; email: string; rol: UserRol; activo: boolean;
}

export interface Client {
  id: string; nombre: string; slug: string; email: string | null;
  ciudad: string | null; rubro: string | null; foto_url: string | null; user_id: string | null;
}

export interface Project {
  id: string; client_id: string; nombre: string; estado: ProjectEstado;
  fecha_inicio: string; fecha_dia7: string | null;
  paleta_marca: unknown | null; notas: string | null; created_at: string;
  netlify_site_id?: string | null; landing_url?: string | null;
}

export type AssetTipo = "foto" | "video" | "pdf" | "otro";
export interface Asset {
  id: string; project_id: string; deliverable_id: string | null;
  tipo: AssetTipo; categoria: string | null; file_url: string;
  aprobado: boolean; publicado: boolean; created_at: string;
}

export type LibrarySeccion = "onboarding" | "curso1" | "curso2" | "curso3";
export interface LibraryItem {
  id: string; seccion: LibrarySeccion; titulo: string;
  embed_url: string | null; descripcion: string | null; orden: number; activo: boolean;
}

export interface InputRow {
  id: string; project_id: string; tipo: InputTipo; titulo: string;
  contenido_texto: string | null; file_url: string | null; subido_por: string | null; created_at: string;
}

export interface LexiconEntry {
  expresion: string; significado: string; de_donde_viene: string; como_usarla: string;
}
export interface CitaCanon { cita: string; contexto: string; }
export interface VoiceDoc {
  id: string; project_id: string;
  lexicon: LexiconEntry[]; citas_canon: CitaCanon[];
  registro_si_no: { si: string[]; no: string[] };
  lineas_rojas: string[]; estado: VoiceEstado; version: number;
}

export interface Deliverable {
  id: string; project_id: string; tipo: DeliverableTipo; titulo: string;
  estado: DeliverableEstado; contenido_md: string | null; version_actual: number;
  aprobado_por: string | null; aprobado_at: string | null; publicado_at: string | null;
  pdf_url: string | null; orden: number; gate_bloqueado: boolean;
  desbloqueo_manual: boolean;
}

export interface Notification {
  id: string; target_rol: UserRol | null; user_id: string | null;
  project_id: string | null; deliverable_id: string | null;
  tipo: string; texto: string; leido: boolean; created_at: string;
}

export interface Comment {
  id: string; deliverable_id: string; user_id: string | null;
  texto: string; resuelto: boolean; created_at: string;
}

export interface DeliverableVersion {
  id: string; deliverable_id: string; version: number; contenido_md: string;
  generado_por: GeneradoPor; prompt_template_version: number | null;
  instrucciones: string | null; created_by: string | null; created_at: string;
}

export interface ModuleTemplate {
  id: string; tipo: DeliverableTipo; version: number; nombre: string;
  prompt_sistema: string; estructura_output: string | null;
  inputs_requeridos: DeliverableTipo[]; checklist_calidad: string[]; activa: boolean;
}
