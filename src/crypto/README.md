# crypto/

Camada de criptografia — a única parte do código que importa uma biblioteca de
criptografia diretamente (regra de H1.4). Nenhum outro arquivo do app deve importar
`react-native-argon2`, `react-native-quick-crypto` ou similar; tudo passa por aqui.

Vai conter, conforme H1.1–H1.4 forem implementadas:

- `kdf.ts` — deriva chave a partir da senha mestra (Argon2id, com fallback PBKDF2).
- `cipher.ts` — cifra/decifra com AES-256-GCM, sempre com nonce sorteado.
- `csprng.ts` — único ponto do app que gera bytes aleatórios (nunca `Math.random`).
- `keyHierarchy.ts` — a lógica de KEK/DEK descrita em
  [arquitetura.md](../../docs/sprint-0/arquitetura.md#5-escolha-2--hierarquia-de-chaves-kekdek).

Ver [arquitetura.md](../../docs/sprint-0/arquitetura.md) seções 4–9 para o raciocínio
completo por trás de cada escolha.
