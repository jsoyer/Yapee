# Yape - Version compatible avec PyLoad 0.5.0+

Cette version modifiée de Yape est compatible avec PyLoad 0.5.0 et versions ultérieures.

## Modifications apportées

- Remplacement de l'endpoint obsolète `/api/login` par `/api/check_auth`
- Adaptation de la gestion de l'authentification pour la nouvelle API PyLoad
- Correction de l'erreur "CSRF token is invalid"

## Installation dans Chrome

### Étape 1 : Accéder aux extensions Chrome

1. Ouvrez Chrome
2. Tapez `chrome://extensions/` dans la barre d'adresse
3. Appuyez sur Entrée

### Étape 2 : Activer le mode développeur

1. En haut à droite de la page, activez le bouton **"Mode développeur"**

### Étape 3 : Charger l'extension

1. Cliquez sur **"Charger l'extension non empaquetée"**
2. Naviguez jusqu'au dossier `yape-fixed`
3. Sélectionnez le dossier et cliquez sur **"Sélectionner"**

### Étape 4 : Configurer Yape

1. Cliquez sur l'icône Yape dans la barre d'outils Chrome
2. Cliquez sur l'icône ⚙️ (paramètres)
3. Entrez les informations de votre serveur PyLoad :
   - **Host** : `192.168.1.249` (ou votre IP)
   - **Port** : `8666` (ou votre port)
   - **Path** : `/`
4. Cliquez sur **"Save"**
5. Cliquez sur **"Login"** et entrez vos identifiants PyLoad

## Vérification

Si tout fonctionne correctement :
- L'erreur "CSRF token is invalid" ne devrait plus apparaître
- Vous devriez voir vos téléchargements en cours
- Vous pouvez ajouter des téléchargements via le menu contextuel

## Support

Cette version a été modifiée pour résoudre le problème de compatibilité avec PyLoad 0.5.0.

Version originale : https://github.com/RemiRigal/Yape
