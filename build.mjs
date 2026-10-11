// Generates the static site into dist/: a logo page and a privacy policy for every language in src/locales.
// No dependencies; run with `node build.mjs`.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const DIST = 'dist';
const DEFAULT_LANGUAGE = 'en';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const site = readJson(join(SRC, 'site.json'));
const languages = readdirSync(join(SRC, 'locales'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))
  .sort();
const locales = Object.fromEntries(languages.map((lang) => [lang, readJson(join(SRC, 'locales', `${lang}.json`))]));

checkLocales();
checkNginxLanguages();

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });
cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
cpSync(join(SRC, 'site.css'), join(DIST, 'assets', 'site.css'));

for (const lang of languages) {
  write(join(lang, 'index.html'), homePage(lang));
  write(join(lang, 'privacy', 'index.html'), privacyPage(lang));
}
write('404.html', notFoundPage());

const placeholders = Object.entries(site).filter(([, value]) => /^\[.*\]$/.test(value));
if (placeholders.length) {
  console.warn(`Warning: src/site.json still has placeholders: ${placeholders.map(([key]) => key).join(', ')}`);
}
console.log(`Built ${languages.length} languages into ${DIST}/: ${languages.join(', ')}`);

function write(path, html) {
  mkdirSync(join(DIST, path, '..'), { recursive: true });
  writeFileSync(join(DIST, path), html);
}

function homePage(lang) {
  const t = locales[lang];
  return layout({
    lang,
    title: site.studio,
    description: t.description,
    path: '',
    bodyClass: 'home',
    body: `<main>
      <h1>${logo()}</h1>
    </main>
    <footer>
      <a href="/${lang}/privacy/">${escape(t.privacyLink)}</a>
    </footer>`,
  });
}

function privacyPage(lang) {
  const t = locales[lang].privacy;
  const sections = t.sections
    .map(
      (section) => `<h2>${escape(section.heading)}</h2>
      ${section.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n      ')}`,
    )
    .join('\n      ');
  const email = site.email.includes('@')
    ? `<a href="mailto:${escape(site.email)}">${escape(site.email)}</a>`
    : escape(site.email);
  return layout({
    lang,
    title: `${t.title} – ${site.studio}`,
    description: locales[lang].description,
    path: 'privacy/',
    bodyClass: 'policy',
    body: `<header>
      <a href="/${lang}/">${logo()}</a>
    </header>
    <main>
      <h1>${escape(t.title)}</h1>
      <p class="updated">${escape(t.updated.replace('{date}', formatDate(site.updated, lang)))}</p>
      <p>${escape(t.intro.replace('{company}', site.company))}</p>
      ${sections}
      <h2>${escape(t.contact)}</h2>
      <address>
        ${escape(site.company)}<br>
        ${escape(site.address)}<br>
        ${email}
      </address>
    </main>`,
  });
}

function notFoundPage() {
  return layout({
    lang: DEFAULT_LANGUAGE,
    title: `404 – ${site.studio}`,
    description: locales[DEFAULT_LANGUAGE].description,
    bodyClass: 'home',
    body: `<main>
      <a href="/">${logo()}</a>
    </main>
    <footer>404</footer>`,
  });
}

function logo() {
  return `<picture>
        <source srcset="/assets/logo-dark.png" media="(prefers-color-scheme: dark)">
        <img src="/assets/logo-light.png" alt="${escape(site.studio)}" width="612" height="156">
      </picture>`;
}

/** `path` is the page's path inside a language folder; pages without one (404) get no hreflang links. */
function layout({ lang, title, description, path, bodyClass, body }) {
  const alternates =
    path === undefined
      ? ''
      : [
          ...languages.map((alt) => `<link rel="alternate" hreflang="${alt}" href="/${alt}/${path}">`),
          `<link rel="alternate" hreflang="x-default" href="/${path ? `${DEFAULT_LANGUAGE}/${path}` : ''}">`,
        ].join('\n    ');
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}">
    <link rel="stylesheet" href="/assets/site.css">
    ${alternates}
  </head>
  <body class="${bodyClass}">
    ${body}
  </body>
</html>
`;
}

/** A real date (YYYY-MM-DD) is written out in the page's language; a placeholder is shown as is. */
function formatDate(value, lang) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));
}

function escape(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Every language must define every key, and have the same privacy sections as English. */
function checkLocales() {
  const shape = (value) =>
    Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]))
        : typeof value;
  const expected = JSON.stringify(shape(locales[DEFAULT_LANGUAGE]));
  const mismatched = languages.filter((lang) => JSON.stringify(shape(locales[lang])) !== expected);
  if (mismatched.length) {
    throw new Error(`Locales differ in structure from ${DEFAULT_LANGUAGE}.json: ${mismatched.join(', ')}`);
  }
}

/** The root redirect in nginx can only send visitors to languages that exist, and should reach all of them. */
function checkNginxLanguages() {
  const conf = readFileSync(join('nginx', 'snippets', 'language.conf'), 'utf8');
  const targets = new Set([...conf.matchAll(/^\s*(?:default|"[^"]*"|\S+)\s+([\w-]+);/gm)].map((m) => m[1]));
  const unknown = [...targets].filter((lang) => !languages.includes(lang));
  const unreachable = languages.filter((lang) => !targets.has(lang));
  if (unknown.length || unreachable.length) {
    throw new Error(
      `nginx/snippets/language.conf is out of sync with src/locales: ` +
        `unknown [${unknown.join(', ')}], unreachable [${unreachable.join(', ')}]`,
    );
  }
}
