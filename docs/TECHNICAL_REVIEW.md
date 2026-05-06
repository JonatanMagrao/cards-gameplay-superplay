# Revisao Tecnica do Cards Gameplay

Data da revisao: 2026-04-26
Ultima atualizacao: 2026-05-06

Este documento resume uma revisao ampla da extensao CEP Cards Gameplay, cobrindo arquitetura, performance, fluxos de layout, manutenibilidade e provaveis fontes de bugs. Ele reflete a direcao atual do projeto: marcadores como historico de acoes, expressoes para estado visual, `FX Precomp` para audio/VFX gerados, e restore/reset como principal fluxo de seguranca.

## Resumo Executivo

O projeto esta em um estado funcional forte. A migracao recente para expressoes externas, `Cards Controls`, `FX Precomp`, restore guiado por marcadores e SFX sequencial cria uma boa base.

As maiores melhorias agora nao sao novos recursos. Sao consolidacao e previsibilidade:

1. Separar regras de gameplay, integracao com AE e responsabilidades de UI.
2. Reduzir trabalho de expressoes que varrem a composicao inteira a cada frame.
3. Padronizar helpers de ExtendScript.
4. Tornar reset/restore mais transacionais e faceis de depurar.
5. Limpar boilerplate herdado do Bolt CEP, assets nao utilizados e estilos globais.

## Comandos Atuais de Validacao

Estes checks devem passar antes de avancar fases tecnicas:

- `yarn -s tsc -p src/jsx/aeft/tsconfig.json --noEmit --target ES5`
- `yarn -s tsc -p tsconfig-build.json --noEmit`
- varredura do lado ExtendScript para APIs modernas de JS arriscadas em `src/jsx/aeft`
- quando disponivel localmente, check de sintaxe para a biblioteca externa `assets/expressions/superplay-expression-lib.jsx` no Assets Path configurado.

Observacao: `--target ES5` e necessario atualmente porque o TypeScript 5 nao aceita mais `target: "es3"` no `tsconfig`.

## Mapa do Projeto

- `src/js/main`: UI do painel CEP em React.
- `src/js/main/assetPaths.ts`: resolucao dos caminhos configuraveis de assets, levels, tutoriais, cache e releases.
- `src/jsx/aeft`: acoes do After Effects, helpers e entrypoints de `evalTS`.
- `src/jsx/utils/expressions.ts`: strings de expressoes aplicadas nas propriedades das camadas.
- `assets/expressions/superplay-expression-lib.jsx`: biblioteca externa de expressoes, carregada do Assets Path configurado com `footage(...).sourceData`.
- Assets pesados como decks, presets, coin VFX, SFX, progress bar e projeto `.aepx` ficam fora do pacote da extensao, no Google Drive/Shared Drive configurado pelo usuario.
- `levels`, `video-tutorials` e `extension-releases`: pastas irmas de `assets` usadas para layouts salvos, tutoriais locais e releases instalaveis.
- `docs/card-animation-tutorials.md`: tutorial de uso voltado ao usuario.
- `README.md` e `CHANGELOG.md`: ainda estao majoritariamente como boilerplate do Bolt CEP.

## Fase 1: Seguranca e Previsibilidade

Estas sao as primeiras melhorias a priorizar:

1. Evitar estado global de RegExp para checks de tags de camada.
2. Adicionar uma guarda explicita para composicao ativa.
3. Fazer `restoreCardsAnimation` restaurar tempo da composicao e selecao mesmo se algo falhar.
4. Validar estado obrigatorio de target/assets antes de trabalhos destrutivos de rebuild.
5. Melhorar mensagens voltadas ao usuario para que sejam claras e em ingles.

## Atualizacao de Implementacao

Status em 2026-05-06:

- Fase 1 aplicada: checks de tags sem estado, guardas de composicao ativa, restore transacional e mensagens voltadas ao usuario em ingles.
- Fase 2 fechada operacionalmente: helpers reutilizaveis de snapshot de composicao/selecao, helpers de marcador, lookups tipados de itens do projeto, remocao do helper legado `getItemByName`, save de layout lendo valores base/pre-expression e typecheck ExtendScript passando.
- A divisao fisica completa dos modulos `aeft-utils.ts` e `aeft-utils-jonatan.ts` continua sendo uma melhoria de baixo risco para uma fase futura, mas os principais contratos reutilizaveis da Fase 2 ja estao em uso.
- Fase 3 concluida: markers de acoes `Jump` e `Flip Stock` agora recebem metadata `actionOrder`, permitindo que a expressao de posicao do Jump evite varrer todas as camadas por frame em layouts novos/restaurados.
- Fase 3 validada manualmente em uma composicao com aproximadamente 48 cartas, com performance satisfatoria na maquina de teste.
- Decisao de Fase 3: o Progress Bar permanece dinamico e continua lendo os markers `Jump` da composicao alvo. A tentativa de gravar markers `Progress Trigger` no layer do Progress Bar foi descartada para evitar metadata artificial e manter edicoes manuais de markers refletidas automaticamente.
- Fase 3 tambem estabilizou o fluxo de undo em Apply/Restore, reduzindo reordenacao de layers desnecessaria e movendo preparacoes de assets para fora dos undo groups principais.

## Achados de Alta Prioridade

### 1. Deteccao de Tags de Camada Nao Deve Usar Regex Global

Alguns checks de tags usavam regexes com a flag `g`. Em JavaScript, regexes globais mantem `lastIndex`, o que pode causar falhas intermitentes quando a mesma regex e reutilizada.

Areas afetadas incluiam deteccao de camadas de cartas e preservacao de tags em:

- `src/jsx/aeft/cards-utils.ts`
- `src/jsx/aeft/actions.ts`

Recomendacao: usar helpers sem estado, como `layerNameHasTag()` e `getLayerCardTag()`.

### 2. Restore Deve Ser Transacional

`restoreCardsAnimation` altera o tempo da composicao, o estado de selecao, as camadas de FX geradas e o estado de animacao das cartas. Se algo falhar no meio do restore, a composicao ainda deve voltar ao tempo e selecao anteriores do usuario.

Recomendacao:

- capturar tempo atual e selecao;
- validar requisitos de target antes de limpar FX;
- limpar/reconstruir dentro de `try`;
- restaurar tempo e selecao em `finally`.

### 3. Modulos de Utilidades do AE Estao Sobrepostos

Existem dois modulos de utilidades com responsabilidades sobrepostas:

- `src/jsx/aeft/aeft-utils.ts`
- `src/jsx/aeft/aeft-utils-jonatan.ts`

Exemplos de sobreposicao/risco:

- helpers de iteracao de camadas vivem em mais de um estilo;
- busca de itens do projeto e baseada em nome e tem tipagem frouxa;
- alguns nomes de helpers parecem genericos, mas retornam apenas `CompItem`;
- iteracao sobre camadas selecionadas pode ser insegura quando acoes adicionam camadas durante o loop.

Divisao futura recomendada:

- `ae-comp.ts`: composicao ativa, snapshots de selecao, iteracao de camadas.
- `ae-project.ts`: busca/importacao de itens do projeto por tipo e caminho.
- `ae-props.ts`: paths de propriedades, acesso a propriedades, setters de expressao.
- `markers.ts`: leitura/escrita de marcadores e parsing de dados de marcador.

### 4. Expressoes Podem Ficar Caras em Composicoes Grandes

Algumas expressoes varrem muitas camadas/marcadores repetidamente:

- posicao de Jump calcula ordem de acoes varrendo marcadores da composicao;
- posicao de Stock calcula ordem de acoes e offsets de deslocamento dinamicamente;
- progress bar varre triggers de marcadores.

Isso e correto e flexivel, mas pode ficar caro em composicoes grandes porque o trabalho acontece por frame avaliado e por expressao de camada.

Caminho recomendado:

1. Manter as expressoes dinamicas enquanto o projeto for pequeno/medio.
2. Medir uma composicao grande de producao.
3. Se necessario, gerar dados de timeline de acoes durante restore/apply e armazenar em um marcador de camada de controle ou propriedade de controle.
4. Mover mais helpers compartilhados de expressao para a biblioteca externa.

### 5. Compatibilidade TypeScript/ExtendScript Precisa de Politica Clara

O codigo fonte e TypeScript, mas a compatibilidade de runtime e ExtendScript. O painel pode usar JS moderno; os scripts do lado AE devem permanecer conservadores.

Recomendado:

- usar ES5 para compatibilidade de typecheck;
- manter uma varredura automatizada contra APIs nao suportadas em `src/jsx/aeft`;
- evitar depender de metodos de array no codigo do lado ExtendScript, a menos que a transpilacao seja explicitamente verificada.

## Riscos Funcionais

### Posse da FX Precomp

`FX Precomp` e tratada atualmente como output gerado, e reset/restore limpam seu conteudo. Isso e bom para determinismo. Se usuarios comecarem a adicionar FX manuais dentro dessa precomp, o reset ira apaga-los.

Decisao aplicada: `FX Precomp` pertence a ferramenta. Usuarios nao devem depender de edicoes manuais persistentes dentro dela. Quando a pasta `Disney Solitaire Cards` existe no projeto, a precomp gerada e organizada dentro dessa pasta; caso contrario, fica no root do projeto.

### Valores de Moedas Nao Sao Persistidos

As moedas atualmente sao reaplicadas usando o valor selecionado no painel durante o restore. Isso esta bom por enquanto.

Se o valor da moeda virar dado arbitrario de gameplay, ele deve ser armazenado no comentario do marcador `Jump`:

```text
Jump
{"action":"jump","coinValue":"10"}
```

Se o valor da moeda for derivado de combo/regras do jogo, ele pode ser recalculado como o SFX.

### Carta Plus E Carta Especial Separada

No Card Manager, `Wild` e `Plus` aparecem junto das cartas normais, mas tecnicamente elas nao sao iguais:

- `Wild` usa a mesma fonte do deck selecionado e corresponde ao `Card Option` 14.
- `Plus` usa o item/projeto separado `Plus_Card` e nao pertence a nenhum suit.
- `Plus` nao deve tentar escrever `Card Option` 15, porque o controle Essential Property aceita apenas valores de 1 a 14.
- Ao adicionar ou trocar uma layer para `Plus`, o fluxo deve substituir o source pela comp/item `Plus_Card`, nomear a layer como `Plus` e aplicar label roxo.
- `Plus_Card` e um asset obrigatorio do projeto e nao deve ser renomeado dentro dos assets.

Decisao pendente de produto: documentar melhor o uso criativo/gameplay da `Plus` nos tutoriais quando a regra final de uso estiver definida.

### Jump E de Uso Unico Por Camada

`namedMarkerExists(layer, "Jump")` bloqueia aplicar um segundo Jump na mesma camada. Isso corresponde ao workflow atual, mas deve ser revisto se as regras de gameplay permitirem que uma carta se mova mais de uma vez.

### Progress Bar Exige Assets no Projeto

`Progress_Bar` precisa existir no projeto. A acao deve falhar com uma mensagem clara se a composicao fonte estiver ausente.

## Notas de Performance

### Busca de Itens do Projeto

A busca de itens do projeto atualmente e linear por nome. Em projetos AE grandes, buscas repetidas podem pesar.

Recomendado:

- cachear itens do projeto dentro de uma execucao de acao;
- separar busca por `CompItem`, `FootageItem` e `FolderItem`;
- ao importar footage, comparar caminhos de arquivos fonte quando possivel, nao apenas nomes.

### Quantidade de Variacoes de SFX

A varredura de `jump_sfx_XX.wav` e barata, mas pode ser cacheada por execucao de acao/restore se necessario.

### Biblioteca Externa de Expressoes

A biblioteca externa e uma boa direcao. Ela reduz poluicao de strings em TypeScript e cria um lugar para helpers reutilizaveis de expressoes Superplay.

Proximos candidatos para mover:

- helpers de titulo de marcador;
- helpers de sliders de controle;
- helpers de ordenacao de acoes de jump;
- helpers de trigger dinamico de progress bar.

## Fluxo de Layout

### Apply Layout Substitui Layouts Gerenciados

Aplicar um layout em uma composicao sem origem conhecida cria as camadas do zero. Quando a composicao ja possui metadata de origem de layout, o fluxo remove as camadas de layout gerenciadas antes de aplicar o novo layout.

Comportamento atual:

- se o level ativo e diferente do selecionado, o painel confirma antes de substituir;
- se o level ativo e o mesmo, o apply funciona como atualizacao/substituicao gerenciada;
- aplicar layout em composicoes manuais sem metadata ainda deve ser usado com cuidado.

### Formato de Exportacao de Marcadores E Minimalista

Marcadores sao serializados atualmente como tuplas:

```ts
[time, label, comment]
```

Isso e compacto, mas dados futuros de marcador se beneficiariam de um formato de objeto:

```json
{"time":1.2,"label":9,"comment":"Jump","duration":0}
```

### Configuracao de Layout Fica Oculta na Home do Usuario

O painel de layouts armazena `.cards-layout-config.json` no diretorio home do usuario. Isso funciona, mas o schema e a localizacao do arquivo devem ser documentados para suporte.

## Frontend e UI

### Estilos Globais Estao Duplicados

Alguns estilos globais do painel estao duplicados entre `src/js/index.scss` e arquivos SCSS de componentes. Como esses estilos nao sao CSS modules, estilos de componentes podem afetar o painel inteiro sem intencao.

Recomendacao:

- manter tokens/estilos globais de base em `index.scss`;
- mover estilos especificos de componentes para classes prefixadas por componente;
- evitar seletores globais como `button:disabled` dentro de SCSS de componente.

### Largura do Painel E Artificialmente Restrita

A config CEP permite um painel mais largo, mas `.panel` esta limitado a `250px`. Isso aperta a aba de layouts.

Recomendacao:

```scss
.panel {
  width: min(100%, 520px);
  max-width: none;
}
```

### Estilos Inline Devem Virar Classes

Varios componentes usam estilos inline para layout e cor de botao. Mover isso para classes SCSS tornaria estados de UI mais faceis de manter.

### Opcoes de Moeda Estao Hardcoded

Os valores de moeda atualmente estao hardcoded em `CardPickerPanel`. Uma opcao melhor no longo prazo e deriva-los de `assets/coins-vfx/coin_plus-XX.mov`.

## Assets e Empacotamento

### Icones CEP Estao Ausentes

`cep.config.ts` referencia:

- `./src/assets/light-icon.png`
- `./src/assets/dark-icon.png`

Esses arquivos nao foram encontrados em `src/assets`. Existem apenas icones de UI em `src/js/assets/icons`. Isso nao reintroduz assets pesados no pacote, mas pode afetar o polimento do manifest/painel no host.

### Assets Pesados Nao Sao Mais Distribuidos no Pacote

Os decks, presets, SFX, VFX, progress bar, biblioteca externa de expressoes e projeto `.aepx` foram movidos para fora da extensao. O painel agora usa paths configuraveis para encontrar esses recursos no Shared Drive.

`copyAssets` e `copyZipAssets` estao vazios, entao o build da extensao nao deve carregar a pasta antiga de assets pesados. A revisao de assets distribuiveis esta resolvida no essencial; a Fase 4 deve apenas conferir o pacote final e corrigir os icones CEP ausentes.

### Pastas Operacionais Externas

Estrutura operacional recomendada no Shared Drive:

```text
Cards Gameplay/
  assets/
  levels/
  video-tutorials/
  extension-releases/
```

`assets`, `levels` e `video-tutorials` devem ficar disponiveis offline quando o usuario precisar trabalhar sem internet. `extension-releases` e opcional para uso offline.

## Documentacao

### README Ainda E Boilerplate do Bolt CEP

O README deve virar documentacao de produto para Cards Gameplay:

- instalacao/build/run;
- assets de projeto AE obrigatorios;
- workflow de setup de cartas;
- comportamento de Jump/Flip/Flip Stock;
- regras de reset/restore;
- `Cards Controls`;
- limitacoes conhecidas.

### CHANGELOG Ainda E Boilerplate do Bolt CEP

O changelog deve rastrear mudancas do Cards Gameplay. Bolt CEP pode ser mencionado em notas tecnicas, mas nao deve ser o conteudo principal do changelog.

### Tutorial Precisa Ser Atualizado

`docs/card-animation-tutorials.md` ainda referencia suposicoes antigas baseadas em keyframes. Ele deve ser atualizado para:

- animacao de stock baseada em expressoes;
- `FX Precomp`;
- jump SFX sequencial;
- `Cards Controls`;
- comportamento atual de reset/restore.

## Roadmap Recomendado

### Fase 1

- Corrigir deteccao de tags.
- Adicionar guardas de composicao ativa.
- Tornar restore mais seguro com `try/finally`.
- Validar assets obrigatorios antes de aplicar acoes.
- Manter mensagens voltadas ao usuario em ingles.

### Fase 2

Status: fechada operacionalmente em 2026-05-06.

- Helpers de snapshot/restauracao de tempo e selecao foram adicionados.
- Helpers de parsing/escrita de marcadores foram adicionados em `markers.ts`.
- Busca de itens do projeto passou a usar helpers tipados por `CompItem`, `FootageItem`, `AVItem` e `FolderItem`.
- O helper legado `getItemByName` foi removido.
- Acoes destrutivas principais usam `requireActiveComp`, snapshots e restauracao em `finally`.
- Save de layout le valores base/pre-expression para evitar capturar estado visual animado como layout base.

### Fase 3

Status: concluida em 2026-05-06.

Objetivo: reduzir custo de expressoes de animacao sem perder flexibilidade manual dos markers.

Primeira entrega aplicada:

- `Jump` e `Flip Stock` gravam `actionOrder` no JSON do comentario do marker.
- `restoreCardsAnimation` atualiza `actionOrder` em markers existentes antes de reconstruir a animacao.
- `expPos` usa `actionOrder` quando presente e mantem fallback dinamico para layouts/markers antigos.
- `expProgressBar` permanece dinamico e le os markers `Jump` da comp alvo, sem gravar markers auxiliares no layer do progress bar.
- Apply/Restore foram ajustados para evitar `Undo group mismatch` e reduzir undo de `Layer Reordering`.
- Teste manual com aproximadamente 48 cartas teve performance satisfatoria.

### Fase 4

- Limpar SCSS do frontend e remover globais duplicados.
- Tornar a largura do painel responsiva.
- Mover estilos inline recorrentes para classes SCSS.
- Substituir README/CHANGELOG boilerplate por docs de produto.
- Atualizar `docs/card-animation-tutorials.md` para o fluxo atual.
- Corrigir ou remover referencias de icones CEP ausentes em `cep.config.ts`.
- Conferir o pacote final apenas para garantir que assets pesados continuam fora; a migracao de assets distribuiveis ja esta resolvida no essencial.

## Decisoes Abertas

1. Moedas devem ser derivadas de regras de gameplay ou armazenadas por marcador?
2. Uma carta pode ter mais de um `Jump` no futuro, ou o fluxo segue com um `Jump` por camada?
3. Valores de moeda devem continuar hardcoded no painel ou ser derivados dinamicamente de `assets/coins-vfx`?

## Decisoes Fechadas

1. `FX Precomp` e de posse exclusiva da ferramenta.
2. `Cards Controls` e criada/garantida automaticamente pelos fluxos que precisam dela.
3. Layouts gerenciados podem ser substituidos pelo Apply/Save com confirmacoes quando ha risco de sobrescrever outro level.
4. Compatibilidade ExtendScript: o codigo do lado AE deve continuar validado com typecheck ES5 e evitar APIs modernas arriscadas em `src/jsx/aeft`, a menos que a transpilacao/runtime tenha sido verificada. Expressoes do AE podem seguir o motor moderno de expressions quando necessario.

## Conclusao

O projeto ja passou pela consolidacao tecnica mais critica: seguranca de restore/reset, paths externos, metadata de layout, `Cards Controls` automatico, `actionOrder` para animacoes e fluxo de undo mais estavel.

A Fase 4 deve ser tratada como fase de produto e acabamento: limpar UI/CSS, atualizar documentacao, corrigir icones CEP e conferir o pacote final. A revisao de assets pesados nao deve virar uma nova migracao, porque esse ponto ja foi resolvido com assets externos e `copyAssets: []`.
