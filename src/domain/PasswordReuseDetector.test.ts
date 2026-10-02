import { encontrarSenhasRepetidas } from './PasswordReuseDetector';
import type { Credencial } from './CredentialService';

function credencial(parcial: Partial<Credencial> & { id: string; titulo: string; senha: string }): Credencial {
  return {
    usuario: 'usuario',
    url: null,
    notas: null,
    categoria: null,
    criadoEm: 0,
    atualizadoEm: 0,
    ...parcial,
  };
}

describe('encontrarSenhasRepetidas', () => {
  it('lista vazia não acusa nenhuma repetição', () => {
    expect(encontrarSenhasRepetidas([])).toEqual([]);
  });

  it('todas as senhas diferentes não acusa nenhuma repetição', () => {
    const credenciais = [
      credencial({ id: '1', titulo: 'Banco A', senha: 'senha1' }),
      credencial({ id: '2', titulo: 'Banco B', senha: 'senha2' }),
    ];
    expect(encontrarSenhasRepetidas(credenciais)).toEqual([]);
  });

  it('duas credenciais com a mesma senha formam um grupo de 2', () => {
    const credenciais = [
      credencial({ id: '1', titulo: 'Banco A', senha: 'repetida' }),
      credencial({ id: '2', titulo: 'Banco B', senha: 'repetida' }),
      credencial({ id: '3', titulo: 'Banco C', senha: 'unica' }),
    ];
    expect(encontrarSenhasRepetidas(credenciais)).toEqual([
      { quantidade: 2, titulos: ['Banco A', 'Banco B'] },
    ]);
  });

  it('dois grupos de repetição independentes, cada um só com os seus', () => {
    const credenciais = [
      credencial({ id: '1', titulo: 'A', senha: 'x' }),
      credencial({ id: '2', titulo: 'B', senha: 'x' }),
      credencial({ id: '3', titulo: 'C', senha: 'y' }),
      credencial({ id: '4', titulo: 'D', senha: 'y' }),
      credencial({ id: '5', titulo: 'E', senha: 'y' }),
    ];
    const grupos = encontrarSenhasRepetidas(credenciais);
    expect(grupos).toHaveLength(2);
    expect(grupos).toContainEqual({ quantidade: 2, titulos: ['A', 'B'] });
    expect(grupos).toContainEqual({ quantidade: 3, titulos: ['C', 'D', 'E'] });
  });

  it('o resultado nunca inclui a senha em si, só título e quantidade', () => {
    const credenciais = [
      credencial({ id: '1', titulo: 'A', senha: 'segredo-nao-deveria-aparecer' }),
      credencial({ id: '2', titulo: 'B', senha: 'segredo-nao-deveria-aparecer' }),
    ];
    const grupos = encontrarSenhasRepetidas(credenciais);
    expect(JSON.stringify(grupos)).not.toContain('segredo-nao-deveria-aparecer');
  });
});
