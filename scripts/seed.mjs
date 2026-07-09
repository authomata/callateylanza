// Seeds auth users (Andrés = admin, Michelle = operador) and an optional demo project.
// Roles are assigned automatically by the handle_new_user() trigger (admin allowlist).
// Run AFTER applying migrations + seed.sql:
//   node --env-file=.env.local scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const SEED_USERS = [
  { email: "andres@authomata.io", password: "CambiaEsto123!", nombre: "Andrés Bustamante" },
  { email: "michelle@authomata.io", password: "CambiaEsto123!", nombre: "Michelle" },
];

async function ensureUser({ email, password, nombre }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error) {
    if (String(error.message).toLowerCase().includes("already")) {
      console.log(`· ${email} ya existe`);
      return;
    }
    throw error;
  }
  console.log(`✓ creado ${email} (${data.user.id})`);
}

async function seedDemo() {
  const slug = "demo-marcelo";
  const { data: existing } = await admin.from("clients").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    console.log("· proyecto demo ya existe");
    return;
  }
  const { data: client } = await admin
    .from("clients")
    .insert({ nombre: "Marcelo (demo)", slug, ciudad: "Curicó", rubro: "Arriería / cordillera" })
    .select("id")
    .single();
  const { data: project } = await admin
    .from("projects")
    .insert({ client_id: client.id, nombre: "Kit Marcelo — demo", estado: "onboarding" })
    .select("id")
    .single();
  await admin.from("voice_docs").insert({ project_id: project.id });

  const tipos = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"];
  const nombres = {
    D0: "Extracción & Documento de Voz", D1: "Manual Maestro de Marca",
    D2: "Plan de Medios + Calendario 60d", D3: "Oferta & Framework",
    D4: "Masterclass / Lead Magnet", D5: "Landing Page", D6: "Banco Visual",
    D7: "System Prompt del Asistente", D8: "6 Videos Verticales",
  };
  await admin.from("deliverables").insert(
    tipos.map((tipo, i) => ({
      project_id: project.id,
      tipo,
      titulo: nombres[tipo],
      orden: i,
      // D2-D8 blocked until D1 aprobado
      gate_bloqueado: !["D0", "D1"].includes(tipo),
    }))
  );
  console.log(`✓ proyecto demo creado (${project.id})`);
}

for (const u of SEED_USERS) await ensureUser(u);
await seedDemo();
console.log("\nListo. Passwords por defecto: CambiaEsto123!  — cámbialas.");
