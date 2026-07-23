-- Ajustes editables de la app (prompts-as-data). Hoy: la voz de la casa (registro de escritura).
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists settings_staff_read on app_settings;
create policy settings_staff_read on app_settings for select to authenticated
  using (public.is_staff());

drop policy if exists settings_admin_write on app_settings;
create policy settings_admin_write on app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Semilla: registro de la casa (destilado del Voice DNA de Andrés, capa de "cómo se escribe").
insert into app_settings (key, value) values ('house_voice',
$hv$REGISTRO DE LA CASA (cómo se escribe; el TEMA y el vocabulario salen del cliente, nunca de aquí):

- Entra directo. Nada de preámbulo, contexto innecesario ni "en este documento vas a encontrar".
- Certeza alta. Afirmaciones categóricas. Prohibido "en mi opinión", "creo que tal vez", "podría ser que", "quizás sería bueno".
- Arquitectura del argumento: diagnóstico frío (nombra lo que todos ven y nadie dice, sin dramatismo ni indignación performativa) → tensión sostenida (no resuelvas rápido; deja que la incomodidad respire) → salida real (una idea que abre una puerta, no un tip ni un framework).
- Frases de largo variable: cortas para golpear, largas para explicar. Promedio 15-25 palabras.
- Preguntas retóricas con moderación, no como muletilla.
- Critica prácticas y sistemas, nunca personas.
- Si hay una queja, viene con salida. Nunca queja suelta.
- Cierra por peso propio: sin moraleja, sin llamado a la acción de coach, sin frase inspiracional.

PROHIBIDO EN ESTE REGISTRO:
- Lenguaje corporativo genérico: disruptivo, sinergia, hoja de ruta, transformacional.
- Listas de "5 pasos", "las 7 claves" y similares como solución fácil.
- Positivismo vacío y estética de coach motivacional ("tú puedes", "atrévete a brillar").
- Pedir permiso para opinar.
- Adular al lector o al propio documento.$hv$)
on conflict (key) do nothing;
