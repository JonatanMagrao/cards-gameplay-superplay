# Revisao Tecnica do Cards Gameplay

Data da revisao: 2026-04-26

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

Estes checks passaram durante a revisao:

- `yarn -s tsc -p src/jsx/aeft/tsconfig.json --noEmit --target ES5`
- `yarn -s tsc -p tsconfig-build.json --noEmit`
- varredura do lado ExtendScript para APIs modernas de JS arriscadas em `src/jsx/aeft`
- check de sintaxe para `src/assets/expressions/superplay-expression-lib.jsx`

Observacao: `--target ES5` e necessario atualmente porque o TypeScript 5 nao aceita mais `target: "es3"` no `tsconfig`.

## Mapa do Projeto

- `src/js/main`: UI do painel CEP em React.
- `src/jsx/aeft`: acoes do After Effects, helpers e entrypoints de `evalTS`.
- `src/jsx/utils/expressions.ts`: strings de expressoes aplicadas nas propriedades das camadas.
- `src/assets/expressions/superplay-expression-lib.jsx`: biblioteca externa de expressoes carregada com `footage(...).sourceData`.
- `src/assets`: decks, presets, coin VFX, SFX, assets de progress bar e o projeto fonte `.aepx`.
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

Status em 2026-04-26:

- Fase 1 aplicada: checks de tags sem estado, guardas de composicao ativa, restore transacional e mensagens voltadas ao usuario em ingles.
- Fase 2 iniciada: helpers reutilizaveis de snapshot de composicao/selecao, helpers de marcador, lookups tipados de itens do projeto e save de layout lendo valores base/pre-expression.

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

Decisao necessaria: `FX Precomp` pertence exclusivamente a ferramenta, ou usuarios podem edita-la manualmente?

### Valores de Moedas Nao Sao Persistidos

As moedas atualmente sao reaplicadas usando o valor selecionado no painel durante o restore. Isso esta bom por enquanto.

Se o valor da moeda virar dado arbitrario de gameplay, ele deve ser armazenado no comentario do marcador `Jump`:

```text
Jump
{"action":"jump","coinValue":"10"}
```

Se o valor da moeda for derivado de combo/regras do jogo, ele pode ser recalculado como o SFX.

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
- helpers de trigger de progress bar.

## Fluxo de Layout

### Apply Layout Nao Limpa Cartas Existentes

Aplicar um layout atualmente adiciona camadas de carta. Isso e flexivel, mas aplicar duas vezes pode duplicar um layout.

Opcoes possiveis de UX:

- `Apply Layout`
- `Replace Current Layout`
- avisar se a composicao ativa ja contem camadas de carta tagueadas.

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

Esses arquivos nao foram encontrados em `src/assets`. Isso pode afetar o polimento de pacote/manifest.

### Arquivo de Auto-Save Nao Deve Ser Distribuido

`src/assets/Adobe After Effects Auto-Save/disney_solitaire_cards auto-save 1.aepx` e grande e provavelmente nao deve ser copiado para builds.

Como `copyAssets: ["assets"]` copia a pasta inteira de assets, isso deve ser excluido ou movido para fora dos assets distribuiveis.

### Assets AEPX e MOV Sao Grandes

O projeto inclui um `.aepx` grande e varios arquivos `.mov`. Isso pode ser necessario, mas deve ser intencional e documentado.

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

- Consolidar helpers de AE por responsabilidade.
- Criar helpers de parsing/escrita de marcadores.
- Tipar busca de itens do projeto pelo tipo esperado.
- Adicionar helpers de snapshot de selecao em todos os lugares onde acoes mutam camadas.

### Fase 3

- Medir performance de expressoes em composicoes grandes.
- Mover mais helpers de expressao para a biblioteca externa.
- Considerar dados gerados de timeline de acoes se as varreduras dinamicas ficarem lentas.

### Fase 4

- Limpar SCSS do frontend e remover globais duplicados.
- Tornar a largura do painel responsiva.
- Substituir README/CHANGELOG boilerplate por docs de produto.
- Revisar assets distribuiveis e tamanho de pacote.

## Decisoes Abertas

1. Moedas devem ser derivadas de regras de gameplay ou armazenadas por marcador?
2. `FX Precomp` e de posse exclusiva da ferramenta?
3. `Cards Controls` deve ser criada automaticamente?
4. Aplicar layout deve anexar ou substituir por padrao?
5. Quao rigorosa deve ser a compatibilidade ExtendScript no codigo fonte versus output transpilado?

## Conclusao

O projeto esta caminhando em uma direcao solida. O proximo passo mais valioso e tornar a fundacao atual mais segura: checks de tags sem estado, validacao explicita de composicao, restore transacional e mensagens claras em ingles voltadas ao usuario. Depois disso, consolidar utilidades de AE vai reduzir a chance de bugs futuros e tornar novas funcionalidades de gameplay muito mais faceis de adicionar.
