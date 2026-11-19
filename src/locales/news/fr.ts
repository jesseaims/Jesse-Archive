import type { NewsTranslations } from '../../news-changelog';

// French titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'new-installer': [
    'Nouveau programme d’installation au style de l’app',
    'Le programme d’installation a été refait : une seule fenêtre du début à la fin, avec le thème sombre et le logo de Jesse’s Archive, à la place de la procédure qui passait par Windows Installer. Il a aussi désormais sa propre désinstallation, qui supprime le programme sans toucher au coffre ni aux paramètres. En mettant à jour depuis la version précédente, vous n’avez rien à faire : le nouveau programme remplace l’ancien dans le même dossier.',
  ],
  'extension-logo-autoreload': [
    'Logo de l’extension et rechargement automatique',
    'L’extension du navigateur affiche désormais le logo de Jesse’s Archive dans la barre et dans la liste des extensions. Après chaque mise à jour, elle se recharge toute seule dès qu’elle se connecte à l’app, sans devoir le faire à la main depuis la page des extensions. Pour cette fois, rechargez-la encore à la main : le rechargement automatique s’applique à partir des prochaines mises à jour.',
  ],
  'breach-check-autofill-fixes': [
    'Vérification des fuites et remplissage plus fiables',
    'La vérification des comptes compromis fonctionne désormais aussi avec les grands coffres (auparavant elle s’arrêtait avec « Impossible de contacter Pwned Passwords » au-delà d’environ 120 mots de passe) et réessaie toute seule en cas de souci réseau. Le remplissage depuis le navigateur reconnaît aussi les champs de connexion des sites construits avec des composants web, comme Reddit, et les cadres de connexion d’un sous-domaine du même site, comme celui d’Ubisoft. Après la mise à jour, rechargez l’extension depuis la page des extensions du navigateur.',
  ],
  'global-quick-search': [
    'Recherche rapide globale',
    'Appuyez sur Ctrl+Shift+Space depuis n’importe quelle application, même avec Jesse’s Archive dans la zone de notification, pour ouvrir une fenêtre de recherche compacte : trouvez des comptes par nom, identifiant, e-mail ou site, avec les comptes d’un même service regroupés, puis copiez l’identifiant ou le mot de passe, affichez le mot de passe quelques secondes, ouvrez le site ou l’élément dans le coffre, entièrement au clavier. Elle ne fonctionne que coffre déverrouillé, les mots de passe sont copiés sans passer par la fenêtre et le presse-papiers est vidé comme d’habitude. Raccourci et options : Paramètres → Recherche rapide globale.',
  ],
  'window-state': [
    'La fenêtre se souvient de sa taille et de sa position',
    'Jesse’s Archive se rouvre tel que vous l’avez laissé : en plein écran, agrandi ou avec la taille et la position choisies, même après un passage par la zone de notification. Si l’écran sur lequel il se trouvait n’est plus branché, la fenêtre s’ouvre au centre de l’écran disponible.',
  ],
  'customizable-dashboard': [
    'Tableau de bord personnalisable',
    'Le nouveau tableau de bord est le centre de contrôle de l’application : score de sécurité, analyse des mots de passe, aperçu du coffre, favoris, éléments récents, notes sécurisées, actions rapides, générateur, état de la sauvegarde et confidentialité. Avec « Personnaliser le tableau de bord », ajoutez, retirez, déplacez et redimensionnez les widgets, choisissez parmi plusieurs dispositions et réglez les options de chacun ; tout s’enregistre automatiquement dans le coffre chiffré et aucun widget n’affiche de mot de passe.',
  ],
  multilanguage: [
    'Jesse’s Archive parle votre langue',
    'Avec le nouveau bouton « Langue » en haut à droite, choisissez entre l’italien, l’anglais, l’espagnol, le français, l’allemand, le portugais, le russe, le chinois, le japonais et le coréen. Toute l’application change aussitôt, y compris l’écran de déverrouillage, la mini-fenêtre du navigateur et le menu de la zone de notification ; au premier démarrage, la langue de Windows est utilisée. Le programme d’installation et l’extension du navigateur suivent aussi la langue du système.',
  ],
  'installer-logo': [
    'Logo du programme d’installation corrigé',
    'Pendant l’installation, le logo en haut à droite n’apparaît plus écrasé : c’est désormais le logo de l’application, net et bien proportionné même avec un affichage agrandi.',
  ],
  'webauthn-passkeys': [
    'Clés d’accès sur les sites web',
    'Quand un site propose une clé d’accès, Jesse’s Archive ouvre la mini-fenêtre : vous pouvez l’enregistrer dans le coffre chiffré et l’utiliser pour vous connecter, ou choisir « Utiliser un autre appareil » pour votre téléphone ou Windows Hello. Chaque utilisation nécessite votre confirmation. Rechargez l’extension dans le navigateur après la mise à jour ; Firefox nécessite la version 128 ou ultérieure. Désactivable dans Paramètres → Bureau.',
  ],
  'auto-update': [
    'Mises à jour automatiques',
    'L’application recherche les nouvelles versions au démarrage et une fois par jour, et vous demande si vous voulez les installer : « Mettre à jour » télécharge le programme d’installation, vérifie la signature numérique de l’auteur et rouvre l’application à jour. Dans Paramètres → Mises à jour, vous pouvez les rechercher manuellement ou désactiver la vérification automatique.',
  ],
  'zoom-typed-min-max': [
    'Zoom au choix, minimum et maximum',
    'Dans Paramètres → Apparence, vous pouvez saisir le pourcentage de zoom souhaité (de 50 à 200) et utiliser les deux nouveaux boutons pour passer directement au zoom minimum ou maximum.',
  ],
  'interface-zoom': [
    'Zoom de l’interface',
    'Agrandissez ou réduisez l’application avec Ctrl + + et Ctrl + − (ou Ctrl + F12 / Ctrl + F11 ou Ctrl + molette) et revenez à 100 % avec Ctrl + 0. Vous le trouvez aussi dans Paramètres → Apparence : il s’applique à toutes les fenêtres et est mémorisé sur ce PC.',
  ],
  'empty-trash': [
    'Vider la corbeille',
    'Sur la page Corbeille, le bouton « Vider la corbeille » supprime définitivement tous les éléments d’un coup, après deux confirmations qui montrent ce qui sera supprimé.',
  ],
  'settings-layout-installer-flow': [
    'Paramètres plus compacts et installation plus pratique',
    'Les panneaux des Paramètres s’agencent sans espaces vides. L’installation propose une case pour lancer l’application à la fin, et le guide des extensions a le bouton « J’ai installé l’extension » qui le ferme et ouvre Jesse’s Archive.',
  ],
  'refresh-feedback-appearance': [
    'Bouton Actualiser avec résultat et nouvel onglet Apparence',
    'Le bouton Actualiser indique ce qu’il a fait : s’il a trouvé des éléments nouveaux, modifiés ou supprimés, ou si tout était déjà à jour, et en cas de problème il explique ce qui n’a pas fonctionné. Les thèmes et couleurs de l’application ont désormais leur propre onglet, Apparence, dans les Paramètres.',
  ],
  'regroup-on-site-change': [
    'Le site d’un compte se met à jour quand vous le modifiez',
    'Si vous changez le site web d’un compte, il apparaît aussitôt sous le nouveau site dans la collection au lieu de rester sous celui saisi au départ. Les entrées enregistrées auparavant se corrigent aussi d’elles-mêmes.',
  ],
  'delete-accounts-and-groups': [
    'Suppression de comptes, de groupes et d’éléments',
    'Chaque groupe de comptes a un bouton « Supprimer le compte » pour un seul compte et une corbeille pour supprimer tout le groupe, avec une double confirmation qui liste ce qui sera supprimé. Les éléments des autres catégories se suppriment aussi en un clic et une confirmation. Tout va dans la Corbeille, d’où l’on peut le restaurer.',
  ],
  'session-hardening': [
    'Verrouillage automatique plus fiable et importations plus sûres',
    'Le coffre se verrouille vraiment après la durée d’inactivité choisie, même avec la fenêtre masquée, et l’écran est vidé. Le clavier, les clics et le défilement comptent comme activité. Un fichier d’importation contenant ne serait-ce qu’un élément non valide est refusé sans modifier le coffre, et la longueur minimale des mots de passe compte désormais correctement les lettres accentuées.',
  ],
  'news-entry-timestamps': [
    'Date et heure pour chaque nouveauté et commit',
    'Chaque entrée des onglets Nouveautés et Commits affiche en bas à droite sa date et son heure, en texte lisible. Les heures restent identiques d’une compilation à l’autre.',
  ],
  'browser-site-matching': [
    'Comptes reconnus entre domaine et sous-domaines',
    'Les adresses enregistrées sans protocole sont reconnues et les comptes sont aussi proposés sur les pages de connexion des sous-domaines du même site, comme Epic Games Store. La comparaison distingue les domaines étrangers et les services aux sous-domaines indépendants.',
  ],
  'browser-extension-navigation': [
    'Ouverture correcte de la page des extensions',
    'Le guide ouvre une nouvelle fenêtre du navigateur choisi et atteint sa page des extensions depuis la barre d’adresse. Ajout d’une adresse à copier et d’un bouton pour réessayer.',
  ],
  'browser-setup-wizard': [
    'Configuration guidée des navigateurs',
    'Le programme d’installation ouvre un assistant qui détecte les navigateurs, enregistre automatiquement la connexion locale et ouvre la page et le dossier pour charger l’extension. Également disponible dans les Paramètres.',
  ],
  'browser-quick-fill': [
    'Remplissage rapide dans les navigateurs',
    'Raccourci global personnalisable, déverrouillage dans une mini-fenêtre et choix des comptes pour le domaine HTTPS actuel via l’extension Chromium ou Firefox. Les champs sont remplis sans envoyer la connexion.',
  ],
  'news-dialog': [
    'Nouveautés et historique des commits dans JesseArchive',
    'Ajout du bouton Actualités à côté de « Protégé localement » : deux onglets, Nouveautés et Commits, avec recherche, détails des révisions et historique Git consultable hors ligne.',
  ],
  'git-ready': [
    'Historique Git et dépôt GitHub',
    'Préparation du dépôt avec l’historique reconstitué du projet, les messages de commit, les règles qui excluent les coffres et les fichiers sensibles et les outils pour publier les sources.',
  ],
  'generator-button': [
    'Bouton Générer plus grand',
    'Le bouton principal du générateur de mots de passe est plus grand, avec un texte et une zone de clic plus lisibles même dans les petites fenêtres.',
  ],
  'beta-label': [
    'Phase bêta indiquée',
    'Ajout dans les Paramètres de la mention « Version: Beta », avec le numéro tiré de la version de l’application.',
  ],
  'version-file': [
    'Version visible et nom d’installateur simple',
    'Ajout du numéro de version dans les Paramètres et simplification du nom du programme d’installation en JesseArchive-Setup.exe.',
  ],
  'installer-images': [
    'Graphismes du programme d’installation corrigés',
    'Le logo original de JesseArchive est utilisé dans la barre latérale et l’en-tête du programme d’installation, en conservant ses proportions.',
  ],
  'installer-folder': [
    'Dossier d’installation au choix',
    'Ajout d’un écran pour choisir le chemin d’installation et le transmettre au paquet MSI.',
  ],
  'category-create': [
    'Nouveaux éléments dans la bonne catégorie',
    'Depuis Comptes, Clés d’accès, Notes, Cartes, Identités et Crypto, l’éditeur sélectionne automatiquement le type de l’élément ; depuis les vues générales, il reste modifiable.',
  ],
  'inno-exe': [
    'Programme d’installation EXE avec Inno Setup',
    'Ajout d’une distribution sous la forme d’un seul programme d’installation EXE contenant le MSI Tauri, ce qui évite le problème de macros NSIS rencontré lors des compilations.',
  ],
  offline: [
    'Installation sous Windows même hors ligne',
    'Le paquet MSI inclut WebView2 hors ligne : les autres PC n’ont besoin ni de Node.js, ni de Rust, ni d’une connexion pour télécharger le moteur d’exécution.',
  ],
  'msi-brand': [
    'Programme d’installation MSI personnalisé',
    'Ajout d’images personnalisées aux écrans de l’assistant MSI tout en conservant le logo original de l’application.',
  ],
  cloud: [
    'Recherche améliorée des dossiers cloud locaux',
    'Détection élargie des dossiers OneDrive, Dropbox et d’autres fournisseurs, avec des messages clairs quand la recherche ne trouve rien.',
  ],
  history: [
    'Récupération depuis l’historique plus claire',
    'Le sélecteur peu clair est remplacé par « Utiliser pour un compte » : vous choisissez un mot de passe archivé et confirmez quel compte local mettre à jour. Ajout de la signature Instagram du développeur.',
  ],
  dialogs: [
    'Fenêtres de confirmation dans le style de l’application',
    'Les fenêtres natives de Windows et du navigateur sont remplacées par des boîtes de dialogue assorties aux thèmes pour les suppressions, vérifications, importations et autres opérations.',
  ],
  'clipboard-fixes': [
    'Corrections de la gestion du presse-papiers',
    'Correction d’incompatibilités Rust apparues lors des tests du composant clipboard-win.',
  ],
  clipboard: [
    'Copier les mots de passe sans fenêtres CMD',
    'Suppression des processus PowerShell utilisés pour copier et effacer les mots de passe du presse-papiers Windows ; ajout des icônes d’œil sur les fiches des groupes.',
  ],
  'theme-groups': [
    'Thèmes complets, logos et groupes de comptes',
    'Restauration du logo original, palettes complètes et couleurs personnalisables, groupes par site ou application avec logos, « Accesso » renommé en « Compte » et barres de défilement améliorées.',
  ],
  recovery: [
    'Confirmation du code de récupération corrigée',
    'Correction du bouton de confirmation du code de récupération et la fenêtre ne peut plus se fermer par erreur avant la confirmation.',
  ],
  'compat-fixture': [
    'Test de compatibilité avec l’ancien coffre',
    'Correction du chemin du fichier chiffré synthétique utilisé pour vérifier le déchiffrement du format Python d’origine.',
  ],
  'rust-keys': [
    'Corrections des clés cryptographiques Rust',
    'Correction d’incompatibilités de types et de durées de vie dans le portage Rust, sans modifier le format de chiffrement existant.',
  ],
  migration: [
    'Migration de Python vers Rust et React',
    'Création du nouveau projet de bureau Windows basé sur Rust, Tauri 2, React et TypeScript, compatible avec le format du coffre d’origine.',
  ],
  legacy: [
    'Projet Python conservé',
    'Une copie des sources Python d’origine est conservée comme référence pour la migration, sans inclure le coffre personnel dans le dépôt.',
  ],
};

export default news;
