# 🎹 Crescendo IA Vision

![Crescendo IA Banner](https://img.shields.io/badge/AI-Neural_Network-blue?style=for-the-badge&logo=brain)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-WebGPU-orange?style=for-the-badge&logo=tensorflow)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite)

> Une application de prédiction neuronale avancée pour le jeu Crescendo, propulsée par l'intelligence artificielle et l'accélération matérielle WebGPU.

---

## 🌟 Caractéristiques

- 🧠 **Modèle LSTM Bidirectionnel** : Analyse les séquences temporelles des tirages avec un mécanisme d'attention pour identifier les patterns subtils.
- ⚡ **Accélération WebGPU** : Entraînement et prédictions ultra-rapides directement dans votre navigateur grâce à la puissance de votre carte graphique.
- 📊 **Analyse Statistique Complète** : Calcul des fréquences, de la typicalité (somme, parité) et des écarts (dernière apparition).
- 🔄 **Scraping Profond (2025-2026)** : Récupération récursive de tout l'historique depuis le lancement (Nov 2025).
- 🔠 **Set de Lettres SAMEDI** : Support exclusif des lettres officielles du jeu (S, A, M, E, D, I).
- 📱 **Interface Glassmorphism** : Un dashboard moderne, réactif et intuitif conçu pour une expérience utilisateur premium.
- 📓 **Journal de Performance** : Suivi historique de la précision des prédictions de l'IA par rapport aux tirages réels.

---

## 🚀 Installation Rapide

### Prérequis
- [Node.js](https://nodejs.org/) (v18 ou supérieur)
- Une carte graphique compatible (pour WebGPU, sinon repli automatique sur WebGL)

### Étapes
1. **Cloner le projet**
   ```bash
   git clone https://github.com/freezdid/crescendo.git
   cd crescendo
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer l'application**
   ```bash
   npm run dev
   ```
   Rendez-vous sur [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Stack Technique

- **Frontend** : Next.js 15 (App Router), Tailwind CSS, Framer Motion (Animations).
- **Intelligence Artificielle** : TensorFlow.js avec backend WebGPU/WebGL.
- **Base de Données** : SQLite (local/Vercel tmp) & IndexedDB (navigateur).
- **Stockage Cloud** : Vercel Blob (pour la synchronisation des modèles).
- **Scraping** : Cheerio & API Routes Next.js.

---

## 📉 Fonctionnement de l'IA

L'IA utilise une architecture **Deep Learning** spécifique :
1. **Prétraitement** : Les données brutes sont normalisées via un `StandardScaler` et enrichies de 36 caractéristiques techniques (fréquences, rolling stats, parité).
2. **Fenêtrage** : Elle analyse les 12 derniers tirages (fenêtre glissante par défaut, configurable) pour prédire le suivant.
3. **Architecture** : Deux couches LSTM bidirectionnelles suivies d'une couche d'attention pour pondérer l'importance de chaque tirage historique.
4. **Optimisation** : Utilisation de l'algorithme Adam avec une perte MAE (Mean Absolute Error).
5. **Post-processing** : Les prédictions sont castées sur l'ensemble [1-25] pour les numéros et [S, A, M, E, D, I] pour la lettre.

---

## 📁 Structure du Projet

```text
src/
├── app/              # Routes et Pages (Next.js)
│   ├── api/          # Endpoints (Scraping, Sync, DB)
│   ├── history/      # Archives des tirages
│   └── journal/      # Suivi des performances IA
├── lib/              # Logique métier
│   ├── model.ts      # Moteur IA (TensorFlow.js)
│   ├── db.ts         # Gestion SQLite
│   ├── stats.ts      # Calculs statistiques
│   └── storage.ts    # Persistance navigateur
└── components/       # Composants UI
```

---

## 📝 Licence

Distribué sous licence MIT. Voir `LICENSE` pour plus d'informations.

---

**Avertissement** : *Cette application est un outil d'analyse statistique basé sur des probabilités. Le jeu comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).*
