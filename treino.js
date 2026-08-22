import * as Fila from './treino-fila.js';
import * as Sessao from './treino-sessao.js';
import * as Questoes from './treino-questoes.js';
import * as QuestoesIA from './treino-questoes-ia.js';

const Treino = { ...Fila, ...Sessao, ...Questoes, ...QuestoesIA };

if(typeof window !== 'undefined') window.Treino = Treino;

export default Treino;
