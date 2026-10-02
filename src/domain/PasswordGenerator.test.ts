import {
  GENERATOR_MAX_LENGTH,
  GENERATOR_MIN_LENGTH,
  gerarSenha,
  OPCOES_PADRAO,
  OpcoesGeradorInvalidasError,
  type OpcoesGerador,
} from './PasswordGenerator';

describe('gerarSenha', () => {
  it('gera senha com o tamanho pedido', () => {
    for (const tamanho of [GENERATOR_MIN_LENGTH, 16, 32, GENERATOR_MAX_LENGTH]) {
      const senha = gerarSenha({ ...OPCOES_PADRAO, tamanho });
      expect(senha.length).toBe(tamanho);
    }
  });

  it('com as opções padrão, duas gerações seguidas não coincidem', () => {
    const a = gerarSenha(OPCOES_PADRAO);
    const b = gerarSenha(OPCOES_PADRAO);
    expect(a).not.toBe(b);
  });

  it('gerando 200 senhas, nenhuma se repete', () => {
    const amostras = new Set<string>();
    for (let i = 0; i < 200; i++) amostras.add(gerarSenha(OPCOES_PADRAO));
    expect(amostras.size).toBe(200);
  });

  it('garante ao menos 1 caractere de cada classe marcada, não é só estatística', () => {
    // Roda muitas vezes: se a garantia fosse só "estatisticamente provável",
    // em algum momento uma geração sairia sem alguma classe.
    for (let i = 0; i < 100; i++) {
      const senha = gerarSenha({
        tamanho: 8,
        maiusculas: true,
        minusculas: true,
        numeros: true,
        simbolos: true,
        excluirAmbiguos: false,
      });
      expect(senha).toMatch(/[A-Z]/);
      expect(senha).toMatch(/[a-z]/);
      expect(senha).toMatch(/[0-9]/);
      expect(senha).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it('classe desmarcada nunca aparece na senha gerada', () => {
    for (let i = 0; i < 50; i++) {
      const senha = gerarSenha({
        tamanho: 20,
        maiusculas: false,
        minusculas: true,
        numeros: false,
        simbolos: false,
        excluirAmbiguos: false,
      });
      expect(senha).toMatch(/^[a-z]+$/);
    }
  });

  it('excluirAmbiguos nunca inclui 0, O, 1, l, I', () => {
    for (let i = 0; i < 100; i++) {
      const senha = gerarSenha({
        tamanho: 32,
        maiusculas: true,
        minusculas: true,
        numeros: true,
        simbolos: false,
        excluirAmbiguos: true,
      });
      expect(senha).not.toMatch(/[0O1lI]/);
    }
  });

  it.each([GENERATOR_MIN_LENGTH - 1, GENERATOR_MAX_LENGTH + 1])(
    'rejeita tamanho fora da faixa (%i)',
    (tamanho) => {
      expect(() => gerarSenha({ ...OPCOES_PADRAO, tamanho })).toThrow(OpcoesGeradorInvalidasError);
    },
  );

  it('rejeita quando nenhuma classe está marcada', () => {
    const opcoes: OpcoesGerador = {
      tamanho: 16,
      maiusculas: false,
      minusculas: false,
      numeros: false,
      simbolos: false,
      excluirAmbiguos: false,
    };
    expect(() => gerarSenha(opcoes)).toThrow(OpcoesGeradorInvalidasError);
  });

  it('rejeita tamanho menor que o número de classes marcadas', () => {
    const opcoes: OpcoesGerador = {
      tamanho: 2,
      maiusculas: true,
      minusculas: true,
      numeros: true,
      simbolos: true,
      excluirAmbiguos: false,
    };
    expect(() => gerarSenha(opcoes)).toThrow(OpcoesGeradorInvalidasError);
  });
});
