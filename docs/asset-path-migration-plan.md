# Asset Path Migration Plan

Status: implementado. Mantido como registro da migracao e referencia para suporte.

## Objetivo

Migrar os assets de runtime do app para uma pasta externa configurada por usuario, sem fallback para os assets empacotados na extensao.

O usuario configurara apenas um entrypoint, como `H:\Drives compartilhados` ou `G:\Drives compartilhados`. A aplicacao somara esse entrypoint com o path padrao abaixo:

```txt
Creative_Marketing_Assets\GENERAL-ASSETS\Plugins\Cards Gameplay\assets
```

Exemplo de asset root final:

```txt
H:\Drives compartilhados\Creative_Marketing_Assets\GENERAL-ASSETS\Plugins\Cards Gameplay\assets
```

Quando o entrypoint nao estiver configurado, qualquer acao que dependa de assets deve avisar o usuario com um alert do ExtendScript em ingles e interromper a acao.

## Estado anterior da migracao

Antes da migracao, os assets eram resolvidos a partir da propria extensao:

```ts
`${csi.getSystemPath("extension")}/assets`
```

Pontos principais:

- `src/js/main/main.tsx`: monta `cardProject` e `cardsControlPresetPath`.
- `src/js/main/components/ActionsPanel/ActionsPanel.tsx`: monta presets, expression lib, projeto AEPX, SFX e coin VFX.
- `src/js/main/components/CardPickerPanel/CardPickerPanel.tsx`: monta preview de cartas e icone de moeda.
- `src/jsx/aeft/aeft.ts`: `getCardsControlPresetPath` deriva o preset control procurando o token `/assets/`.

A implementacao atual centraliza a resolucao em `src/js/main/assetPaths.ts`, usa paths configuraveis e mantem `copyAssets: []` em `cep.config.ts`.

## Configuracao

Adicionar uma nova chave ao arquivo de configuracao:

```txt
%LOCALAPPDATA%/Cards Gameplay/config.json
```

Nova chave:

```json
{
  "assetEntryPoint": "H:/Drives compartilhados"
}
```

Nao armazenar o asset root final como configuracao principal. Ele deve ser calculado em runtime a partir de:

```txt
assetEntryPoint + Creative_Marketing_Assets/GENERAL-ASSETS/Plugins/Cards Gameplay/assets
```

Usar paths normalizados com `/` internamente, mantendo a compatibilidade com Windows.

## UI

Reaproveitar o padrao atual do modal de settings em `LayoutsPanel`.

Adicionar uma secao ou linha de configuracao para assets:

- Label: `Assets Path`
- Botao: `Set` quando nao houver entrypoint.
- Botao: `Change` quando ja houver entrypoint.
- Botao opcional: `Open`, habilitado somente quando o asset root calculado existir.

O botao `Set`/`Change` deve usar `window.cep.fs.showOpenDialogEx(false, true, ...)`, igual aos handlers atuais de Folder Path e Cache Path.

Ao selecionar uma pasta:

1. Normalizar o path escolhido.
2. Salvar em `assetEntryPoint`.
3. Calcular o asset root final.
4. Validar a estrutura.
5. Se faltar algo, alertar em ingles com lista exata.
6. Se estiver tudo ok, manter o valor salvo e atualizar o estado da UI.

## Resolucao de paths

Criar um helper compartilhado no lado React, por exemplo:

```txt
src/js/main/assetPaths.ts
```

Responsabilidades:

- Definir `DEFAULT_ASSETS_RELATIVE_PATH`.
- Ler `assetEntryPoint` do config.
- Calcular `assetRoot`.
- Montar paths absolutos:
  - `cardProject`
  - `cardsControlPresetPath`
  - `cardsPresetPath`
  - `progressBarPresetPath`
  - `expressionLibPath`
  - `sfxFolderPath`
  - `coinsVfxFolderPath`
  - `coinPath`
  - `cardsDeckPath`
  - `coinIconPath`

Evitar chamadas diretas a `csi.getSystemPath("extension")/assets` em componentes de produto.

## Validacao obrigatoria

Validar pastas obrigatorias:

```txt
presets
expressions
progress-bar
cards-deck
cards-deck/Club_Deck
cards-deck/Diamond_Deck
cards-deck/Heart_Deck
cards-deck/Spade_Deck
coins-vfx
sfx
ui-assets
```

Validar arquivos obrigatorios:

```txt
disney_solitaire_cards.aepx
presets/cards-gameplay-control.ffx
presets/cards_gameplay_superplay.ffx
presets/cards_gameplay_progressbar.ffx
expressions/superplay-expression-lib.jsx
progress-bar/bluebar.png
progress-bar/frame_progress-bar.png
progress-bar/progress-bar-bubble.png
progress-bar/star_progress-bar.png
cards-deck/card_back.png
cards-deck/alpha.png
cards-deck/plus_card.png
cards-deck/wild_card.png
ui-assets/disney_coin.png
coins-vfx/coin_plus-02.mov
coins-vfx/coin_plus-04.mov
coins-vfx/coin_plus-06.mov
coins-vfx/coin_plus-08.mov
coins-vfx/coin_plus-10.mov
coins-vfx/coin_plus-15.mov
coins-vfx/coin_plus-20.mov
coins-vfx/coin_plus-25.mov
sfx/flip-stock_sfx_01.wav
sfx/jump_sfx_01.wav
sfx/jump_sfx_02.wav
sfx/jump_sfx_03.wav
sfx/jump_sfx_04.wav
sfx/jump_sfx_05.wav
sfx/jump_sfx_06.wav
sfx/jump_sfx_07.wav
sfx/jump_sfx_08.wav
sfx/jump_sfx_09.wav
sfx/jump_sfx_10.wav
sfx/jump_sfx_11.wav
sfx/jump_sfx_12.wav
sfx/jump_sfx_13.wav
sfx/jump_sfx_14.wav
```

Para cartas, validar todos os nomes esperados por suit:

```txt
cards-deck/Club_Deck/DS-Cards_2_Club.png
cards-deck/Club_Deck/DS-Cards_3_Club.png
...
cards-deck/Club_Deck/DS-Cards_Q_Club.png
```

Repetir para:

- `Diamond_Deck` com sufixo `Diamond`
- `Heart_Deck` com sufixo `Heart`
- `Spade_Deck` com sufixo `Spade`

Ranks obrigatorios:

```txt
2, 3, 4, 5, 6, 7, 8, 9, 10, A, J, K, Q
```

Para SFX de jump, validar todos os arquivos atuais de `jump_sfx_01.wav` ate `jump_sfx_14.wav`, mantendo o scan dinamico existente apenas para escolher a variacao em runtime.

## Mensagens de erro

Todas as mensagens de runtime sobre asset path devem sair via alert do ExtendScript, em ingles.

Sem entrypoint configurado:

```txt
Assets path is not configured.

Open Settings and choose the shared drive entry point before using this action.

Expected relative path:
Creative_Marketing_Assets/GENERAL-ASSETS/Plugins/Cards Gameplay/assets
```

Asset root calculado nao existe:

```txt
Assets folder was not found.

Configured entry point:
H:/Drives compartilhados

Expected assets folder:
H:/Drives compartilhados/Creative_Marketing_Assets/GENERAL-ASSETS/Plugins/Cards Gameplay/assets
```

Itens faltando:

```txt
Assets validation failed.

Missing required items:
- presets/cards_gameplay_superplay.ffx
- expressions/superplay-expression-lib.jsx
- cards-deck/Club_Deck/DS-Cards_2_Club.png

Configured entry point:
H:/Drives compartilhados

Expected assets folder:
H:/Drives compartilhados/Creative_Marketing_Assets/GENERAL-ASSETS/Plugins/Cards Gameplay/assets
```

## Fluxo de bloqueio

Antes de executar qualquer acao que dependa de assets:

1. Ler `assetEntryPoint`.
2. Se vazio, chamar `handleShowAlert` com a mensagem de entrypoint ausente e parar.
3. Calcular `assetRoot`.
4. Validar pasta e arquivos obrigatorios.
5. Se invalidos, chamar `handleShowAlert` com a lista exata de faltantes e parar.
6. Se validos, executar a acao com paths externos.

Isso deve cobrir:

- Add Card
- Change Card
- Import Files and Comps
- Apply Jump
- Flip Stock Cards
- Restore Cards Animation
- Add Progress Bar
- Duplicate Cards
- Apply Layout
- Previews do Card Picker

Para previews do React, quando o asset path estiver invalido, a UI pode mostrar preview vazio, mas a causa principal deve aparecer no alert ao tentar executar uma acao ou ao validar no settings.

## Ajustes no ExtendScript

Alterar `getAssetPath`/`getCardsControlPresetPath` em `src/jsx/aeft/aeft.ts`.

Problema atual:

- Ele procura `/assets/` no path recebido.
- Com asset root externo, isso so funciona se a pasta final se chamar exatamente `assets`.
- Mesmo funcionando nesse caso, a regra fica fragil.

Opcao recomendada:

- Parar de derivar `cards-gameplay-control.ffx` dentro do JSX.
- Passar `controlPresetPath` explicitamente do React para cada handler que precisa dele.

Handlers a revisar:

- `handleApplyCardsLayout`
- `handleApplyJump`
- `handleFlipStockCards`
- `handleAddCard`
- `handleRestoreCardsAnimation`

Enquanto a migracao estiver em andamento, manter uma funcao auxiliar apenas como compatibilidade interna, mas nao depender dela para novos fluxos.

## Remocao do fallback

Depois que todos os fluxos usarem o asset root externo:

1. Remover usos de `csi.getSystemPath("extension")/assets` para assets de produto.
2. Remover `copyAssets: ["assets"]` de `cep.config.ts`.
3. Manter assets de UI importados pelo bundle somente se forem realmente parte da interface da extensao, como icones SVG dos botoes.
4. Remover `src/assets` do pacote quando nenhum fluxo depender mais dele.

## Ordem de implementacao sugerida

1. Criar helper de config/assets no React.
2. Criar validador de assets com lista de pastas e arquivos obrigatorios.
3. Adicionar UI de `Assets Path` no settings modal.
4. Substituir paths em `main.tsx`, `ActionsPanel.tsx` e `CardPickerPanel.tsx`.
5. Passar `controlPresetPath` explicitamente para handlers do JSX.
6. Ajustar `aeft.ts` para remover derivacao baseada em `/assets/`.
7. Adicionar alerts em ingles para entrypoint ausente e assets faltando.
8. Testar todos os fluxos principais com entrypoint valido.
9. Testar entrypoint vazio, drive errado e arquivos faltando.
10. Remover assets empacotados e `copyAssets`.

## Testes manuais

Validar estes cenarios:

- Sem `assetEntryPoint`: qualquer acao de assets mostra alert claro.
- `assetEntryPoint` apontando para drive errado: alert mostra o asset root esperado.
- Pasta existe, mas falta um arquivo: alert lista exatamente o arquivo.
- Card Picker carrega preview de carta e icone de moeda a partir do asset root externo.
- Add Card importa `disney_solitaire_cards.aepx` externo.
- Apply Jump usa preset, coin VFX e SFX externos.
- Flip Stock usa expression lib e SFX externos.
- Add Progress Bar usa preset e imagens do projeto importado externo.
- Apply Layout cria controles usando `cards-gameplay-control.ffx` externo.
- Build/package final nao copia `src/assets` para a extensao.
