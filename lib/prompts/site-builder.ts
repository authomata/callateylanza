// Generador de sitio v3. Convierte el copy aprobado (D5) en una landing REAL de alto nivel.
// Prompts-as-data: los presets y el brief base se pueden afinar aquí (o mover a /templates luego).

export interface SitePreset {
  key: string;
  nombre: string;
  brief: string; // dirección de arte concreta para el modelo
}

// Presets de estilo. El operador elige uno; sube el piso y diferencia clientes.
export const SITE_PRESETS: SitePreset[] = [
  {
    key: "editorial",
    nombre: "Editorial",
    brief:
      "Revista de autor. Serif de display grande para titulares (Fraunces, Newsreader o Playfair), sans limpia para cuerpo (Inter). Mucho aire, columnas de lectura angostas, reglas finas (hairlines), números de sección, itálicas para citas. Paleta cálida y sobria. Elegante, reposado, con carácter.",
  },
  {
    key: "bold",
    nombre: "Agencia bold",
    brief:
      "Agencia creativa. Titulares enormes y apretados (font-black, tracking-tight), alto contraste, bloques de color pleno, un acento vibrante, secciones asimétricas, formas geométricas y gradientes marcados. Energía, confianza, movimiento.",
  },
  {
    key: "coach",
    nombre: "Coach cálido",
    brief:
      "Marca personal cercana. Tipografía humanista redondeada, tonos tierra/crema, bordes suaves (rounded-2xl), tarjetas con sombra suave, gradientes tenues, mucho respiro. Cálido, confiable, aspiracional pero humano.",
  },
  {
    key: "tech",
    nombre: "Tech-minimal",
    brief:
      "SaaS moderno. Fondo oscuro o casi blanco, sans geométrica (Inter/Geist), acentos neón sutiles, glassmorphism ligero, grillas precisas, badges, mucho gradiente-mesh de fondo, detalles mono para datos. Preciso, actual, premium-tech.",
  },
  {
    key: "lujo",
    nombre: "Lujo sobrio",
    brief:
      "Premium discreto. Paleta casi monocroma (negros, cremas, un metálico), serif fina, muchísimo espacio en blanco, tipografía pequeña y espaciada en mayúsculas para labels, transiciones lentas. Silencioso, caro, refinado.",
  },
];

export function presetByKey(key: string | null | undefined): SitePreset {
  return SITE_PRESETS.find((p) => p.key === key) ?? SITE_PRESETS[2]; // default: coach cálido
}

export interface SiteArgs {
  clientName: string;
  rubro: string | null;
  copy: string; // copy maestro de D5
  tonoD1: string | null; // extracto del Manual (arquetipo/tono)
  paletaD6: string | null; // extracto del Banco Visual (paleta hex)
  preset: SitePreset;
  instrucciones?: string | null; // ajustes del operador
}

const SYSTEM = `Eres un diseñador y front-end de élite: construyes landings del nivel de un estudio top (piensa Lovable, Framer, sitios premiados). Tu entregable es UNA sola página HTML completa, moderna, con criterio de diseño real. No un documento con estilos: una pieza.

TECNOLOGÍA (obligatoria):
- Documento HTML5 completo: parte con <!doctype html>, cierra con </html>.
- Tailwind vía CDN: <script src="https://cdn.tailwindcss.com"></script>. Configura la paleta de marca con tailwind.config inline (theme.extend.colors) usando los hex de la marca.
- Google Fonts: elige un PAREO tipográfico acorde al preset (un display + una de cuerpo). Cárgalas con <link>.
- JS mínimo embebido permitido para micro-interacciones (menú móvil, scroll-reveal con IntersectionObserver, acordeón de FAQ, smooth scroll). Nada de librerías pesadas.

DIRECCIÓN DE ARTE:
- Deriva TODA la estética del preset + la paleta de marca + el arquetipo del cliente. Dos clientes con presets o paletas distintas deben verse claramente distintos.
- Paleta: usa la del Banco Visual si viene; si no, propón una coherente con el arquetipo y el rubro (3-4 colores + neutros). Declárala en el config de Tailwind.
- Fondo con vida: gradientes, gradient-mesh, blobs/formas en CSS o SVG inline, grano/ruido sutil, glows. NADA de fondos planos aburridos. (No uses imágenes externas todavía: resuelve lo visual con color, gradiente y formas.)

NIVEL DE CALIDAD (la vara):
- Hero a pantalla completa (min-h-screen) con jerarquía potente: eyebrow, titular grande, subtítulo, CTA primario + secundario, y una composición visual (formas/gradiente), no solo texto centrado.
- Nav sticky con blur (backdrop-blur), logo tipográfico y CTA.
- Secciones con ritmo (alternancia, ancho contenido, mucho aire), no una lista de bloques iguales.
- Componentes ricos: tarjetas, badges, stats/numeritos, acordeón de FAQ, bandas de CTA, "sobre mí" con presencia, oferta como tarjetas de pricing/escalera.
- Detalles que separan lo pro de lo básico: estados hover, transiciones suaves, focus visible, sombras con criterio, bordes sutiles, spacing generoso y consistente, tipografía con escala clara.
- Scroll-reveal sutil (fade/translate al entrar en viewport). Respeta prefers-reduced-motion.
- Responsive impecable, mobile-first.
- <head> con <title>, meta description, viewport y OG tags (og:title/description/type, og:locale=es_CL).

CONTENIDO:
- Usa el COPY tal cual (headline, secciones, FAQ, oferta). Nada de lorem ipsum ni texto inventado. Español de Chile, tuteo.
- Estructura sugerida (adáptala con criterio): nav · hero · problema/tensión · transformación · método/framework (por pilares) · sobre mí · oferta (escalera en tarjetas) · testimonios/prueba si el copy los da · FAQ (acordeón) · CTA final · footer.
- CTAs como <a> reales (ancla a #oferta o mailto).

SALIDA: responde ÚNICAMENTE con el bloque de código \`\`\`html\`\`\` del documento completo. Sin explicaciones antes ni después.`;

export function buildSitePrompt(a: SiteArgs): { system: string; user: string } {
  const parts: string[] = [
    `# CLIENTE\n${a.clientName}${a.rubro ? ` — ${a.rubro}` : ""}`,
    `# PRESET DE ESTILO: ${a.preset.nombre}\n${a.preset.brief}`,
  ];
  if (a.paletaD6) parts.push(`# PALETA DE MARCA (Banco Visual — usa estos hex)\n${a.paletaD6}`);
  if (a.tonoD1) parts.push(`# TONO Y ARQUETIPO (del Manual Maestro — para calibrar la personalidad visual)\n${a.tonoD1}`);
  parts.push(`# COPY MAESTRO (úsalo textual)\n${a.copy}`);
  if (a.instrucciones?.trim()) parts.push(`# AJUSTES DEL OPERADOR\n${a.instrucciones.trim()}`);
  parts.push(
    `Construye ahora la landing completa siguiendo la vara de calidad. Devuelve solo el bloque \`\`\`html\`\`\`.`
  );
  return { system: SYSTEM, user: parts.join("\n\n") };
}
