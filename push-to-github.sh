#!/bin/bash

echo "🚀 Publication de Yape corrigé sur GitHub..."
echo ""

# Étape 1 : Initialiser Git
echo "📦 Initialisation du dépôt Git..."
cd /Users/jeromesoyer/yape-fixed
git init

# Étape 2 : Configurer l'utilisateur Git
echo "👤 Configuration de l'utilisateur Git..."
git config user.name "jsoyer"
git config user.email "$(git config --global user.email)"

# Étape 3 : Ajouter tous les fichiers
echo "📝 Ajout des fichiers modifiés..."
git add .

# Étape 4 : Créer le commit
echo "💾 Création du commit..."
git commit -m "Fix: Yape compatible avec PyLoad 0.5.0+

- Remplacement de l'endpoint obsolète /api/login par /api/check_auth
- Ajout de l'authentification HTTP Basic sur tous les endpoints
- Correction des noms d'endpoints (camelCase -> snake_case)
- Correction des méthodes HTTP (POST -> GET pour lectures)
- Conversion du format de données (URL-encoded -> JSON)
- Ajout du stockage des credentials pour réutilisation
- Résolution complète de l'erreur 'CSRF token is invalid'

Version: 1.1.4
Compatible avec: PyLoad 0.5.0+"

# Étape 5 : Créer une branche pyload-0.5-compatible
echo "🌿 Création de la branche pyload-0.5-compatible..."
git branch -M pyload-0.5-compatible

# Étape 6 : Ajouter le remote
echo "🔗 Configuration du remote GitHub..."
git remote add origin https://github.com/jsoyer/Yape.git

echo ""
echo "✅ Préparation terminée !"
echo ""
echo "⚠️  PROCHAINE ÉTAPE MANUELLE :"
echo "Exécutez cette commande pour pousser vers GitHub :"
echo ""
echo "    git push -u origin pyload-0.5-compatible"
echo ""
echo "GitHub vous demandera vos identifiants."
echo "Si vous utilisez 2FA, utilisez un Personal Access Token au lieu du mot de passe."
echo ""
