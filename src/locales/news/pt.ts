import type { NewsTranslations } from '../../news-changelog';

// Portuguese (Brazil) titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'vault-scrypt-rollback': [
    'Palavra-passe principal mais difícil de quebrar e aviso sobre cópias antigas',
    'No primeiro desbloqueio, a proteção da palavra-passe principal passa a um cálculo quatro vezes mais pesado (scrypt com 128 MB de memória): quem obtiver uma cópia do cofre demora muito mais a experimentar palavras-passe. O desbloqueio pode demorar uma fração de segundo a mais. Os novos pacotes .jshare também usam esta proteção. Se o ficheiro do cofre for substituído por uma cópia mais antiga (por exemplo, na pasta da nuvem), aparece um aviso ao abri-lo. Além disso, uma alteração não guardada porque o ficheiro estava ocupado passa a ser guardada na sincronização seguinte. Se usas o cofre em vários PC, atualiza-os todos: depois do primeiro desbloqueio com esta versão, as anteriores deixam de o conseguir abrir.',
  ],
  'vault-header-key-rotation': [
    'Mais proteção ao mudar a palavra-passe principal',
    'O cabeçalho do cofre passa a ser assinado com uma chave que só tu podes obter: uma cópia antiga colocada na pasta do cofre (por exemplo, por alguém com acesso à tua nuvem) já não pode trazer de volta uma palavra-passe principal antiga. Ao mudar a palavra-passe principal podes marcar «A palavra-passe antiga pode ter sido descoberta»: a chave que cifra os dados também muda, por isso a palavra-passe antiga deixa de abrir o cofre, mesmo a partir de uma cópia, e recebes um novo código de recuperação para guardar. Um novo código de recuperação muda sempre também a chave. Se usas o cofre em vários PC, atualiza-os todos primeiro.',
  ],
  'universal-import': [
    'Importa dos principais gestores de palavras-passe',
    'A importação reconhece agora os ficheiros do Bitwarden (CSV e JSON não cifrado), LastPass, 1Password, Dashlane, NordPass, Proton Pass, KeePass e KeePassXC (CSV e XML), RoboForm e do Chrome, Edge, Brave, Opera, Firefox e Palavras-passe da Apple. Antes de importar, uma pré-visualização mostra o programa reconhecido e quantos elementos encontrou; nos CSV podes verificar e mudar o campo de cada coluna, por isso também funcionam ficheiros de outros programas.',
  ],
  'bulk-select-accounts': [
    'Seleciona muitas contas de uma vez',
    'Em «Todos os elementos» e «Contas» já podes selecionar grupos inteiros ou contas individuais com a respetiva caixa, ou tudo o que vês com «Selecionar tudo» (também os resultados de uma pesquisa), e movê-los de uma vez para o lixo ou para uma pasta.',
  ],
  'kaspersky-import': [
    'Importar do Kaspersky Password Manager',
    'O Jesse’s Archive importa agora o ficheiro de texto (.txt) que o Kaspersky Password Manager cria com «Exportar para ficheiro de texto»: sites, aplicações e outras contas passam a contas com nome, endereço, utilizador, palavra-passe e comentários, e as notas do Kaspersky passam a notas. Depois apaga o ficheiro exportado: contém as tuas palavras-passe em claro.',
  ],
  'unlock-throttling': [
    'Proteção contra quem tenta adivinhar a palavra-passe',
    'Após 5 tentativas erradas seguidas de desbloquear o cofre (palavra-passe principal ou código de recuperação), o Jesse’s Archive faz-te esperar 30 segundos antes da seguinte, o dobro de cada vez até 15 minutos. A contagem mantém-se ao reiniciar a app e é apagada no primeiro desbloqueio correto.',
  ],
  'save-new-logins': [
    'Guarda contas novas a partir do navegador',
    'Quando te registas num site, ou inicias sessão com uma conta que ainda não está no cofre, o Jesse’s Archive pergunta se a queres guardar: nome, utilizador ou email, palavra-passe e, se quiseres, os outros dados introduzidos passam a uma conta nova para esse site. Se mudares uma palavra-passe num site, propõe atualizar a guardada. Nada é guardado sem a tua confirmação, e podes desativar a função ou excluir sites nas Definições. Requer a extensão atualizada.',
  ],
  'installer-sharper-images': [
    'Imagens do instalador mais nítidas',
    'O logotipo e o nome na lateral do instalador agora aparecem nítidos: vêm da ilustração original e são preparados no tamanho exato para cada escala de ecrã, por isso o Windows já não precisa de os esticar.',
  ],
  'new-installer': [
    'Novo instalador no estilo do app',
    'O instalador foi refeito: uma única janela do início ao fim, com o tema escuro e o logotipo do Jesse’s Archive, no lugar do procedimento que passava pelo Windows Installer. Agora ele também tem sua própria desinstalação, que remove o programa sem mexer no cofre nem nas configurações. Ao atualizar a partir da versão anterior, você não precisa fazer nada: o novo instalador substitui o antigo na mesma pasta.',
  ],
  'extension-logo-autoreload': [
    'Logotipo da extensão e recarga automática',
    'A extensão do navegador agora mostra o logotipo do Jesse’s Archive na barra e na lista de extensões. Depois de cada atualização ela se recarrega sozinha assim que se conecta ao app, sem precisar fazer isso manualmente na página de extensões. Desta vez, recarregue-a manualmente: a recarga automática vale a partir das próximas atualizações.',
  ],
  'breach-check-autofill-fixes': [
    'Verificação de vazamentos e preenchimento mais confiáveis',
    'A verificação de contas comprometidas agora também funciona com cofres grandes (antes parava com “Não foi possível contatar o Pwned Passwords” a partir de cerca de 120 senhas) e tenta de novo sozinha se a rede falhar. O preenchimento no navegador também reconhece os campos de login de sites feitos com componentes web, como o Reddit, e os quadros de login de um subdomínio do mesmo site, como o da Ubisoft. Depois da atualização, recarregue a extensão na página de extensões do navegador.',
  ],
  'global-quick-search': [
    'Pesquisa rápida global',
    'Pressione Ctrl+Shift+Space em qualquer aplicativo, mesmo com o Jesse’s Archive na área de notificação, para abrir uma janela de pesquisa compacta: encontre contas por nome, usuário, e-mail ou site, com as contas do mesmo serviço agrupadas, e copie o usuário ou a senha, mostre a senha por alguns segundos, abra o site ou abra o item no cofre, tudo pelo teclado. Funciona apenas com o cofre desbloqueado, as senhas são copiadas sem passar pela janela e a área de transferência é limpa como de costume. Atalho e opções ficam em Configurações → Pesquisa rápida global.',
  ],
  'window-state': [
    'A janela lembra o tamanho e a posição',
    'O Jesse’s Archive reabre como você o deixou: em tela cheia, maximizado ou com o tamanho e a posição que escolheu, mesmo depois de passar pela bandeja do sistema. Se a tela em que estava não estiver mais conectada, a janela abre no centro da tela disponível.',
  ],
  'customizable-dashboard': [
    'Painel personalizável',
    'O novo Painel é a central de controle do aplicativo: pontuação de segurança, análise de senhas, visão geral do cofre, favoritos, itens recentes, notas protegidas, ações rápidas, gerador, status do backup e privacidade. Com “Personalizar painel” você adiciona, remove, arrasta e redimensiona os widgets, escolhe entre vários layouts e ajusta as opções de cada um; tudo é salvo automaticamente no cofre criptografado e nenhum widget mostra senhas.',
  ],
  multilanguage: [
    'O Jesse’s Archive fala o seu idioma',
    'Com o novo botão “Idioma” no canto superior direito, você escolhe entre italiano, inglês, espanhol, francês, alemão, português, russo, chinês, japonês e coreano. O aplicativo inteiro muda na hora, incluindo a tela de desbloqueio, a minijanela do navegador e o menu da área de notificação; na primeira inicialização é usado o idioma do Windows. O instalador e a extensão do navegador também seguem o idioma do sistema.',
  ],
  'installer-logo': [
    'Logotipo do instalador corrigido',
    'Durante a instalação, o logotipo no canto superior direito não aparece mais achatado: agora é o logotipo do aplicativo, nítido e com as proporções certas mesmo com a tela ampliada.',
  ],
  'webauthn-passkeys': [
    'Chaves de acesso nos sites',
    'Quando um site oferece uma chave de acesso, o Jesse’s Archive abre a minijanela: você pode salvá-la no cofre criptografado e usá-la para entrar, ou escolher “Usar outro dispositivo” para o celular ou o Windows Hello. Cada uso exige sua confirmação. Recarregue a extensão no navegador depois de atualizar; o Firefox precisa da versão 128 ou posterior. Desative em Configurações → Área de trabalho.',
  ],
  'auto-update': [
    'Atualizações automáticas',
    'O aplicativo procura novas versões ao iniciar e uma vez por dia e pergunta se você quer instalá-las: “Atualizar agora” baixa o instalador, verifica a assinatura digital do autor e reabre o aplicativo atualizado. Em Configurações → Atualizações você pode procurar manualmente ou desativar a verificação automática.',
  ],
  'zoom-typed-min-max': [
    'Zoom à sua escolha, mínimo e máximo',
    'Em Configurações → Aparência você pode digitar a porcentagem de zoom que preferir (de 50 a 200) e usar os dois novos botões para ir direto ao zoom mínimo ou máximo.',
  ],
  'interface-zoom': [
    'Zoom da interface',
    'Amplie ou reduza o aplicativo com Ctrl + + e Ctrl + − (ou Ctrl + F12 / Ctrl + F11 ou Ctrl + roda do mouse) e volte a 100% com Ctrl + 0. Também está em Configurações → Aparência: vale para todas as janelas e fica salvo neste PC.',
  ],
  'empty-trash': [
    'Esvaziar lixeira',
    'Na página Lixeira, o botão “Esvaziar lixeira” exclui permanentemente todos os itens de uma vez, depois de duas confirmações que mostram o que será excluído.',
  ],
  'settings-layout-installer-flow': [
    'Configurações mais compactas e instalação mais prática',
    'Os painéis das Configurações se organizam sem espaços vazios. A instalação oferece a opção de iniciar o aplicativo ao final, e o guia de extensões tem o botão “Instalei a extensão”, que o fecha e abre o Jesse’s Archive.',
  ],
  'refresh-feedback-appearance': [
    'Botão Atualizar com resultado e nova aba Aparência',
    'O botão Atualizar mostra o que fez: se encontrou itens novos, alterados ou removidos, ou se tudo já estava atualizado, e em caso de problema explica o que deu errado. Os temas e as cores do aplicativo agora têm uma aba própria, Aparência, nas Configurações.',
  ],
  'regroup-on-site-change': [
    'O site de uma conta é atualizado quando você o altera',
    'Se você mudar o site de uma conta, ela aparece logo sob o novo site na coleção, em vez de ficar no site informado no início. As entradas salvas antes também são corrigidas sozinhas.',
  ],
  'delete-accounts-and-groups': [
    'Exclusão de contas, grupos e itens',
    'Cada grupo de contas tem o botão “Excluir conta” para uma única conta e uma lixeira para excluir o grupo inteiro, com dupla confirmação que lista o que será excluído. Os itens das outras categorias também são excluídos com um clique e uma confirmação. Tudo vai para a Lixeira, de onde pode ser restaurado.',
  ],
  'session-hardening': [
    'Bloqueio automático mais confiável e importações mais seguras',
    'O cofre realmente se bloqueia após o tempo de inatividade escolhido, mesmo com a janela oculta, e a tela é limpa. Teclado, cliques e rolagem contam como atividade. Um arquivo de importação com um único item inválido é recusado sem alterar o cofre, e o comprimento mínimo das senhas agora conta corretamente as letras acentuadas.',
  ],
  'news-entry-timestamps': [
    'Data e hora em cada novidade e commit',
    'Cada item das abas Novidades e Commits mostra no canto inferior direito sua data e hora, em texto legível. Os horários permanecem iguais de uma compilação para outra.',
  ],
  'browser-site-matching': [
    'Contas reconhecidas entre domínio e subdomínios',
    'Endereços salvos sem protocolo são reconhecidos, e as contas também são sugeridas nas páginas de login dos subdomínios do mesmo site, como a Epic Games Store. A comparação distingue domínios estranhos e serviços com subdomínios independentes.',
  ],
  'browser-extension-navigation': [
    'Página de extensões aberta corretamente',
    'O guia abre uma nova janela do navegador escolhido e chega à página de extensões pela barra de endereços. Foram adicionados um endereço para copiar e um botão para tentar de novo.',
  ],
  'browser-setup-wizard': [
    'Configuração guiada dos navegadores',
    'O instalador abre um assistente que detecta os navegadores, registra automaticamente a conexão local e abre a página e a pasta para carregar a extensão. Também disponível nas Configurações.',
  ],
  'browser-quick-fill': [
    'Preenchimento rápido nos navegadores',
    'Atalho global personalizável, desbloqueio em uma minijanela e escolha das contas para o domínio HTTPS atual pela extensão para Chromium ou Firefox. Os campos são preenchidos sem enviar o login.',
  ],
  'news-dialog': [
    'Novidades e histórico de commits dentro do JesseArchive',
    'Adicionado o botão Notícias ao lado de “Protegido localmente”: duas abas, Novidades e Commits, com pesquisa, detalhes das revisões e histórico do Git consultável off-line.',
  ],
  'git-ready': [
    'Histórico do Git e repositório no GitHub',
    'O repositório foi preparado com a história reconstruída do projeto, as mensagens de commit, regras para excluir cofres e arquivos sensíveis e ferramentas para publicar o código.',
  ],
  'generator-button': [
    'Botão Gerar maior',
    'O botão principal do gerador de senhas ficou maior, com texto e área de clique mais legíveis mesmo em janelas pequenas.',
  ],
  'beta-label': [
    'Fase Beta identificada',
    'Adicionada nas Configurações a indicação “Version: Beta”, com o número obtido da versão do aplicativo.',
  ],
  'version-file': [
    'Versão visível e instalador com nome simples',
    'Adicionado o número da versão nas Configurações e simplificado o nome do instalador para JesseArchive-Setup.exe.',
  ],
  'installer-images': [
    'Gráficos do instalador corrigidos',
    'O logotipo original do JesseArchive é usado na barra lateral e no cabeçalho do instalador, mantendo suas proporções.',
  ],
  'installer-folder': [
    'Pasta de instalação selecionável',
    'Adicionada ao instalador uma tela para escolher o caminho de instalação e repassá-lo ao pacote MSI.',
  ],
  'category-create': [
    'Novos itens na categoria certa',
    'Em Contas, Chaves de acesso, Notas, Cartões, Identidades e Cripto, o editor seleciona automaticamente o tipo do item; nas visões gerais ele continua editável.',
  ],
  'inno-exe': [
    'Instalador EXE com Inno Setup',
    'Adicionada a distribuição por um único instalador EXE que contém o MSI do Tauri, evitando o problema das macros NSIS encontrado nas compilações.',
  ],
  offline: [
    'Instalação no Windows também off-line',
    'O pacote MSI inclui o WebView2 off-line, então os outros PCs não precisam de Node.js, Rust nem de conexão para baixar o runtime.',
  ],
  'msi-brand': [
    'Instalador MSI personalizado',
    'Adicionadas imagens personalizadas às telas do assistente MSI, mantendo o logotipo original do aplicativo.',
  ],
  cloud: [
    'Busca melhorada de pastas locais na nuvem',
    'A detecção de pastas do OneDrive, Dropbox e outros provedores foi ampliada, com mensagens claras quando a busca não encontra nada.',
  ],
  history: [
    'Recuperação do histórico mais clara',
    'O seletor confuso foi substituído por “Usar na conta”: você escolhe uma senha arquivada e confirma qual conta local atualizar. Adicionada a assinatura do Instagram do desenvolvedor.',
  ],
  dialogs: [
    'Janelas de confirmação no estilo do aplicativo',
    'Os pop-ups nativos do Windows e do navegador foram substituídos por diálogos combinando com os temas para exclusões, verificações, importações e outras operações.',
  ],
  'clipboard-fixes': [
    'Correções na área de transferência',
    'Corrigidas incompatibilidades do Rust surgidas nos testes do componente clipboard-win.',
  ],
  clipboard: [
    'Copiar senhas sem janelas do CMD',
    'Removidos os processos do PowerShell usados para copiar e apagar senhas da área de transferência do Windows; adicionados os ícones de olho nos cartões dos grupos.',
  ],
  'theme-groups': [
    'Temas completos, logotipos e grupos de contas',
    'Restaurado o logotipo original, introduzidas paletas completas e cores personalizáveis, grupos por site/aplicativo com logotipos, “Accesso” renomeado para “Conta” e barras de rolagem melhoradas.',
  ],
  recovery: [
    'Confirmação do código de recuperação corrigida',
    'Corrigido o botão de confirmação do código de recuperação e impedido que a janela feche sem querer antes da confirmação.',
  ],
  'compat-fixture': [
    'Teste de compatibilidade com o cofre antigo',
    'Corrigido o caminho do arquivo criptografado sintético usado para verificar a descriptografia do formato Python original.',
  ],
  'rust-keys': [
    'Correções nas chaves criptográficas do Rust',
    'Corrigidas incompatibilidades de tipos e lifetimes na migração para Rust, sem alterar o formato de criptografia existente.',
  ],
  migration: [
    'Migração de Python para Rust e React',
    'Criado o novo projeto de desktop para Windows baseado em Rust, Tauri 2, React e TypeScript, compatível com o formato original do cofre.',
  ],
  legacy: [
    'Projeto Python preservado',
    'Uma cópia do código Python original foi mantida como referência para a migração, sem incluir o cofre pessoal no repositório.',
  ],
};

export default news;
