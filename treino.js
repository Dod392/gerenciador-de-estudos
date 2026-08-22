import * as Fila from './treino-fila.js';
import * as Sessao from './treino-sessao.js';
import * as Questoes from './treino-questoes.js';
import * as QuestoesIA from './treino-questoes-ia.js';
import * as Progresso from './treino-progresso.js';

const Treino = { ...Fila, ...Sessao, ...Questoes, ...QuestoesIA, ...Progresso };

if(typeof window !== 'undefined') window.Treino = Treino;

export default Treino;
