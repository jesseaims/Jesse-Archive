import type { NewsTranslations } from '../../news-changelog';

// Portuguese (Brazil) titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'quick-search-open': [
    'Busca rápida sem mensagens erradas',
    'Ao abrir a busca rápida logo depois de desbloquear o cofre, a mensagem “Cofre bloqueado” podia aparecer por um instante antes dos resultados. Agora a janela mostra direto o estado certo.',
  ],
  'stable-2-0': [
    'Jesse’s Archive sai da beta',
    'A 2.0.0 é a primeira versão estável. O código é software livre com licença GPL-3.0, a extensão é instalada pela Chrome Web Store e pelo Firefox, o cofre tem cópias de segurança diárias e problemas de segurança podem ser informados em privado (SECURITY.md no repositório). A sincronização entre vários PCs por uma pasta na nuvem continua experimental: mantenha uma cópia de segurança e informe o que não funcionar. A assinatura digital do instalador foi solicitada e virá em uma próxima atualização; até lá, o Windows pode mostrar um aviso.',
  ],
  'daily-backups': [
    'Cópias de segurança diárias',
    'Todos os dias, no primeiro salvamento, o aplicativo guarda uma cópia criptografada do cofre neste PC, fora da pasta do cofre, e mantém os últimos 14 dias. Em Configurações → Dados e backup → «Cópias de segurança diárias» você pode salvar uma em outro lugar ou recuperar itens perdidos: abra a cópia com a senha mestra daquele dia e escolha o que adicionar de volta ao cofre. Quando você muda a chave dos dados (senha descoberta ou novo código de recuperação), as cópias são excluídas.',
  ],
  'store-install-guide': [
    'Extensão disponível nas lojas',
    'O guia «Configurar navegadores» abre a página da extensão na Chrome Web Store (Chrome, Edge, Brave, Opera, Vivaldi) ou no site de complementos do Firefox: basta clicar em «Adicionar» e a extensão se atualiza sozinha. No Firefox ela continua instalada depois de reiniciar o navegador. O carregamento manual da pasta do aplicativo continua disponível como alternativa; se você o usava, remova essa cópia depois de instalar a da loja.',
  ],
  'store-extension-updates': [
    'Extensão das lojas sempre atualizada',
    'As novas versões da extensão chegam sozinhas à Chrome Web Store e aos complementos do Firefox junto com as atualizações do app, e o navegador as instala automaticamente após a revisão da loja. Se você usa a extensão instalada pela loja, o app não pede mais que ela recarregue a cada início.',
  ],
  'chrome-store-extension': [
    'Pronta para a extensão da Chrome Web Store',
    'O app também reconhece a extensão que será publicada na Chrome Web Store, além da carregada manualmente da pasta do app. Se você já tinha configurado os navegadores, a conexão é atualizada sozinha ao iniciar: não é preciso refazer o guia.',
  ],
  'remote-changes-refresh': [
    'Alterações de outros PCs aparecem sozinhas',
    'Se você usa o mesmo cofre em vários PCs por meio de uma pasta na nuvem, as alterações feitas em outro PC agora aparecem sozinhas em cerca de 15 segundos. Antes o app já as recebia, mas era preciso pressionar «Atualizar» ou salvar algo para vê-las.',
  ],
  'extension-permissions': [
    'Extensão com menos permissões e avisos de subdomínios',
    'A extensão do navegador não pede mais permissão para ler todas as abas abertas, da qual não precisava: o aviso sobre o histórico de navegação desaparece na instalação, e o preenchimento, o salvamento de contas e as passkeys funcionam como antes. Na minijanela, as contas salvas para o endereço exato da página aparecem primeiro; as salvas para outro subdomínio do mesmo site mostram onde estão salvas (por exemplo «Salvo para accounts.google.com»), e se o campo estiver em um quadro de outro endereço a minijanela avisa.',
  ],
  'browser-channel-hardening': [
    'Conexão com o navegador mais protegida',
    'O arquivo com o código de acesso que a extensão usa para se conectar ao app agora só pode ser lido pelo seu usuário do Windows, mesmo que a pasta permita a leitura por outros, e é excluído quando você fecha o app. O app também fecha as conexões que não se identificam a tempo, as que excedem o limite e as que enviam mensagens demais. O preenchimento de credenciais funciona como antes e continua sempre sendo uma escolha sua na minijanela.',
  ],
  'generator-checks': [
    'Gerador e verificação de senhas mais precisos',
    'O gerador não cria mais PINs triviais como 000000 ou 123456, e a opção «Caracteres únicos» funciona também com comprimentos próximos do número de caracteres disponíveis, onde antes costumava dar erro. Os bits estimados das senhas geradas agora são uma estimativa prudente que considera as opções escolhidas. A verificação de saúde das senhas reconhece também senhas comuns com pequenas alterações (como «Password123!», «p4ssw0rd» ou um nome seguido de um ano), repetições e sequências do teclado: algumas senhas antes consideradas fortes podem agora aparecer como fracas.',
  ],
  'password-bulk-select': [
    'Arquivo de senhas mais fácil de limpar',
    'No Arquivo de senhas, o botão «Selecionar tudo» seleciona de uma vez todas as senhas excluíveis exibidas, também filtradas pela pesquisa, para limpar o histórico sem marcá-las uma a uma. As senhas atuais das contas não podem ser selecionadas: elas são alteradas na conta. Depois de excluir, o app informa quantas senhas removeu. Além disso, ao excluir definitivamente um item (inclusive esvaziando a lixeira), as senhas dele no histórico também são excluídas, em vez de ficarem como senhas não vinculadas.',
  ],
  'css-cleanup': [
    'Folha de estilos limpa',
    'Foram removidas do estilo da interface as regras que já não tinham efeito: propriedades sempre substituídas por regras posteriores e o estilo de um elemento que já não existe. A aplicação fica exatamente igual, e uma verificação automática confirmou-o regra a regra.',
  ],
  'legacy-python-removed': [
    'Removida do código-fonte a antiga versão em Python',
    'A primeira versão do Jesse’s Archive, escrita em Python, deixa de fazer parte do código-fonte: a aplicação não a usava e dificultava a manutenção. Continua disponível no histórico do projeto. Os cofres criados com essa versão continuam a abrir, e um teste verifica-o a cada alteração. Para quem usa a aplicação nada muda.',
  ],
  'export-keeps-groups': [
    'Os ficheiros exportados mantêm grupos e favoritos',
    'Ao exportar o cofre em CSV e importá-lo de novo, as contas de apps e serviços sem site (por exemplo, várias contas do mesmo jogo) voltam ao seu grupo com o respetivo nome, em vez de cada uma ficar num grupo separado, e os favoritos mantêm-se. A exportação JSON passa também a conservar os nomes e ícones dos grupos. Além disso, os elementos eliminados e depois importados de novo a partir de um ficheiro JSON já não desaparecem ao guardar.',
  ],
  'window-permissions': [
    'Cada janela só pode fazer o seu próprio trabalho',
    'A minijanela do navegador, a pesquisa rápida e o guia das extensões passam a poder usar apenas as funções de que cada uma precisa: por exemplo, já não podem exportar o cofre, ler palavras-passe que não mostram, alterar elementos nem mudar a palavra-passe principal. Tudo isto continua possível apenas a partir da janela principal. Nada muda no uso diário.',
  ],
  'group-favorites': [
    'Favoritos diretamente nos grupos de contas',
    'Na vista por grupos das contas, cada conta tem uma estrela para a adicionar ou remover dos favoritos, e a estrela junto ao nome do grupo adiciona ou remove todas as suas contas de uma vez, sem as abrir uma a uma.',
  ],
  'ui-secrets-on-demand': [
    'As palavras-passe já não ficam abertas na janela principal',
    'A janela principal passa a receber apenas os nomes, utilizadores e endereços dos elementos. Palavras-passe, PIN, CVV, números de cartão, seed phrases, códigos TOTP e o texto das notas ficam no motor da aplicação, separado da interface, até os mostrares, copiares ou abrires o elemento para o editar, e são esquecidos quando fechas o elemento ou bloqueias o cofre. As palavras-passe copiadas dos cartões das contas e do histórico vão diretamente para a área de transferência sem passar pela janela. A pesquisa continua a encontrar as palavras escritas nas notas.',
  ],
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
