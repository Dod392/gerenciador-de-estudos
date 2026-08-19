import * as Modelo from './erros-ia-modelo.js';
import * as Repeticao from './erros-ia-repeticao.js';

const ErrosIA = { ...Modelo, ...Repeticao };

if(typeof window !== 'undefined') window.ErrosIA = ErrosIA;

export default ErrosIA;
