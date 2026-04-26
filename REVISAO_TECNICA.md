# Revisão técnica do projeto Cards Gameplay

Data da revisão: 2026-04-26

Este documento resume uma revisão ampla do projeto com foco em arquitetura, performance, layouts, manutenção e riscos de bugs. A análise considera o estado atual do painel CEP/React, os scripts ExtendScript/After Effects, as expressões, os assets e o fluxo de layout/reset/restore.

## Resumo executivo

O projeto já tem uma base funcional forte: o fluxo de cartas, marcadores, expressões externas, `FX Precomp`, SFX sequencial e layouts está caminhando para uma arquitetura bem mais robusta do que uma automação puramente baseada em keyframes.

Os maiores ganhos agora não estão em adicionar features, mas em consolidar fundações:

1. Separar melhor regras de domínio, integração AE e detalhes de UI.
2. Reduzir custo das expressões que varrem a comp inteira a cada frame.
3. Padronizar utilitários ExtendScript para evitar bugs pequenos e repetidos.
4. Tornar reset/restore mais transacionais, com `try/finally` e validações explícitas.
5. Limpar boilerplate, assets e estilos globais herdados.

## Validações executadas

Passei pelos checks atuais com sucesso:

- `yarn -s tsc -p src/jsx/aeft/tsconfig.json --noEmit --target ES5`
- `yarn -s tsc -p tsconfig-build.json --noEmit`
- varredura por métodos modernos perigosos no lado `src/jsx/aeft`
- parse da lib de expressões `src/assets/expressions/superplay-expression-lib.jsx`

Observação: o `--target ES5` é um workaround porque o TypeScript 5 não aceita mais `target: "es3"` nos tsconfigs de JSX/ExtendScript.

## Mapa rápido da arquitetura

- `src/js/main`: painel CEP em React.
- `src/jsx/aeft`: ações do After Effects, helpers e entrypoints chamados por `evalTS`.
- `src/jsx/utils/expressions.ts`: strings de expressão aplicadas nas propriedades.
- `src/assets/expressions/superplay-expression-lib.jsx`: biblioteca externa consumida via `footage(...).sourceData`.
- `src/assets`: decks, presets, coins, SFX, progress bar, projeto `.aepx`.
- `docs/card-animation-tutorials.md`: documentação/tutorial de uso, ainda com alguns textos antigos.
- `README.md` e `CHANGELOG.md`: ainda são majoritariamente boilerplate do Bolt CEP.

## Prioridade alta

### 1. Corrigir uso de RegExp global em validações de tags

Há alguns lugares usando regex com flag `g` para testar nomes de layers em loop, por exemplo:

- `src/jsx/aeft/cards-utils.ts:23`
- `src/jsx/aeft/cards-utils.ts:58`
- `src/jsx/aeft/cards-utils.ts:196`
- `src/jsx/aeft/actions.ts:977`

Em JavaScript, regex com `g` guarda `lastIndex`. Quando a mesma regex é reutilizada em várias strings, ela pode falhar de forma intermitente. Isso pode afetar detecção de `[TARGET]`, `[STOCK]` e `[TABLEAU]`.

Recomendação: remover o `g` de regex usadas apenas para `test`/`exec`, ou substituir por uma função simples `layerHasTag(layer, tag)`.

### 2. Tornar `restoreCardsAnimation` transacional

Hoje o restore muda o tempo da comp (`thisComp.time = 0`, depois muda para tempos de markers) e só restaura no final:

- `src/jsx/aeft/actions.ts:1073`

Se ocorrer erro no meio, a comp pode ficar em outro tempo, seleção alterada ou FX parcialmente recriado.

Recomendação: envolver o corpo principal em `try/finally`:

- guardar `currentTime`
- guardar seleção original
- fazer restore
- no `finally`, restaurar tempo e seleção

Também vale validar Target antes de processar `Jump`/`Flip Stock`. Hoje `setJumpTargetLayer` assume que o target existe.

### 3. Consolidar utilitários AE

Há duas famílias de helpers:

- `src/jsx/aeft/aeft-utils.ts`
- `src/jsx/aeft/aeft-utils-jonatan.ts`

Elas têm responsabilidades sobrepostas: iterar layers, buscar project items, ler JSON, buscar propriedades, limpar expressões. Isso aumenta chance de divergência.

Exemplos:

- `getItemByName` só retorna `CompItem`, mas o nome sugere algo genérico.
- `getFootageByName` declara `CompItem | null`, mas retorna `FootageItem` com `@ts-ignore`.
- `forEachSelectedLayer` varre layers vivas da comp; se uma ação adiciona layers durante o loop, pode ter comportamento inesperado.

Recomendação: criar uma estrutura menor e explícita:

- `ae-comp.ts`: active comp, layer iteration, selection snapshots
- `ae-project.ts`: busca/import por nome, tipo e path
- `ae-props.ts`: property paths, safe setters, expressions
- `markers.ts`: leitura/escrita/parse de markers

### 4. Reduzir custo das expressões que varrem a comp inteira

As expressões atuais funcionam, mas algumas fazem varreduras globais por frame:

- `src/jsx/utils/expressions.ts:58` calcula ordem de ações varrendo layers/markers.
- `src/assets/expressions/superplay-expression-lib.jsx:295` faz o mesmo para stock.
- `src/assets/expressions/superplay-expression-lib.jsx:355` calcula offset de stock olhando layers acima.
- `src/jsx/utils/expressions.ts:264` busca triggers do progress bar varrendo layers.

Isso escala mal em comp grande: custo por frame vezes número de cards com expressão.

Recomendação incremental:

1. Manter a lógica dinâmica por enquanto.
2. Medir em uma comp pesada.
3. Se ficar lento, gerar dados auxiliares em marker/comment de uma layer de controle no `restore`, como lista de ações ordenadas, tempos e ordens.
4. Para progress bar, considerar criar markers dedicados na própria progress layer em vez de varrer todos os cards a cada frame.

### 5. Resolver o `target: "es3"` nos tsconfigs

Arquivos:

- `src/jsx/tsconfig.json`
- `src/jsx/aeft/tsconfig.json`

O TypeScript 5 não aceita mais `ES3`. Hoje o check precisa de override manual `--target ES5`.

Recomendação:

- trocar o target de typecheck para `ES5`
- manter a compatibilidade ExtendScript via Babel/Rollup/ponyfill
- adicionar um script oficial, por exemplo `typecheck:jsx`
- manter uma varredura automática contra APIs que o ExtendScript não suporta (`map`, `filter`, `includes`, `indexOf`, etc. nos arquivos `src/jsx/aeft`)

## Bugs e riscos funcionais

### Reset e FX Precomp

`clearFxPrecompLayers` limpa tudo dentro da `FX Precomp`:

- `src/jsx/aeft/actions.ts:312`

Isso está alinhado com a premissa atual, mas é destrutivo para qualquer layer manual colocada ali. Se a `FX Precomp` virar um espaço editável por usuário, a limpeza precisa filtrar apenas layers geradas pela ferramenta.

### Coins ainda não têm identidade persistente

No restore, coins são recriados usando o valor atual selecionado no painel, não um valor salvo no marker. Isso está ok por enquanto, mas é uma decisão importante:

- se moeda seguir regra derivável, recalcular como SFX;
- se moeda for arbitrária/gameplay externo, salvar no marker de `Jump`.

Formato futuro possível:

```text
Jump
{"action":"jump","coinValue":"10"}
```

### `namedMarkerExists` bloqueia segundo Jump na mesma layer

`applyJumpOnSelectedlayers` ignora qualquer layer que já tenha marker `Jump`.

Isso é coerente com o tutorial atual, mas vira limitação se um mesmo card puder pular mais de uma vez. Se esse cenário surgir, a validação deveria ser por tempo ou por marker específico, não por existência global na layer.

### `getActiveComp` pode retornar algo inválido como `CompItem`

`src/jsx/aeft/aeft-utils.ts:49` tenta ativar o viewer e depois faz cast para `CompItem`. Se não houver comp ativa, várias ações podem quebrar mais adiante com erro pouco claro.

Recomendação: criar `requireActiveComp(actionName)` que valida e alerta/retorna `null` de forma padronizada.

### Progress bar assume assets existentes

`src/jsx/aeft/progressBar-utils.ts:74` assume que `Progress_Bar` existe no projeto. Se não existir, a ação quebra.

Recomendação: validar `Progress_Bar` e orientar o usuário a importar os assets antes.

### Expressões de Jump usam nomes de efeito inconsistentes

Em `src/jsx/utils/expressions.ts`, `expPos` usa `effect("Cards Gameplay Superplay")`, enquanto `expScale` e `expRot` usam `effect("Pseudo/cards_gameplay_superplay")`.

Se AE resolver nomes de forma diferente em algum cenário/localização, isso pode virar bug intermitente.

Recomendação: padronizar para a forma que realmente funciona no AE final, idealmente display name estável do preset.

## Performance

### SFX sequencial pode cachear contagem por execução

`getJumpSfxVariationCount` escaneia `jump_sfx_01.wav`, `02`, etc.:

- `src/jsx/aeft/actions.ts:219`

É barato, mas hoje pode rodar várias vezes na mesma ação/restore. Dá para calcular uma vez por chamada e passar o valor para `applyJumpSfx`.

### Busca de Project Items por nome é linear

Funções como `findProjectItemByName` varrem todos os itens do projeto:

- `src/jsx/aeft/aeft-utils.ts:71`

Em projetos grandes, isso pesa. Já existe cache para decks em `game-levels-utils.ts`, mas não para todos os assets.

Recomendação:

- cache por nome+tipo durante uma ação;
- invalidar cache em import;
- separar busca de `CompItem`, `FootageItem`, `FolderItem`.

### Import/reuse de footage usa apenas nome do arquivo

`ensureFootageItem` reusa item pelo nome:

- `src/jsx/aeft/actions.ts:244`

Se existirem dois assets com mesmo nome em paths diferentes, ele pode pegar o errado.

Recomendação: quando possível, comparar também `File.fsName` do source.

### Expressões externas são um bom caminho

Mover `stockPosition`/`stockFlip` para `superplay-expression-lib.jsx` foi uma decisão boa:

- reduz strings gigantes em TS;
- abre caminho para uma biblioteca de expressões Superplay;
- facilita versionar helpers de easing.

O próximo passo natural é mover helpers repetidos de `expPos`, `expScale`, `expRot` para essa biblioteca ou para uma segunda lib de expressão.

## Layouts

### Apply Layout adiciona sem limpar

`applyCardsLayoutFromObject` cria as layers do layout sem limpar cards existentes:

- `src/jsx/aeft/game-levels-utils.ts:139`

Isso é flexível, mas pode gerar duplicatas se o usuário aplicar o mesmo layout duas vezes.

Recomendação: adicionar opção explícita:

- `Apply`
- `Replace Current Layout`

Ou alertar quando já existem cards na comp.

### Layout não salva duração de markers

Hoje markers são exportados como:

```ts
markers: [number, number, string][]
```

Isso salva tempo, label e comment, mas não duração. Se no futuro marker duration for usado como dado, o layout antigo não preserva.

Recomendação: migrar para objeto:

```json
{"time": 1.2, "label": 9, "comment": "Jump", "duration": 0}
```

### Layout não salva moeda por Jump

Mesmo ponto dos coins: se moeda virar dado arbitrário, ela precisa estar no marker/comment para sobreviver a save/apply/restore.

### Path de layouts usa configuração em arquivo no home

`src/js/main/components/LayoutsPanel/LayoutsPanel.tsx:9` grava `.cards-layout-config.json` no home do usuário.

Isso funciona, mas seria bom versionar o schema e documentar o arquivo, porque vira estado invisível para suporte.

## Frontend e UX

### Estilos globais duplicados

Há `.panel`, `.panel-title`, `.panel-section` tanto em:

- `src/js/index.scss:40`
- `src/js/main/components/CardPickerPanel/CardPickerPanel.scss:4`

Como o CSS não é modular, um componente pode sobrescrever outro. `LayoutsPanel.scss` também define `button:disabled` global:

- `src/js/main/components/LayoutsPanel/LayoutsPanel.scss:104`

Recomendação:

- deixar tokens e base global em `index.scss`;
- mover estilos específicos para classes com prefixo de componente;
- evitar seletores globais dentro de SCSS de componente.

### Painel limitado a 250px apesar da config maior

`cep.config.ts` define painel com largura maior, mas CSS limita `.panel` a `max-width: 250px`.

Arquivos:

- `src/js/index.scss:50`
- `src/js/main/components/CardPickerPanel/CardPickerPanel.scss:10`

Isso deixa o painel apertado, especialmente na aba Layouts.

Recomendação: usar largura fluida:

```scss
.panel {
  width: min(100%, 520px);
  max-width: none;
}
```

### Muitos estilos inline

Exemplos:

- `src/js/main/components/ActionsPanel/ActionsPanel.tsx`
- `src/js/main/components/LayoutsPanel/LayoutsPanel.tsx`
- `src/js/main/components/CardPickerPanel/CardPickerPanel.tsx`
- `src/js/main/components/ErrorLogModal/ErrorLogModal.tsx`

Recomendação: migrar para classes. Isso melhora manutenção visual, estados hover/disabled e consistência.

### Coin options hardcoded

`src/js/main/components/CardPickerPanel/CardPickerPanel.tsx:124`

Hoje as opções de moeda são fixas:

```ts
["02", "04", "06", "08", "10", "15", "20", "25"]
```

Recomendação: derivar de `assets/coins-vfx/coin_plus-XX.mov`, ou pelo menos centralizar em uma configuração.

### Abrir pasta via shell command

`LayoutsPanel.tsx:241` monta string para `child_process.exec`.

Como o path vem de seleção do usuário, o risco é baixo, mas ainda existe risco com aspas/caracteres especiais.

Recomendação: usar alternativa mais segura, como `execFile`/`spawn` com argumentos, ou `csi.openURLInDefaultBrowser` com URL `file:///`.

## Assets e empacotamento

### Ícones do CEP parecem ausentes

`cep.config.ts` referencia:

- `./src/assets/light-icon.png`
- `./src/assets/dark-icon.png`

Mas esses arquivos não aparecem em `src/assets`. Isso pode afetar manifest/packaging.

### Auto-save está dentro de assets

Existe:

- `src/assets/Adobe After Effects Auto-Save/disney_solitaire_cards auto-save 1.aepx`

Como `cep.config.ts` usa `copyAssets: ["assets"]`, essa pasta tende a ir para o build/package. O auto-save tem cerca de 21 MB e provavelmente não deveria ser distribuído.

### Projeto AEPX é grande

`src/assets/disney_solitaire_cards.aepx` tem cerca de 35 MB. Isso pode ser necessário, mas impacta build/package. Vale revisar se assets redundantes estão embutidos.

## Documentação

### README ainda é boilerplate

`README.md` ainda descreve Bolt CEP genericamente. Para uso interno, ele deveria explicar:

- como instalar/rodar o painel;
- como importar assets;
- fluxo recomendado: Set Target/Stock/Tableau, Jump, Flip Stock, Reset, Restore;
- como funcionam `Cards Controls`;
- quais nomes de layers/precomps/assets são contratos do sistema;
- como validar build/typecheck.

### CHANGELOG ainda é do Bolt CEP

`CHANGELOG.md` também é boilerplate. Recomendo separar:

- `CHANGELOG.md` do produto Cards Gameplay;
- referência ao Bolt CEP apenas em uma seção técnica.

### Tutorial está útil, mas desatualizado em pontos recentes

`docs/card-animation-tutorials.md` ainda fala em keyframes como padrão principal. Depois da migração para expressões, FX Precomp e SFX sequencial, vale atualizar.

## Código legado/removível

Candidatos a revisão/remoção:

- `src/jsx/utils/samples.ts`
- `src/js/main/components/ErrorLogModal/ErrorLogModal.tsx`, se não for usado
- assets de exemplo do Bolt em `src/js/assets`
- helpers não usados em `aeft-utils.ts` e `aeft-utils-jonatan.ts`
- comentários temporários como `NOVO`, `CORREÇÃO AQUI`, TODOs antigos

Antes de remover, confirmar se algum arquivo é referenciado pelo template/build do Bolt.

## Roadmap recomendado

### Fase 1: segurança e bugs pequenos

1. Remover regex global em tag checks.
2. Adicionar `requireActiveComp`.
3. Colocar `restoreCardsAnimation` em `try/finally`.
4. Validar target antes de restore com Jump/Flip Stock.
5. Validar existência de `Progress_Bar`, expression lib e assets de SFX/VFX com mensagens melhores.

### Fase 2: arquitetura AE

1. Consolidar utilitários em módulos por responsabilidade.
2. Criar snapshots padronizados para selected layers.
3. Tipar melhor ProjectItem/CompItem/FootageItem.
4. Centralizar leitura/escrita de markers e dados JSON.
5. Definir contrato formal para markers: primeira linha é ação, linhas seguintes são dados.

### Fase 3: performance de expressões

1. Medir comp grande com várias cartas.
2. Cachear/gerar dados auxiliares em control layer se necessário.
3. Mover helpers repetidos de expressões para a lib externa.
4. Reduzir varreduras globais no progress bar.

### Fase 4: frontend/layout

1. Remover duplicação de SCSS global.
2. Tornar painel responsivo à largura real do CEP.
3. Centralizar caminhos e opções de assets.
4. Trocar alerts críticos por UI de status/modal quando fizer sentido.
5. Atualizar docs e README do produto.

## Decisões pendentes

1. Coins serão regra derivada ou dado arbitrário salvo em marker?
2. `FX Precomp` é exclusivamente gerenciada pela ferramenta ou pode receber edição manual?
3. `Cards Controls` será criada automaticamente pelo script ou sempre manual/pseudo effect?
4. Layout apply deve sempre somar layers ou deve ter modo replace?
5. Queremos priorizar compatibilidade ExtendScript máxima ou aceitar alguns recursos por transpile/ponyfill?

## Conclusão

O projeto está em um bom ponto para crescer: as decisões recentes de expressões externas, controle global por sliders, reset/restore e FX Precomp apontam na direção certa. O maior risco agora é a complexidade ficar espalhada entre `actions.ts`, helpers duplicados e expressões com varreduras globais.

Minha recomendação é fazer primeiro as correções pequenas de segurança e previsibilidade, depois consolidar os helpers AE. Isso deve reduzir bugs sem travar a evolução das features.
