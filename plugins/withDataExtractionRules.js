const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');

/**
 * H2.6 — Config Plugin (roda no `expo prebuild`, não no bundle RN) que:
 * 1. Copia `android-res/xml/data_extraction_rules.xml` para dentro de
 *    `android/app/src/main/res/xml/` — precisa ser feito a cada prebuild
 *    porque `android/` é gerado (gitignored, CNG), não dá pra só deixar o
 *    arquivo lá direto.
 * 2. Aponta `android:dataExtractionRules` pra esse arquivo no
 *    `<application>` do AndroidManifest.xml gerado.
 *
 * `android:allowBackup="false"` (configurado direto em app.json, suporte
 * nativo do Expo) já bloqueia todo backup — isto aqui é defesa em
 * profundidade para o caso de allowBackup um dia voltar a ser `true`.
 */
function withDataExtractionRulesFile(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      fs.mkdirSync(destDir, { recursive: true });

      const src = path.join(__dirname, 'android-res/xml/data_extraction_rules.xml');
      fs.copyFileSync(src, path.join(destDir, 'data_extraction_rules.xml'));

      return config;
    },
  ]);
}

function withDataExtractionRulesManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplication(config.modResults);
    if (mainApplication?.$) {
      mainApplication.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
    }
    return config;
  });
}

module.exports = function withDataExtractionRules(config) {
  config = withDataExtractionRulesFile(config);
  config = withDataExtractionRulesManifest(config);
  return config;
};
