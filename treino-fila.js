export function errosParaItensFila(erros){
  return erros.map(e => ({ tipo: 'erro', refId: e.id, assunto: e.assunto }));
}

export function montarFila(itensPendentes, opts = {}){
  if(opts.focarAssunto){
    return itensPendentes.filter(item => item.assunto === opts.focarAssunto);
  }
  const restantes = [...itensPendentes];
  const resultado = [];
  while(restantes.length){
    const doisUltimos = resultado.slice(-2);
    const bloquearAssunto = (doisUltimos.length === 2 && doisUltimos[0].assunto === doisUltimos[1].assunto)
      ? doisUltimos[0].assunto
      : null;
    let idx = restantes.findIndex(item => item.assunto !== bloquearAssunto);
    if(idx === -1) idx = 0; // só resta esse assunto — repetição inevitável
    resultado.push(restantes.splice(idx, 1)[0]);
  }
  return resultado;
}
