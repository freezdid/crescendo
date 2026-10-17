# 🎹 Crescendo Quantum IA

![AI Neural Network](https://img.shields.io/badge/AI-Neural_Network-blue?style=for-the-badge&logo=brain)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-WebGPU-orange?style=for-the-badge&logo=tensorflow)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss)

> Laboratoire quantique d'analyse probabiliste et prédictive avancée pour le jeu Crescendo (10 numéros parmi 25 + 1 lettre SAMEDI), propulsé par des réseaux neuronaux profonds LSTM et l'optimisation GTO.

---

## 🌟 Nouveautés Majeures

### 👁️ 1. Visualisation Comparée Côte à Côte
- **Face-à-Face en Temps Réel** : Présentation côte à côte du **Dernier Tirage Réel Confirmé** (date, heure, boules, lettre SAMEDI, somme, parité) et de la **Prédiction IA Suivante**.
- **Détection des Numéros Communs** : Mise en surbrillance automatique des numéros récurrents d'un tirage à l'autre avec badge de concordance.
- **Grilles Optimisées en 2 Colonnes** : Cartes compactes côte à côte (Grille 1 vs Grille 2, Grille 3 vs Grille 4) avec les 10 boules alignées, indicateurs GTO (Somme, Parité, Étalement, Affinité) et bouton de copie instantanée.

### 🧠 2. Moniteur Visuel d'Entraînement Neuronal Local
- **Supervision Temps Réel** : Suivi direct de chaque époque d'apprentissage (`Époque X / 50`, pourcentage de progression).
- **Courbe de Perte Dynamique (MAE Loss)** : Visualisation Recharts animée en direct à chaque descente de gradient, avec calcul du pourcentage de réduction d'erreur (`-XX%`).
- **Matrice Synaptique Active (36 Neurones)** : Grille dynamique représentant les entrées statistiques et couches bidirectionnelles LSTM, clignotant lors de l'activation des tenseurs WebGPU/WebGL.
- **Modes d'Entraînement** : Bascule immédiate entre le mode *Turbo* (25 époques rapides) et *Elite* (50 époques approfondies).
- **Module de Backtest Intégré** : Évaluation rétrospective sur 35 tirages récents avec taux de réussite &ge; 6 numéros et correspondance de lettre.

### 🎯 3. Moteur Probabiliste 5 Stratégies
1. **IA Hybride & GTO** : Réseau de neurones profonds + matrices de co-occurrence 25x25 + filtrage de somme idéale (110-150).
2. **Surchauffe & Tendance** : Capture les séries et l'accélération récente des boules les plus fréquentes.
3. **Écarts & Réversion Poisson** : Détection des cycles en retard critique selon la loi de distribution de Poisson.
4. **Monte Carlo Quantique** : 10 000 tirages virtuels simulés par chaîne de Markov.
5. **Couverture Maximale Réduite** : Grilles complémentaires anti-redondance balayant l'ensemble des 25 numéros.

---

## 🛠️ Stack Technique

- **Frontend** : Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion, Lucide Icons, Recharts.
- **Moteur IA & Statistiques** : TensorFlow.js (Backends WebGPU / WebGL), loi de Poisson, matrices de co-occurrence 25x25.
- **Persistance** : IndexedDB (côté client), SQLite & Vercel Blob (synchronisation cloud continue).
- **Scraping Automatique** : API Cheerio avec pagination récursive et détection automatique des nouveaux tirages.

---

## 🚀 Installation & Démarrage

```bash
# Cloner le dépôt
git clone https://github.com/freezdid/crescendo.git
cd crescendo

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

Rendez-vous sur [http://localhost:3000](http://localhost:3000).

---

## 📝 Licence

Distribué sous licence MIT.

*Avertissement : Cette application est un outil d'analyse probabiliste et de modélisation mathématique. Le jeu comporte des risques : endettement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).*
