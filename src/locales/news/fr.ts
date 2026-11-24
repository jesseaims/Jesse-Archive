import type { NewsTranslations } from '../../news-changelog';

// French titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'store-extension-updates': [
    'Extension des boutiques toujours à jour',
    'Les nouvelles versions de l’extension arrivent seules sur le Chrome Web Store et sur le site des modules Firefox avec les mises à jour de l’application, et le navigateur les installe automatiquement après la vérification de la boutique. Si vous utilisez l’extension installée depuis la boutique, l’application ne lui demande plus de se recharger à chaque démarrage.',
  ],
  'chrome-store-extension': [
    'Prête pour l’extension du Chrome Web Store',
    'L’application reconnaît aussi l’extension qui sera publiée sur le Chrome Web Store, en plus de celle chargée à la main depuis le dossier de l’application. Si vous aviez déjà configuré vos navigateurs, la liaison se met à jour seule au démarrage : inutile de refaire le guide.',
  ],
  'remote-changes-refresh': [
    'Les modifications des autres PC s’affichent seules',
    'Si vous utilisez le même coffre sur plusieurs PC via un dossier cloud, les modifications faites sur un autre PC s’affichent désormais seules en 15 secondes environ. Avant, l’application les recevait déjà, mais il fallait appuyer sur « Actualiser » ou enregistrer quelque chose pour les voir.',
  ],
  'extension-permissions': [
    'Extension avec moins de permissions et avis sur les sous-domaines',
    'L’extension du navigateur ne demande plus l’autorisation de lire tous les onglets ouverts, dont elle n’avait pas besoin : l’avertissement sur l’historique de navigation disparaît à l’installation, et le remplissage, l’enregistrement des comptes et les passkeys fonctionnent comme avant. Dans la mini-fenêtre, les comptes enregistrés pour l’adresse exacte de la page apparaissent en premier ; ceux enregistrés pour un autre sous-domaine du même site indiquent où ils sont enregistrés (par exemple « Enregistré pour accounts.google.com »), et si le champ se trouve dans un cadre d’une autre adresse, la mini-fenêtre le signale.',
  ],
  'browser-channel-hardening': [
    'Connexion avec le navigateur mieux protégée',
    'Le fichier contenant le code d’accès que l’extension utilise pour se connecter à l’application ne peut désormais être lu que par votre utilisateur Windows, même si le dossier permet à d’autres de le lire, et il est supprimé à la fermeture de l’application. L’application ferme aussi les connexions qui ne s’identifient pas à temps, celles en trop et celles qui envoient trop de messages. Le remplissage des identifiants fonctionne comme avant et reste toujours votre choix dans la mini-fenêtre.',
  ],
  'generator-checks': [
    'Générateur et contrôle des mots de passe plus précis',
    'Le générateur ne crée plus de codes PIN triviaux comme 000000 ou 123456, et l’option « Caractères uniques » fonctionne aussi avec des longueurs proches du nombre de caractères disponibles, alors qu’elle donnait souvent une erreur. Les bits estimés des mots de passe générés sont désormais une estimation prudente qui tient compte des options choisies. Le contrôle de santé des mots de passe reconnaît aussi les mots de passe courants légèrement modifiés (comme « Password123! », « p4ssw0rd » ou un prénom suivi d’une année), les répétitions et les suites du clavier : certains mots de passe jugés robustes peuvent désormais apparaître comme faibles.',
  ],
  'password-bulk-select': [
    'Archive des mots de passe plus facile à nettoyer',
    'Dans l’Archive des mots de passe, le bouton « Tout sélectionner » sélectionne d’un coup tous les mots de passe supprimables affichés, même filtrés par la recherche, pour nettoyer l’historique sans les cocher un par un. Les mots de passe actuels des comptes ne peuvent pas être sélectionnés : ils se modifient dans le compte. Après la suppression, l’application indique combien de mots de passe elle a retirés. De plus, supprimer définitivement un élément (y compris en vidant la corbeille) supprime aussi ses mots de passe de l’historique, au lieu de les laisser comme mots de passe non liés.',
  ],
  'css-cleanup': [
    'Feuille de style nettoyée',
    'Les règles qui n’avaient plus d’effet ont été retirées du style de l’interface : propriétés toujours remplacées par des règles suivantes et style d’un élément qui n’existe plus. L’application reste identique, et un contrôle automatique l’a vérifié règle par règle.',
  ],
  'legacy-python-removed': [
    'L’ancienne version Python retirée du code source',
    'La première version de Jesse’s Archive, écrite en Python, ne fait plus partie du code source : l’application ne l’utilisait pas et elle compliquait la maintenance. Elle reste consultable dans l’historique du projet. Les coffres créés avec cette version s’ouvrent toujours, et un test le vérifie à chaque modification. Rien ne change pour les utilisateurs.',
  ],
  'export-keeps-groups': [
    'Les fichiers exportés conservent groupes et favoris',
    'En exportant le coffre en CSV puis en le réimportant, les comptes des applications et services sans site (par exemple plusieurs comptes du même jeu) retrouvent leur groupe et son nom au lieu de finir chacun dans un groupe séparé, et les favoris restent favoris. L’export JSON conserve désormais aussi les noms et icônes des groupes. De plus, les éléments supprimés puis réimportés depuis un fichier JSON ne disparaissent plus à l’enregistrement suivant.',
  ],
  'window-permissions': [
    'Chaque fenêtre ne peut faire que son propre travail',
    'La mini-fenêtre du navigateur, la recherche rapide et le guide des extensions ne peuvent désormais utiliser que les fonctions dont chacune a besoin : par exemple, elles ne peuvent plus exporter le coffre, lire des mots de passe qu’elles n’affichent pas, modifier des éléments ou changer le mot de passe principal. Tout cela reste possible uniquement depuis la fenêtre principale. Rien ne change dans l’usage quotidien.',
  ],
  'group-favorites': [
    'Favoris directement depuis les groupes de comptes',
    'Dans la vue par groupes des comptes, chaque compte a une étoile pour l’ajouter aux favoris ou l’en retirer, et l’étoile à côté du nom du groupe ajoute ou retire tous ses comptes d’un coup, sans les ouvrir un par un.',
  ],
  'ui-secrets-on-demand': [
    'Les mots de passe ne restent plus ouverts dans la fenêtre principale',
    'La fenêtre principale ne reçoit plus que les noms, identifiants et adresses des éléments. Les mots de passe, codes PIN, CVV, numéros de carte, seed phrases, codes TOTP et le texte des notes restent dans le moteur de l’application, séparé de l’interface, jusqu’à ce que vous les affichiez, les copiiez ou ouvriez l’élément pour le modifier, et ils sont oubliés quand vous fermez l’élément ou verrouillez le coffre. Les mots de passe copiés depuis les fiches des comptes et l’historique vont directement dans le presse-papiers sans passer par la fenêtre. La recherche trouve toujours les mots écrits dans les notes.',
  ],
  'vault-scrypt-rollback': [
    'Mot de passe principal plus difficile à casser et avertissement sur les anciennes copies',
    'Au premier déverrouillage, la protection du mot de passe principal passe à un calcul quatre fois plus lourd (scrypt avec 128 Mo de mémoire) : quiconque obtient une copie du coffre met beaucoup plus de temps à essayer des mots de passe. Le déverrouillage peut prendre une fraction de seconde de plus. Les nouveaux paquets .jshare utilisent aussi cette protection. Si le fichier du coffre est remplacé par une copie plus ancienne (par exemple dans le dossier cloud), un avertissement s’affiche à l’ouverture. De plus, une modification non enregistrée parce que le fichier était occupé est désormais enregistrée à la synchronisation suivante. Si vous utilisez le coffre sur plusieurs PC, mettez-les tous à jour : après le premier déverrouillage avec cette version, les précédentes ne peuvent plus l’ouvrir.',
  ],
  'vault-header-key-rotation': [
    'Meilleure protection lors du changement de mot de passe principal',
    'L’en-tête du coffre est désormais signé avec une clé que vous seul pouvez obtenir : une ancienne copie placée dans le dossier du coffre (par exemple par quelqu’un ayant accès à votre cloud) ne peut plus faire revenir un ancien mot de passe principal. En changeant le mot de passe principal, vous pouvez cocher « L’ancien mot de passe a peut-être été découvert » : la clé qui chiffre les données change aussi, l’ancien mot de passe n’ouvre plus le coffre, même à partir d’une copie, et vous recevez un nouveau code de récupération à conserver. Un nouveau code de récupération change toujours aussi la clé. Si vous utilisez le coffre sur plusieurs PC, mettez-les tous à jour d’abord.',
  ],
  'universal-import': [
    'Importez depuis les principaux gestionnaires de mots de passe',
    'L’import reconnaît désormais les fichiers de Bitwarden (CSV et JSON non chiffré), LastPass, 1Password, Dashlane, NordPass, Proton Pass, KeePass et KeePassXC (CSV et XML), RoboForm ainsi que de Chrome, Edge, Brave, Opera, Firefox et Mots de passe d’Apple. Avant l’import, un aperçu indique le programme reconnu et le nombre d’éléments trouvés ; pour les CSV, vous pouvez vérifier et changer le champ de chaque colonne, ce qui permet d’importer aussi les fichiers d’autres programmes.',
  ],
  'bulk-select-accounts': [
    'Sélectionnez plusieurs comptes à la fois',
    'Dans « Tous les éléments » et « Comptes », vous pouvez désormais sélectionner des groupes entiers ou des comptes isolés avec leur case, ou tout ce qui est affiché avec « Tout sélectionner » (y compris les résultats d’une recherche), puis les mettre à la corbeille ou dans un dossier en une fois.',
  ],
  'kaspersky-import': [
    'Importer depuis Kaspersky Password Manager',
    'Jesse’s Archive importe désormais le fichier texte (.txt) que Kaspersky Password Manager crée avec « Exporter vers un fichier texte » : sites, applications et autres comptes deviennent des comptes avec nom, adresse, identifiant, mot de passe et commentaires, et les notes de Kaspersky deviennent des notes. Supprimez ensuite le fichier exporté : il contient vos mots de passe en clair.',
  ],
  'unlock-throttling': [
    'Protection contre les tentatives de deviner le mot de passe',
    'Après 5 tentatives erronées d’affilée pour déverrouiller le coffre (mot de passe principal ou code de récupération), Jesse’s Archive vous fait attendre 30 secondes avant l’essai suivant, en doublant à chaque fois jusqu’à 15 minutes. Le compteur résiste au redémarrage de l’application et s’efface au premier déverrouillage réussi.',
  ],
  'save-new-logins': [
    'Enregistrez les nouveaux comptes depuis le navigateur',
    'Quand vous vous inscrivez sur un site, ou vous connectez avec un compte qui n’est pas encore dans le coffre, Jesse’s Archive vous demande s’il faut l’enregistrer : nom, identifiant ou e-mail, mot de passe et, si vous le souhaitez, les autres données saisies forment un nouveau compte pour ce site. Si vous changez un mot de passe sur un site, il propose de mettre à jour celui enregistré. Rien n’est enregistré sans votre confirmation, et vous pouvez le désactiver ou exclure des sites dans les Paramètres. Nécessite l’extension mise à jour.',
  ],
  'installer-sharper-images': [
    'Images de l’installateur plus nettes',
    'Le logo et le nom sur le côté de l’installateur sont désormais nets : ils proviennent de l’illustration d’origine et sont préparés à la taille exacte pour chaque mise à l’échelle de l’écran, Windows n’a donc plus à les étirer.',
  ],
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
