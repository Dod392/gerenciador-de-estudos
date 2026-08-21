import * as Modelo from './erros-ia-modelo.js';
import * as Repeticao from './erros-ia-repeticao.js';
import * as Export from './erros-ia-export.js';
import * as Import from './erros-ia-import.js';

const ErrosIA = { ...Modelo, ...Repeticao, ...Export, ...Import };

if(typeof window !== 'undefined') window.ErrosIA = ErrosIA;

export default ErrosIA;
