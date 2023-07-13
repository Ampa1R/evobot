import i18n from "i18n";
import { join } from "path";
import { config } from "./config";
import { Logger } from "./logger";

i18n.configure({
  locales: [
    "ar",
    "cs",
    "de",
    "el",
    "en",
    "es",
    "fa",
    "fr",
    "id",
    "it",
    "ja",
    "ko",
    "mi",
    "nb",
    "nl",
    "pl",
    "pt_br",
    "ru",
    "sv",
    "th",
    "tr",
    "uk",
    "vi",
    "zh_cn",
    "zh_sg",
    "zh_tw"
  ],
  directory: join(__dirname, "..", "locales"),
  defaultLocale: "en",
  retryInDefaultLocale: true,
  objectNotation: true,
  register: global,

  logWarnFn: function (msg) {
    Logger.log(msg);
  },

  logErrorFn: function (msg) {
    Logger.log(msg);
  },

  missingKeyFn: function (locale, value) {
    return value;
  },

  mustacheConfig: {
    tags: ["{{", "}}"],
    disable: false
  }
});

i18n.setLocale(config.LOCALE);

export { i18n };
