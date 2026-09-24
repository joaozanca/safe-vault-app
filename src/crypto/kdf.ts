import argon2 from 'react-native-argon2';

import { bytesToHex, hexToBytes } from './encoding';

/**
 * Parâmetros de custo do Argon2id (ver arquitetura.md seção 4 para o porquê de
 * cada um). `memoryKiB` é o custo de memória em kibibytes, `iterations` o
 * custo de tempo, `parallelism` quantas "lanes" rodam em paralelo.
 */
export interface Argon2Params {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLengthBytes: number;
}

/**
 * Piso mínimo de segurança (H1.1 — recomendação OWASP / RFC 9106 para
 * Argon2id: m=19456 KiB, t=2, p=1). O app NUNCA deriva chave abaixo disto —
 * nem em device fraco: a decisão do refinamento da Sprint 1 foi "aceita ser
 * mais lento, nunca aceita ser mais fraco" (ver H1.1 no backlog).
 */
export const ARGON2_FLOOR: Argon2Params = {
  memoryKiB: 19456, // 19 MiB
  iterations: 2,
  parallelism: 1,
  hashLengthBytes: 32, // 256 bits — tamanho da KEK que este módulo produz
};

/**
 * Deriva uma chave a partir da senha mestra, usando Argon2id.
 *
 * `params` default é o piso mínimo de segurança. A calibração por device
 * (medir o aparelho e pedir mais iterações quando ele aguenta, nunca menos
 * que o piso) mora em `calibration.ts` — chame `calibrateParams()` primeiro
 * e passe o resultado aqui para a derivação real.
 *
 * @throws {RangeError} se `params` estiver abaixo do piso de segurança —
 * nunca silenciosamente usa um valor mais fraco.
 */
export async function deriveKey(
  password: string,
  saltBytes: Uint8Array,
  params: Argon2Params = ARGON2_FLOOR,
): Promise<Uint8Array> {
  assertAtLeastFloor(params);

  const result = await argon2(password, bytesToHex(saltBytes), {
    iterations: params.iterations,
    memory: params.memoryKiB,
    parallelism: params.parallelism,
    hashLength: params.hashLengthBytes,
    mode: 'argon2id',
    saltEncoding: 'hex',
  });

  return hexToBytes(result.rawHash);
}

function assertAtLeastFloor(params: Argon2Params): void {
  const abaixoDoPiso =
    params.memoryKiB < ARGON2_FLOOR.memoryKiB ||
    params.iterations < ARGON2_FLOOR.iterations ||
    params.parallelism < ARGON2_FLOOR.parallelism;

  if (abaixoDoPiso) {
    throw new RangeError(
      'deriveKey: params abaixo do piso mínimo de segurança ' +
        `(memória >= ${ARGON2_FLOOR.memoryKiB} KiB, iterações >= ${ARGON2_FLOOR.iterations}, ` +
        `paralelismo >= ${ARGON2_FLOOR.parallelism})`,
    );
  }
}
