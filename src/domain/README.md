# domain/

Camada de domínio — regras de negócio em TypeScript puro, sem depender de componente de
UI nem de biblioteca de criptografia diretamente (usa `crypto/` e `data/` por baixo).
É a camada mais fácil de testar isoladamente com Jest, porque não depende de renderizar
nada.

Vai conter, conforme as histórias forem implementadas:

- `VaultService.ts` — criar cofre, desbloquear, trocar senha mestra (H1.1, H1.2).
- `RecoveryService.ts` — gerar e usar a chave de recuperação (H2.1, H2.2).
- `CredentialService.ts` — CRUD de credenciais (H3.1).
- `BackupService.ts` — exportar/importar (H2.3–H2.5).
- `GeneratorService.ts` — gerador de senhas (H4.1).
- `AutoLockController.ts` — bloqueio por inatividade (H3.3).
