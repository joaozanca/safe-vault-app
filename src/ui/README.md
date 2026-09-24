# ui/

Telas e componentes React Native. Só fala com `domain/`, nunca diretamente com
`crypto/` ou `data/`. Nenhuma asserção de teste vive aqui — isso é papel dos specs de
Appium/Detox, não do componente.

Subpastas (criadas conforme as telas forem implementadas):

- `screens/` — uma tela por arquivo (ex.: `CreateVaultScreen.tsx`, `UnlockScreen.tsx`).
- `components/` — componentes reutilizáveis entre telas.

Todo componente interativo leva um `testID` seguindo o
[padrão combinado](../../docs/sprint-0/padrao-testid.md) — e é avisado no resumo da
implementação, arquivo por arquivo.
