import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errosParaItensFila, montarFila } from './treino-fila.js';

test('errosParaItensFila mapeia erro para item de fila tipo erro', () => {
  const itens = errosParaItensFila([{ id: 'e1', assunto: 'PNRH' }]);
  assert.deepEqual(itens, [{ tipo: 'erro', refId: 'e1', assunto: 'PNRH' }]);
});

test('montarFila preserva ordem quando não há assunto repetido', () => {
  const itens = [{assunto:'A'},{assunto:'B'},{assunto:'C'}].map((x,i)=>({...x, refId:String(i)}));
  assert.deepEqual(montarFila(itens).map(i=>i.assunto), ['A','B','C']);
});

test('montarFila nunca deixa 3 itens seguidos do mesmo assunto quando é possível evitar', () => {
  const itens = [
    {assunto:'A',refId:'a1'},{assunto:'A',refId:'a2'},{assunto:'A',refId:'a3'},
    {assunto:'B',refId:'b1'},{assunto:'B',refId:'b2'},
  ];
  const fila = montarFila(itens);
  assert.equal(fila.length, 5);
  for(let i=0;i<fila.length-2;i++){
    assert.ok(!(fila[i].assunto===fila[i+1].assunto && fila[i+1].assunto===fila[i+2].assunto), `3 seguidos em i=${i}`);
  }
});

test('montarFila aceita repetição quando só resta um assunto nos itens restantes', () => {
  const itens = [{assunto:'A',refId:'a1'},{assunto:'A',refId:'a2'},{assunto:'A',refId:'a3'}];
  const fila = montarFila(itens);
  assert.equal(fila.length, 3);
  assert.deepEqual(fila.map(i=>i.refId), ['a1','a2','a3']);
});

test('montarFila com focarAssunto filtra só aquele assunto, mantendo ordem original', () => {
  const itens = [{assunto:'A',refId:'a1'},{assunto:'B',refId:'b1'},{assunto:'A',refId:'a2'}];
  const fila = montarFila(itens, { focarAssunto: 'A' });
  assert.deepEqual(fila.map(i=>i.refId), ['a1','a2']);
});

test('montarFila com lista vazia retorna lista vazia', () => {
  assert.deepEqual(montarFila([]), []);
});
