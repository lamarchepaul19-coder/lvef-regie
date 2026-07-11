# La vie est une fête — Régie contenu

App de planning de contenu Instagram, partagée par toute l'équipe.
Note une soirée (lieu, date, photo/vidéo), le planning de publication
se génère automatiquement (visuel J-4, story J-3, retouche J+1, etc.).

Ce guide te montre comment la mettre en ligne, gratuitement, avec une
base de données partagée par toute l'équipe. Compte environ 20-30
minutes la première fois. Après ça, plus rien à toucher.

---

## Étape 1 — Créer la base de données (Supabase, gratuit)

1. Va sur https://supabase.com et crée un compte (gratuit).
2. Clique **New project**. Donne-lui un nom (ex. `lvef-regie`),
   choisis un mot de passe pour la base (note-le), région **Europe**.
3. Attends 1-2 minutes que le projet se crée.
4. Dans le menu de gauche, va dans **SQL Editor** → **New query**,
   colle ce code, puis clique **Run** :

```sql
create table app_data (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

alter table app_data enable row level security;

create policy "Autoriser tout pour l'équipe"
  on app_data for all
  using (true)
  with check (true);

alter publication supabase_realtime add table app_data;
```

   ⚠️ Cette politique autorise quiconque possède le lien de l'app à lire
   et modifier les données. C'est volontaire (pas de compte à créer pour
   ton équipe), mais ça veut dire : ne partage le lien qu'avec les
   personnes concernées, comme tu le ferais pour un Google Doc en
   "modification pour toute personne ayant le lien".

5. Toujours dans Supabase, va dans **Project Settings** (icône
   d'engrenage) → **API**. Tu y trouves deux informations à copier :
   - **Project URL** (ressemble à `https://xxxxx.supabase.co`)
   - **anon public key** (une longue chaîne de caractères)

   Garde ces deux valeurs sous la main pour l'étape 3.

## Étape 2 — Mettre le code sur GitHub

1. Va sur https://github.com et crée un compte si tu n'en as pas.
2. Crée un nouveau dépôt (bouton **New**), nom libre (ex. `lvef-regie`),
   laisse-le **Public** ou **Private**, ne coche aucune case
   d'initialisation.
3. Sur ta page de dépôt vide, GitHub te propose des commandes du type
   `git remote add origin ...`. Le plus simple : utilise le bouton
   **"uploading an existing file"** et dépose tout le contenu de ce
   dossier (sauf `node_modules` et `dist`, qui ne sont pas nécessaires).

## Étape 3 — Déployer sur Vercel (gratuit)

1. Va sur https://vercel.com et connecte-toi avec ton compte GitHub.
2. Clique **Add New** → **Project**, choisis le dépôt que tu viens de
   créer.
3. Vercel détecte automatiquement que c'est un projet Vite — ne change
   rien aux réglages de build.
4. Avant de cliquer sur **Deploy**, déplie **Environment Variables**
   et ajoute :
   - `VITE_SUPABASE_URL` → colle le Project URL de l'étape 1
   - `VITE_SUPABASE_ANON_KEY` → colle la clé anon public de l'étape 1
5. Clique **Deploy**. Après une minute, Vercel te donne une adresse du
   type `https://lvef-regie.vercel.app`.

C'est cette adresse que tu partages à toute l'équipe. Chacun l'ouvre
dans son navigateur (téléphone ou ordi), et tout le monde voit et
modifie le même planning en direct.

## Et après ?

- **Modifier le moteur** (les décalages J-4, J+2…) : directement dans
  l'app, onglet Réglages — pas besoin de retoucher le code.
- **Changer un texte ou une couleur** : modifie `src/App.jsx`, renvoie
  le fichier sur GitHub (juste remplacer le fichier dans l'interface
  web GitHub), Vercel redéploie automatiquement en ~1 minute.
- **Nom de domaine perso** (ex. `regie.lavieestunefete.fr`) : dans
  Vercel, Project → Settings → Domains. Demande-moi si tu veux un coup
  de main pour cette partie.

## En local (optionnel, si tu veux tester avant de déployer)

```bash
npm install
cp .env.example .env.local   # puis remplis les deux valeurs Supabase
npm run dev
```
