# Changelog - Yape PyLoad 0.5.0+ Compatible

## Version 1.1.3 (2026-01-11)

### Corrections

- **Authentification mise à jour** : Remplacement de l'endpoint obsolète `/api/login` par `/api/check_auth`
- **Correction de l'erreur CSRF** : Résolution du message "CSRF token is invalid" avec PyLoad 0.5.0+
- **Amélioration de la gestion des erreurs** : Meilleure détection des échecs d'authentification

### Changements techniques

#### Fichier `js/pyload-api.js` - Fonction `login()`

**Avant :**
```javascript
xhr.open('POST', `${origin}/api/login`, true);
xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
xhr.send(`username=${username}&password=${password}`);
```

**Après :**
```javascript
xhr.open('GET', `${origin}/api/check_auth?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, true);
xhr.send();
```

### Compatibilité

- ✅ PyLoad 0.5.0+
- ✅ Chrome (Manifest V3)
- ✅ Firefox (compatible)

### Installation

Voir le fichier `INSTALLATION.md` pour les instructions détaillées.
