// Field IDs mapeados manualmente — sem auto-descoberta necessária
export const LIST_ENTRIES   = import.meta.env.VITE_CLICKUP_LIST_ENTRIES;
export const LIST_PEOPLE    = import.meta.env.VITE_CLICKUP_LIST_PEOPLE;   // legado — manter até remoção manual
export const LIST_PROJECTS  = import.meta.env.VITE_CLICKUP_LIST_PROJECTS;
export const LIST_DIRETORIO = '198927200'; // Diretório de Salgados (G&C)

// Custom fields do Diretório de Salgados
export const DIRETORIO_FIELDS = {
  unidade: '04b081b3-7673-42ff-851f-3ac5e1b57a91', // labels
};

// Custom fields da LISTA_PESSOAS (legado)
export const PEOPLE_FIELDS = {
  unidade: '9fa24352-fb7e-40ca-a58a-d56113bc03f3',
  cargo:   'f7a6e173-46b6-4bc8-8dad-00cf9b7bd4bb',
};

export const FIELDS = {
  ano:                   '6cfe5832-2f23-48a6-85b8-3d4b2772aa3d',
  semana_num:            'f277efd9-5809-4b96-aa83-64db7d351891',
  pessoa:                'c4295bb0-84c0-4223-9dff-8aba51259135', // texto legado — não escrever
  projeto:               'adc1114d-84b8-4214-a98c-9accc60a3048', // texto legado — não escrever
  centro_de_custo:       '02320ff2-3cca-4ad0-b5e0-c7dd3d10e925',
  horas_previstas:       'a120ac5b-de46-4960-a7f4-ef07e66c54de',
  horas_realizadas:      'c704f2c7-aefd-4b70-af83-a42e5996697e',
  rel_colaborador:       'dcd6eb4f-4e04-405d-93dd-8cedb3765938', // relationship → LISTA_PESSOAS (legado)
  rel_colaborador_novo:  'a8f17cd8-9b6d-45ac-9291-f4be28ab05a7', // relationship → Diretório
  rel_projeto:           'ac9c3838-f316-45ea-ba05-b177b3148715',
  data_inicio:           'd2f4fdaa-d78c-4b4c-bb4d-c72e1655e0ac',
};

// Opções do dropdown Centro de Custo
export const CENTRO_DE_CUSTO_OPTIONS = [
  { id: '7aa1503b-224d-4923-ad01-f73d9fd24c6f', name: 'Branding' },
  { id: '4826465d-5845-4d76-9605-50a68672eef5', name: 'Comunicação' },
  { id: '6f8d935c-2070-4b7a-b1b3-c1abdc10de53', name: 'Conteúdo' },
  { id: 'c8d24b20-5be2-478f-beb1-450c8ae21553', name: 'CSC' },
  { id: '9e29f0ed-251a-449e-a17f-b27f55a30836', name: 'Marketing' },
  { id: 'b0a9fe91-5962-4201-8547-5378dea186b1', name: 'Sal' },
  { id: 'ac785520-078e-4e7b-9734-bfa92df3a2e5', name: 'Vendas' },
  { id: '2c4888e8-f2d1-45b8-9f7d-2304dd95608c', name: 'Novos Negócios' },
  { id: '5aab5a54-2177-4019-84fd-91c04cd2f009', name: 'Entretenimento' },
];

export function ccNameToId(name) {
  return CENTRO_DE_CUSTO_OPTIONS.find(o => o.name === name)?.id ?? null;
}

export function ccIdToName(id) {
  return CENTRO_DE_CUSTO_OPTIONS.find(o => o.id === id)?.name ?? null;
}

// Mapa CC → variável CSS do dot color. Pastéis calibrados para canvas creme.
// As CSS vars vivem em src/index.css (light + dark).
export const CC_VAR = {
  'Branding':        'var(--cc-branding)',
  'Comunicação':     'var(--cc-comunicacao)',
  'Conteúdo':        'var(--cc-conteudo)',
  'CSC':             'var(--cc-csc)',
  'Marketing':       'var(--cc-marketing)',
  'Sal':             'var(--cc-sal)',
  'Vendas':          'var(--cc-vendas)',
  'Novos Negócios':  'var(--cc-novos-negocios)',
  'Entretenimento':  'var(--cc-entretenimento)',
};

export function ccColor(name) {
  return CC_VAR[name] || 'var(--cc-default)';
}
