/* Regras das rotas de campo: Executivo de Chopp e Promotor */

// Perfis (coluna "perfil" da aba usuarios): Executivo de Chopp, Promotor. ADM/STM/outros veem todas as rotas.
const PERFIS = {
  EXECUTIVO: { nome: 'Executivo de Chopp', rotas: ['CHOPP', 'CONQUISTA'] },
  PROMOTOR: { nome: 'Promotor', rotas: ['PROMOTOR'] },
  _OUTROS: { nome: 'Gestão', rotas: ['CHOPP', 'CONQUISTA', 'PROMOTOR'] }
};

// Metas de visitas por mês (0 = sem meta: o app só conta). Ex.: CHOPP: 60
const METAS = { CHOPP: 0, CONQUISTA: 0, PROMOTOR: 0 };

const ROTAS = {
  CHOPP: { nome: 'Rota rotina chopp', curto: 'Rotina chopp', icone: '🍺', lista: 'chop', desc: 'PDVs com chopeira' },
  CONQUISTA: { nome: 'PDV Conquista', curto: 'Conquista', icone: '🎯', lista: 'todos', desc: 'Novo PDV para chopp' },
  PROMOTOR: { nome: 'Rota promotor', curto: 'Promotor', icone: '🛒', lista: 'prom', desc: 'Mini, Super e Hiper' }
};

const ROTINA_CHOPP = [
  'Verificar se tem comodato em aberto', 'Verificar se o cliente bate a meta da chopeira', 'Verificar se o chopp está precificado',
  'Verificar se o cliente tem preço aderido e se está praticando na ponta', 'Verificar se o cliente não está com problema na chopeira ou se precisa se adequar',
  'Verificar se precisa de materiais de serviço', 'Verificar se o cliente está recebendo assepsia'
];
const PASSOS_PROMOTOR = [
  'Faça-se presente, identifique-se ao gerente', 'Organize a gôndola', 'Verifique outras áreas', 'Prepare o estoque',
  'Abasteça as áreas', 'Confira os preços', 'Aplique merchandising', 'Conquiste espaços'
];
// Fluxos de execução do promotor: [chave, nome, imagem de referência]
const FLUXOS = [
  ['craft', 'CRAFT', 'img/fluxos/craft.jpg'], ['premium', 'PREMIUM', 'img/fluxos/premium.jpg'], ['lono', 'LONO', 'img/fluxos/lono.jpg'],
  ['mainstream', 'MAINSTREAM', 'img/fluxos/mainstream.jpg'], ['mamba', 'MAMBA PROTEIN', 'img/fluxos/mamba.jpg']
];
const FLUXO_GELADEIRA = ['geladeira', 'Execução da geladeira', 'img/fluxos/geladeira.jpg'];

const MOTIVOS_CONQUISTA = ['Cliente já trabalha com o chopp da concorrência', 'Cliente tem intenção de começar a trabalhar com o chopp', 'Oportunidade de ter Chopp da Casa', 'Outro'];
const MARCAS_CONC = ['Brahma', 'Antarctica', 'Skol', 'Budweiser', 'Stella Artois', 'Spaten', 'Original', 'Itaipava', 'Petra', 'Colorado', 'Outra'];
const PLANOS_COMODATO = ['Renovar o comodato', 'Recolher a chopeira', 'Outro'];
const DIAS_ALERTA_COMODATO = 60;   // vence em até 60 dias = amarelo

const NOMES_FDS = {
  'Amsln': 'Amstel Long Neck', 'Amslt': 'Amstel Lata', 'Amsret': 'Amstel Retornável', 'Bad600+Chopp': 'Baden 600ml + Chopp', 'Badlt350': 'Baden Lata 350',
  'Blue': 'Blue', 'Fys': 'FYS', 'Hnk0.0': 'Heineken 0.0', 'Hnkln330': 'Heineken Long Neck 330', 'Hnklt269': 'Heineken Lata 269', 'Hnklt350': 'Heineken Lata 350',
  'Hnkret': 'Heineken 600 Retornável', 'Hnkshot': 'Heineken Shot', 'Itub': 'Itubaína', 'Praya': 'Praya', 'Schret': 'Schin Retornável'
};
