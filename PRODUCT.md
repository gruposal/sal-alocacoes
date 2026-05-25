# Product

## Register

product

## Users

Dois perfis internos do Grupo SAL, uso semanal recorrente, desktop como contexto primário:

**Gestora / Gestor**: Aloca horas previstas no início da semana para o time inteiro. Fluxo ágil — precisa ver várias pessoas de uma vez, detectar quem está desalocado ou excedido, e salvar rápido.

**Colaboradora / Colaborador**: Preenche horas realizadas no final da semana, projeto por projeto. Fluxo linear — entra, compara previsto com o que fez, confirma ou ajusta, sai.

Ambos são do time de criação de uma agência brasileira. Não são usuários técnicos; tolerância baixa para fricção. Abrem o app em contexto de trabalho intenso, não de aprendizado.

## Product Purpose

Ferramenta de rateio de custos semanais. Cada pessoa registra 40h/semana distribuídas por projetos. Esses dados alimentam o ClickUp, que é o sistema de record. O app existe para tornar o ritual semanal de lançamento de horas rápido, correto e sem duplicatas.

Sucesso: o colaborador abre, preenche, fecha em menos de 2 minutos. A gestora olha o painel e sabe em 30 segundos quem está pendente.

## Brand Personality

Editorial, preciso, confiante.

Herda o DNA do Relatório Digital do Sal Digital: Instrument Serif para momentos de destaque (títulos, números grandes), Geist para tudo que trabalha (labels, dados, ações). A marca está presente mas quieta; os dados são o centro.

Voz: direta, sem adjetivos supérfluos. "Salvo." não "Suas alocações foram salvas com sucesso!".

## Anti-references

- **Dashboard de BI pesado**: gráficos por todos os lados, densidade sufocante, difícil de escanear — o oposto do que gestores precisam ao verificar o status da semana
- **Planilha de RH corporativa**: telas brancas sem identidade, tabelas densas, zero personalidade — o estado anterior que este app veio substituir
- **SaaS americano genérico**: gradientes roxos em fundo branco, cards icon+título+texto repetidos, Inter 14px em todo lugar, sem nenhum traço de onde e para quem foi feito

## Design Principles

1. **A ferramenta some no fluxo.** Cada interação deve ser invisível. O colaborador abre, preenche, fecha. Sem onboarding, sem toasts desnecessários, sem confirmações que interrompem.

2. **O dado mais importante chega primeiro.** Status (pendente, parcial, fechado, excedido), desvio e total aparecem antes da explicação. Hierarquia visual reflete hierarquia de atenção.

3. **Contexto no lugar certo.** Avisos aparecem próximos ao dado que os causou — badge no card da pessoa, aviso inline na célula da tabela. Não em modais, não em toasts flutuantes.

4. **Erros são prevenidos, não gerenciados.** Caps de 40h, alertas de excesso em tempo real, badges de status substituem mensagens de erro after-the-fact. O sistema guia antes de punir.

5. **Identidade presente sem competir com o conteúdo.** Instrument Serif aparece em títulos de página e números de KPI. Fora desses momentos, o design recua. O acento `#e8614a` marca ação primária e alertas críticos apenas.

## Accessibility & Inclusion

WCAG AA: contraste mínimo em todos os textos, indicadores de foco visíveis em todos os elementos interativos, nenhuma informação transmitida exclusivamente por cor (status badges sempre têm texto, desvio sempre tem sinal + valor). Respeito a `prefers-reduced-motion`.
