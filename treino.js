import * as Fila from './treino-fila.js';
import * as Sessao from './treino-sessao.js';
import * as Questoes from './treino-questoes.js';

const Treino = { ...Fila, ...Sessao, ...Questoes };

if(typeof window !== 'undefined') window.Treino = Treino;

export default Treino;
