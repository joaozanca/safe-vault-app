# data/

Camada de persistência — acesso ao banco SQLCipher e ao sistema de arquivos (backups).
Só a camada `domain/` fala com `data/`; a UI nunca acessa isto diretamente.

Vai conter:

- `database.ts` — abertura/fechamento do banco cifrado (SQLCipher via `op-sqlite`),
  migrações de `formatVersion` (H1.3).
- `secureStore.ts` — wrapper fino sobre `expo-secure-store` para as chaves embrulhadas.
- `fileBackup.ts` — escrita/leitura atômica dos arquivos `.safevault` (H2.3, H2.4).
