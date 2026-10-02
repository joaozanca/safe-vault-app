import { calcularForcaSenha } from './PasswordStrength';

describe('calcularForcaSenha', () => {
  it('senha curta (< 8) é sempre fraca', () => {
    expect(calcularForcaSenha('Ab1')).toBe('fraca');
  });

  it('8+ caracteres mas só 1 classe de caractere é fraca', () => {
    expect(calcularForcaSenha('somenteminusculas')).toBe('fraca');
  });

  it('8+ caracteres com 2 classes é média', () => {
    expect(calcularForcaSenha('senha1234')).toBe('media');
  });

  it('16+ caracteres com 3+ classes é forte', () => {
    expect(calcularForcaSenha('Senha-Forte-1234!')).toBe('forte');
  });
});
