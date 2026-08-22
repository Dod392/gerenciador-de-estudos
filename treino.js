import * as Fila from './treino-fila.js';
import * as Sessao from './treino-sessao.js';

const Treino = { ...Fila, ...Sessao };

if(typeof window !== 'undefined') window.Treino = Treino;

export default Treino;
