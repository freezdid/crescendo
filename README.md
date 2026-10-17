# 🎯 Crescendo Quantum IA — Moteur Prédictif Neuronal v2.5 Pro

> **Analyse probabiliste avancée et prédictions par intelligence artificielle pour les tirages Crescendo**

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.x-orange?style=flat-square&logo=tensorflow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss)

---

## ✨ Fonctionnalités

### 🧠 Moteur d'Intelligence Artificielle
- **Réseau neuronal LSTM bidirectionnel** avec mécanisme d'attention (128→64 unités)
- **Entraînement local GPU** via WebGPU/WebGL avec TensorFlow.js
- **Moniteur d'entraînement en direct** — courbe de loss, activité des neurones, progression temps réel
- **Modes Turbo (25 ép.) et Elite (50 ép.)** pour ajuster vitesse vs précision
- **Backtest automatisé** sur les 35 derniers tirages pour valider les performances

### 📊 Analyse Statistique Avancée
- **5 stratégies de génération** : IA Hybride, Surchauffe, Réversion Poisson, Monte Carlo, Couverture Max
- **Matrice de co-occurrences** 25×25 pour les affinités entre numéros
- **Classification thermique** : Chaud 🔥 / Tiède / Froid / Retardataire 🟢
- **Probabilités de Poisson** individuelles pour chaque numéro et lettre SAMEDI
- **Score de confiance IA** (0-100) et taux de confiance pour chaque grille générée

### 🎨 Interface Premium
- **Design Obsidian Glass** — dark mode luxueux avec glassmorphism et 3D balls
- **Visualisation côte à côte** — Dernier tirage réel vs Prédiction IA
- **Boules 3D réalistes** avec effets métalliques, dorés, cyan et émeraude
- **Animations fluides** via Framer Motion avec micro-interactions

### ⏱️ Compte à Rebours Samedi
- **Timer en temps réel** pour les 7 tirages du samedi (13h à 19h)
- **Indicateur "Prochain"** avec animation pulsante
- **Alerte d'urgence** quand un tirage est dans moins d'1 heure
- **Date et heure locale** affichées en temps réel

### 📁 Archives Complètes
- **Historique intégral** de tous les tirages passés (100% des données)
- **Pagination progressive** (30 tirages par page, chargement infini)
- **Recherche & filtres** par date, heure, numéro ou lettre SAMEDI
- **Export CSV/JSON** de l'intégralité des données
- **Statistiques résumées** — numéro et lettre les plus fréquents

### 🔄 Synchronisation
- **Scraping automatique** des résultats officiels
- **IndexedDB local** pour la persistance côté client
- **SQLite serveur** pour la base de données backend
- **Seed embarqué** (`public/seed-draws.json`) — base historique réinjectée automatiquement si la BDD SQLite est vide (déploiement frais)
- **Vercel Blob** pour la synchronisation cloud
- **Sauvegarde automatique** du modèle neuronal entraîné
- **Ordre chronologique garanti** — toutes les données sont normalisées (plus ancien → plus récent) quel que soit l'ordre d'entrée

---

## 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/freezdid/crescendo.git
cd crescendo1

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📦 Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| IA / ML | TensorFlow.js (LSTM + Attention) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Graphiques | Recharts |
| Base de données | SQLite (better-sqlite3) + IndexedDB |
| Cloud | Vercel Blob Storage |
| Scraping | Cheerio |
| Icônes | Lucide React |

## 🔧 Variables d'environnement

```env
BLOB_READ_WRITE_TOKEN=<votre-token-vercel-blob>
# Store en accès « privé » : lectures et écritures passent par le SDK
# @vercel/blob côté serveur (src/lib/blob.ts), jamais par URL publique.

# Recommandé : clé admin protégeant les écritures cloud (/api/sync)
# et le scan approfondi (/api/crescendo?deep=true).
# À saisir une fois dans l'app via le bouton « Clé » du header.
SYNC_SECRET=<une-longue-chaine-aleatoire>

# Recommandé : protège l'endpoint /api/cron (Vercel l'envoie automatiquement)
CRON_SECRET=<une-autre-longue-chaine-aleatoire>

# Sans SYNC_SECRET, les écritures cloud restent ouvertes (pratique en local) ;
# dès qu'il est défini sur Vercel, l'en-tête x-sync-key devient obligatoire.
```

## 📐 Architecture

```
src/
├── app/
│   ├── page.tsx              # Dashboard principal (Laboratoire IA)
│   ├── layout.tsx            # Layout racine avec police DM Sans
│   ├── globals.css           # Design system Obsidian Glass
│   ├── history/page.tsx      # Archives complètes avec pagination
│   ├── journal/page.tsx      # Journal des gains
│   └── api/
│       ├── crescendo/route.ts  # Scraping des résultats officiels
│       ├── draws/route.ts      # API des tirages (SQLite, tri chronologique)
│       ├── sync/route.ts       # Synchronisation cloud (écritures protégées)
│       └── cron/route.ts       # Cron de mise à jour automatique
├── components/
│   └── LossChart.tsx         # Courbe de convergence (chargée à la demande)
├── lib/
│   ├── pipeline.ts           # Logique pure (processData, dataset, scaler)
│   ├── model.ts              # Réseau LSTM + backtest (TF.js, chargé à la demande)
│   ├── dates.ts              # Parseur de dates françaises partagé
│   ├── stats.ts              # Moteur statistique (Poisson, co-occurrences, GTO)
│   ├── storage.ts            # Persistance IndexedDB + clé admin
│   ├── db.ts                 # SQLite serveur (better-sqlite3)
│   ├── blob.ts               # Vercel Blob helper
│   ├── auth.ts               # Vérification de la clé admin (x-sync-key)
│   ├── ratelimit.ts          # Limiteur de requêtes en mémoire
│   ├── validate.ts           # Validation des écritures cloud
│   └── net.ts                # fetch() avec timeout
```

## 🧪 Utilisation

1. **Synchroniser les données** — Cliquez sur "Sync" pour récupérer les derniers tirages
2. **Entraîner le modèle** — Sélectionnez Turbo ou Elite puis lancez l'entraînement
3. **Générer des grilles** — Choisissez une stratégie et le nombre de grilles souhaité
4. **Analyser les résultats** — Consultez les scores, affinités et justifications IA
5. **Surveiller le countdown** — Visualisez le temps restant avant chaque tirage du samedi
6. **Explorer les archives** — Parcourez l'historique complet dans la page Archives

---

**Développé avec 🧠 et ☕ — Propulsé par l'IA quantique Crescendo**
