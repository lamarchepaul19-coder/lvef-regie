import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_READY = Boolean(url && key);

if (!SUPABASE_READY) {
  // Le message s'affichera dans la console du navigateur si les clés
  // n'ont pas été configurées dans Vercel (variables d'environnement).
  console.warn(
    "Supabase non configuré : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
    "L'app fonctionne en mode local uniquement (non partagé)."
  );
}

// On n'appelle createClient qu'avec de vraies valeurs : avec des chaînes
// vides, le SDK Supabase lève une exception au chargement du module et
// fait planter toute l'application (écran blanc).
export const supabase = SUPABASE_READY ? createClient(url, key) : null;
