import { LocDir } from "github-linguist";

import { Language } from "./languages";
import { Logger } from "./logging";

// Language IDs used by codeql when specifying its metrics.
export type IdPrefixes = "cpp" | "cs" | "go" | "java" | "js" | "py" | "rb";

// Map from linguist language names to language prefixes used in the action and codeql
const linguistToMetrics: Record<
  string,
  { name: Language; prefix: IdPrefixes }
> = {
  c: {
    name: Language.cpp,
    prefix: "cpp",
  },
  "c++": {
    name: Language.cpp,
    prefix: "cpp",
  },
  "c#": {
    name: Language.csharp,
    prefix: "cs",
  },
  go: {
    name: Language.go,
    prefix: "go",
  },
  java: {
    name: Language.java,
    prefix: "java",
  },
  javascript: {
    name: Language.javascript,
    prefix: "js",
  },
  python: {
    name: Language.python,
    prefix: "py",
  },
  typescript: {
    name: Language.javascript,
    prefix: "js",
  },
};

const nameToLinguist = Object.entries(linguistToMetrics).reduce(
  (obj, [key, { name: action }]) => {
    if (!obj[action]) {
      obj[action] = [];
    }
    obj[action].push(key);
    return obj;
  },
  {} as Record<Language, string[]>
);

/**
 * Count the lines of code of the specified language using the include
 * and exclude glob paths.
 *
 * @param cwd the root directory to start the count from
 * @param include glob patterns to include in the search for relevant files
 * @param exclude glob patterns to exclude in the search for relevant files
 * @param dbLanguages list of languages to include in the results
 * @param logger object to log results
 */
export async function countLoc(
  cwd: string,
  include: string[],
  exclude: string[],
  dbLanguages: Language[],
  logger: Logger
): Promise<Partial<Record<IdPrefixes, number>>> {
  const result = await new LocDir({
    cwd,
    include: ["**"].concat(include || []),
    exclude,
    analysisLanguages: dbLanguages.flatMap((lang) => nameToLinguist[lang]),
  }).loadInfo();

  // The analysis counts LoC in all languages. We need to
  // extract the languages we care about. Also, note that
  // the analysis uses slightly different names for language.
  const lineCounts = Object.entries(result.languages).reduce(
    (obj, [language, { code }]) => {
      const metricsLanguage = linguistToMetrics[language];
      if (metricsLanguage && dbLanguages.includes(metricsLanguage.name)) {
        obj[metricsLanguage.prefix] = code + (obj[metricsLanguage.prefix] || 0);
      }
      return obj;
    },
    {} as Record<IdPrefixes, number>
  );

  if (Object.keys(lineCounts).length) {
    logger.debug("Lines of code count:");
    for (const [language, count] of Object.entries(lineCounts)) {
      logger.debug(`  ${language}: ${count}`);
    }
  } else {
    logger.info(
      "Could not determine the total number of lines of code in this repository. " +
        "Because of this, it will not be possible to compare the number of lines " +
        "of code analyzed by code scanning with the total number of lines of " +
        "code in the repository. This will not affect the results produced by code " +
        "scanning. If you have any questions, you can raise an issue at " +
        "https://github.com/github/codeql-action/issues. Please include a link " +
        "to the repository if public, or otherwise information about the code scanning " +
        "workflow you are using."
    );
  }

  return lineCounts;
}
