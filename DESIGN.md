---
name: SAL · Alocações
description: Ferramenta semanal de rateio de horas — precisão de ferramenta, identidade de agência brasileira
colors:
  laranja-salgado: "#e8614a"
  laranja-profundo: "#c0391f"
  superficie-fria: "#f5f5f7"
  branco-morno: "#fafaf8"
  tinta: "#1d1d1f"
  cinza-medio: "#6e6e73"
  cinza-suave: "#aeaeb2"
  borda-sutil: "#d2d2d7"
  borda-clara: "#e8e8ed"
  fundo-alternativo: "#f2f2f4"
  verde-fechado: "#34c759"
  verde-texto: "#1a7a34"
  amarelo-pendente: "#ff9500"
  amarelo-texto: "#9a5900"
  vermelho-critico: "#ff3b30"
  azul-parcial: "#0071e3"
  azul-texto: "#003d99"
typography:
  display:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontStyle: "normal"
  display-italic:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontStyle: "italic"
  headline:
    fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "22px"
  full: "100px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.laranja-salgado}"
    textColor: "oklch(99% 0.004 40)"
    rounded: "{rounded.full}"
    padding: "11px 24px"
  button-primary-hover:
    backgroundColor: "{colors.laranja-profundo}"
    textColor: "oklch(99% 0.004 40)"
    rounded: "{rounded.full}"
    padding: "11px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cinza-medio}"
    rounded: "{rounded.xs}"
    padding: "10px 8px"
  nav-tab-active:
    backgroundColor: "{colors.branco-morno}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  nav-tab-default:
    backgroundColor: "transparent"
    textColor: "{colors.cinza-medio}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  status-fechado:
    backgroundColor: "rgba(52,199,89,.08)"
    textColor: "{colors.verde-texto}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  status-parcial:
    backgroundColor: "rgba(0,113,227,.08)"
    textColor: "{colors.azul-texto}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  status-pendente:
    backgroundColor: "rgba(255,149,0,.1)"
    textColor: "{colors.amarelo-texto}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  status-excedido:
    backgroundColor: "rgba(232,97,74,.08)"
    textColor: "{colors.laranja-profundo}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  person-card:
    backgroundColor: "{colors.branco-morno}"
    rounded: "{rounded.md}"
    padding: "0"
  kpi-cell:
    backgroundColor: "{colors.branco-morno}"
    textColor: "{colors.tinta}"
    padding: "20px 18px"
---

# Design System: SAL · Alocações

## 1. Overview

**Creative North Star: "Precision Made in Brazil"**

SAL Alocações opera na intersecção entre ferramenta de produtividade e identidade de agência criativa brasileira. A precisão de ferramentas como Linear ou Figma — densidade de dados, hierarquia clara, resposta imediata — combinada com a voz visual do Relatório Sal Digital: Instrument Serif onde os dados merecem destaque, Geist onde o trabalho acontece, o Laranja Salgado como presença discreta mas inconfundível.

O sistema recusa dois opostos igualmente errados: o minimalismo genérico sem personalidade (SaaS americano, Inter 14px em todo lugar, purple gradients no fundo branco) e o dashboard de BI pesado com gráficos em todo canto e densidade que sufoca. O resultado é um produto que parece feito para — e por — pessoas que entendem de comunicação visual.

A ferramenta some no fluxo. Colaboradores abrem, preenchem, fecham. Gestores escaneiam o status da semana em 30 segundos. O design serve esse ritmo sem interromper.

**Key Characteristics:**
- Instrument Serif para números grandes e títulos de página; Geist para tudo que trabalha
- Laranja Salgado como presença pontual: ação primária e alertas críticos apenas
- Hierarquia por escala tipográfica, não por cor
- Status comunicados por badge de texto + cor (nunca só cor)
- Fundo frio levemente tintado (`#f5f5f7`) com superfícies quentes-mornas (`#fafaf8`)

## 2. Colors: A Paleta Salgado

Paleta de dois momentos: o fundo frio Apple-inspired que faz a superfície parecer leve, e o Laranja Salgado que aparece raramente o suficiente para ser sempre notado.

### Primary
- **Laranja Salgado** (`#e8614a`): O acento da marca. Botão de ação primária, status "excedido", alertas de excesso inter-projetos. Nunca como cor de fundo de superfície, nunca decorativo.
- **Laranja Profundo** (`#c0391f`): Estado hover do Laranja Salgado e texto em badges "excedido". Mais escuro, mais urgente.

### Secondary
- **Azul Parcial** (`#0071e3`): Estado "parcial" nos badges de status. Informacional, não urgente.

### Tertiary
- **Verde Fechado** (`#34c759`): Estado "fechado" — semana completa, meta atingida. Barras de progresso completas, números de realizadas confirmadas.
- **Amarelo Pendente** (`#ff9500`): Estado "pendente" — horas previstas mas nenhuma realizada. Alerta moderado.
- **Vermelho Crítico** (`#ff3b30`): Sem alocação, ação destrutiva hover. Reservado para situações que exigem atenção imediata.

### Neutral
- **Superfície Fria** (`#f5f5f7`): Background da página. Levemente fria, Apple-inspired.
- **Branco Morno** (`#fafaf8`): Superfície de cards e painéis. Quase branco, levemente quente — cria contraste sutil com o background sem ser cru.
- **Tinta** (`#1d1d1f`): Texto primário. Apple near-black, não preto puro.
- **Cinza Médio** (`#6e6e73`): Texto secundário, labels, valores de suporte.
- **Cinza Suave** (`#aeaeb2`): Texto terciário, placeholders, valores nulos ("—").
- **Borda Sutil** (`#d2d2d7`): Bordas de cards e separadores estruturais.
- **Borda Clara** (`#e8e8ed`): Divisores internos de tabela e separadores entre linhas.
- **Fundo Alternativo** (`#f2f2f4`): Header de tabela, footer de totais, fundo tonal de células em hover.

**A Regra do Acento Único.** O Laranja Salgado aparece em ≤10% de qualquer tela: botão primário, badge "excedido", e no ponto `::after` do logotipo no nav. A raridade é o ponto. Usar como cor de fundo de card, de gráfico ou de texto corrido é proibido.

**A Regra do Texto na Cor.** Texto sobre fundo colorido usa sempre a variante escura da mesma cor (`verde-texto` sobre `verde-soft`, `amarelo-texto` sobre `amarelo-soft`). Nunca texto cinza ou preto sobre background tintado — a cor do texto deve ser reconhecível como da mesma família.

## 3. Typography

**Display Font:** Instrument Serif (Google Fonts; italic variant ativa)
**Body/UI Font:** Geist (Google Fonts; pesos 300/400/500/600/700)

**Character:** Instrument Serif aparece apenas onde o dado merece destaque tipográfico: números de KPI, títulos de página, e rótulos de marca. Fora esses momentos, recua completamente — nunca em labels de tabela, botões ou copy de UI. Geist carrega todo o resto com familiaridade profissional e zero ornamento.

### Hierarchy
- **Display** (400, 38px, line-height 1, tracking -.02em): Números de KPI no strip de métricas. Instrumento Serif, sempre romano (não itálico aqui).
- **Display-Italic** (400, 28px, line-height 1, tracking -.02em, italic): Títulos de página ("Horas", "Painel"). Instrument Serif itálico.
- **Headline** (Geist 600, 15px, line-height 1.3, tracking -.01em): Cabeçalhos de card, títulos de seção dentro do Painel.
- **Body** (Geist 400/500, 14px, line-height 1.5): Texto corrido, valores de input, nomes de projeto e pessoa.
- **Label** (Geist 600, 11px, uppercase, tracking .04em): Headers de coluna de tabela, rótulos de KPI acima do número, labels de filtro.

**A Regra Dois Momentos.** Instrument Serif tem permissão em dois contextos: (1) título de página e (2) número de KPI grande. Qualquer outro uso — labels, badges, botões, copy de UI — usa Geist. A mistura não autorizada dilui o impacto dos dois momentos.

## 4. Elevation

Profundidade por camadas tônais e borda fina. Sombras são minimizadas: a distinção entre superfícies vem principalmente da diferença de fundo (`#f5f5f7` → `#fafaf8`) e de uma borda `0.5px solid #d2d2d7`. Não de sombra projetada.

### Shadow Vocabulary
- **Ambient-Low** (`0 1px 3px rgba(0,0,0,.04), 0 0 0 .5px rgba(0,0,0,.05)`): Cards em repouso. Quase imperceptível — sua função é de contorno, não de profundidade.
- **Ambient-Mid** (`0 2px 12px rgba(0,0,0,.06)`): Hover state de cards, floating nav. Leve levantamento.
- **Ambient-High** (`0 8px 32px rgba(0,0,0,.08)`): Floating bulk action bar, elementos sobrepostos.

**A Regra Plano por Padrão.** Superfícies de dados (linhas de tabela, células de KPI) são planas. Sombra aparece como resposta de estado (hover sobre card de pessoa, bulk bar flutuante) — nunca como decoração em repouso. Se um elemento precisa de sombra para parecer "importante", o problema é de hierarquia, não de elevação.

## 5. Components

### Buttons
Design arredondado total (100px). Forma pílula é a assinatura do sistema; botões quadrados não existem aqui.
- **Primary:** `#e8614a` background, texto `oklch(99% 0.004 40)`, padding 11px 24px, altura mínima 44px. Hover: `#c0391f`.
- **Ghost:** Fundo transparente, texto `#6e6e73`, border-radius 8px. Hover: texto vermelho (`#ff3b30`) — indica ação destrutiva. Padding 10px 8px.

### Status Badges
O componente de status é o mais importante do sistema. Comunicam estado sem depender de cor isolada: sempre têm texto `"estado · Xh/Yh"`.
- **Fechado:** fundo verde-soft, texto verde-escuro. Semana completa.
- **Parcial:** fundo azul-soft, texto azul-escuro. Em progresso.
- **Pendente:** fundo amarelo-soft, texto amarelo-escuro. Sem nenhuma realizada.
- **Excedido:** fundo laranja-soft + borda laranja-subtle, texto laranja-profundo. Acima de 40h — estado mais crítico, único com borda além do fundo.

### Person Cards (Horas tab)
Container principal do fluxo de lançamento. Border-radius 18px, borda `1px solid #d2d2d7`, fundo `#fafaf8`, shadow ambient-low. O card se eleva (ambient-mid) ao hover mas nunca muda de cor — profundidade como resposta, não como estado selecionado.

Header do card: nome da pessoa (Geist 600 15px) + badge de status (à direita) + botão ↺ replicar + × remover. Altura mínima 44px para touch.

### Tables
Estrutura flat: sem bordas externas, divisores internos `0.5px solid #f2f2f4`, hover de linha `rgba(242,242,244,.6)`. Headers de coluna em Geist Label (11px uppercase). Row actions (↺ ✎ ×) aparecem no hover em desktop; sempre visíveis em Registros (view de auditoria).

### KPI Strip
Grid de 4 células uniformes. Borda `1px solid #d2d2d7`, border-radius 18px, overflow hidden. Cada célula: Label 11px uppercase (cinza médio) → número em Instrument Serif Display 38px → subtitle 12px (cinza médio). Sem divisores verticais extras — a borda interna `0.5px solid #e8e8ed` entre células é suficiente.

### Week Navigator
Pílula com overflow hidden, borda `1px solid #d2d2d7`, fundo `#fafaf8`. Botões ‹/› de 40px × 40px. Label central em Geist 500 13px. O componente é navegação temporal pura — nenhuma cor de acento.

### Navigation (Top Nav)
Frosted glass: `background: rgba(245,245,247,.88); backdrop-filter: saturate(180%) blur(20px)`. Sticky, 52px altura. Tabs em estilo pílula com estado ativo (fundo `#fafaf8`, shadow ambient-low). O logotipo usa Instrument Serif itálico 17px com um ponto laranja `::after`.

### Bulk Action Bar (Registros)
Floating, bottom-center, fundo `#1d1d1f`. Border-radius 100px. Aparece ao selecionar registros com transição `translateY + opacity`. Botão de ação secundário em fundo `rgba(255,255,255,.12)`. O contador de selecionados usa Laranja Salgado.

## 6. Do's and Don'ts

### Do:
- **Use Instrument Serif exclusivamente em títulos de página e números de KPI.** A fonte tem dois papéis; respeite o limite.
- **Mostre estado com texto + cor juntos.** `"parcial · 16/40h"` — nunca só a cor azul. Daltonismo e leitores de tela dependem do texto.
- **Use o Laranja Salgado em ≤10% da tela.** Ação primária, badge excedido, ponto do logotipo. A raridade é o que o torna eficaz.
- **Coloque avisos no lugar certo.** Badge no header do card da pessoa, aviso inline na célula da tabela. Não em toast flutuante.
- **Use Instrument Serif itálico para títulos de página.** "Horas", "Painel", "Projeto" ganham personalidade sem esforço.
- **Tamanho mínimo de 44px para alvos de toque.** Botões, inputs, nav buttons — todos com `min-height: 44px`.

### Don't:
- **Não use dashboard de BI pesado** — gráficos em todo canto, densidade sufocante, difícil de escanear. O Painel tem gráficos, mas eles existem para responder perguntas específicas, não para preencher espaço.
- **Não use planilha de RH sem identidade** — tabelas brancas densas, zero personalidade, Inter 14px everywhere. O sistema tem identidade própria; cada tela deve parecer do Grupo SAL.
- **Não use SaaS americano genérico** — gradientes roxos em fundo branco, cards icon+título+texto repetidos, Inter em todo lugar. Este app é explicitamente brasileiro.
- **Não coloque Instrument Serif em labels, botões ou copy de UI.** Fora dos dois momentos autorizados (título de página, número de KPI), a fonte perde o impacto.
- **Não use `border-left` maior que 1px como acento colorido.** Nunca. Use fundo tintado, badge ou ausência de borda.
- **Não aplique `background-clip: text` com gradiente.** Proibido. Cor sólida para texto sempre.
- **Não transmita estado só por cor.** Um badge verde que diz apenas "●" falha em acessibilidade. O texto do estado é obrigatório.
- **Não use glassmorphism decorativo.** O nav usa blur funcional (frosted glass) porque é navigation — não como estética genérica em cards.
- **Não amplie o Laranja Salgado para gráficos, ícones decorativos ou seções inteiras.** Ele representa ação e risco; usar como tom geral esgota o sinal.
