import { randomBytes, randomBytesAsync, randomInt } from './csprng';

describe('csprng', () => {
  it('gera um Uint8Array com exatamente o número de bytes pedido', () => {
    const bytes = randomBytes(16);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(16);
  });

  it('duas chamadas seguidas não geram o mesmo resultado', () => {
    // Não prova aleatoriedade (isso exigiria análise estatística fora do escopo
    // de um teste unitário), mas pega o erro mais comum: uma implementação que
    // "esqueceu" de re-sortear e devolve sempre o mesmo buffer.
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('gerando 200 amostras de 16 bytes, nenhuma se repete', () => {
    // Guarda contra nonce/salt colidindo — o mesmo tipo de invariante que a
    // Sprint 5 (H5.2) vai checar em escala real dentro do cofre.
    const amostras = new Set<string>();
    for (let i = 0; i < 200; i++) {
      amostras.add(Buffer.from(randomBytes(16)).toString('hex'));
    }
    expect(amostras.size).toBe(200);
  });

  it.each([0, -1, 1.5, NaN])('rejeita length inválido (%p)', (length) => {
    expect(() => randomBytes(length)).toThrow(RangeError);
  });

  it('randomBytesAsync também respeita o length pedido', async () => {
    const bytes = await randomBytesAsync(24);
    expect(bytes.length).toBe(24);
  });

  describe('randomInt', () => {
    it('nunca devolve um valor fora de [0, maxExclusive)', () => {
      for (let i = 0; i < 500; i++) {
        const n = randomInt(7);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(7);
      }
    });

    it('em 500 amostras de randomInt(2), os dois valores possíveis aparecem', () => {
      // Não prova uniformidade (exigiria análise estatística fora do escopo
      // de um teste unitário), mas pega o erro mais comum: uma implementação
      // enviesada a ponto de nunca sortear um dos lados.
      const vistos = new Set<number>();
      for (let i = 0; i < 500; i++) vistos.add(randomInt(2));
      expect(vistos).toEqual(new Set([0, 1]));
    });

    it('maxExclusive = 256 nunca trava no rejection sampling (todo byte é aceito)', () => {
      for (let i = 0; i < 50; i++) {
        const n = randomInt(256);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(255);
      }
    });

    it.each([0, -1, 1.5, NaN, 257])('rejeita maxExclusive inválido (%p)', (maxExclusive) => {
      expect(() => randomInt(maxExclusive)).toThrow(RangeError);
    });
  });
});
