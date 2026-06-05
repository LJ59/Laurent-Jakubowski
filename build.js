const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const markdownPath = path.join(ROOT, 'index.md');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function inlineMarkdown(text) {
  let output = escapeHtml(text);

  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  output = autolink(output);

  return output;
}

function autolink(html) {
  const placeholders = [];
  html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, match => {
    const token = `@@LINK_${placeholders.length}@@`;
    placeholders.push(match);
    return token;
  });

  html = html.replace(/\bhttps?:\/\/[^\s<]+/g, url => `<a href="${url}">${url}</a>`);
  html = html.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, email => `<a href="mailto:${email}">${email}</a>`);
  html = html.replace(/(^|[\s>])((?:\+33|0)[1-9](?:[ .-]?\d{2}){4})(?=$|[\s<,.])/g, (_, before, phone) => {
    const clean = phone.replace(/\D/g, '').replace(/^33/, '+33');
    return `${before}<a href="tel:${clean}">${phone}</a>`;
  });

  placeholders.forEach((value, index) => {
    html = html.replace(`@@LINK_${index}@@`, value);
  });

  return html;
}

function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  let quote = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  }
  function flushList() {
    if (!list.length) return;
    blocks.push({ type: 'list', items: list });
    list = [];
  }
  function flushQuote() {
    if (!quote.length) return;
    blocks.push({ type: 'quote', text: quote.join('<br>') });
    quote = [];
  }
  function flushAll() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushAll();
      continue;
    }

    const hr = line.trim().match(/^---+$/);
    if (hr) {
      flushAll();
      blocks.push({ type: 'hr' });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushQuote();
      list.push(bullet[1]);
      continue;
    }

    const blockquote = line.match(/^>\s?(.+)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

function renderBlocks(blocks, options = {}) {
  const usedSlugs = new Map();
  const nav = [];
  const html = blocks.map(block => {
    if (block.type === 'heading') {
      const base = slugify(block.text);
      const count = usedSlugs.get(base) || 0;
      usedSlugs.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      if (block.level === 2) nav.push({ id, label: cleanHeading(block.text) });
      return `<h${block.level} id="${id}">${inlineMarkdown(block.text)}</h${block.level}>`;
    }
    if (block.type === 'paragraph') return `<p>${inlineMarkdown(block.text)}</p>`;
    if (block.type === 'quote') return `<blockquote>${inlineMarkdown(block.text)}</blockquote>`;
    if (block.type === 'list') return `<ul>${block.items.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`;
    if (block.type === 'hr') return '<hr>';
    return '';
  }).join('\n');

  return { html, nav };
}

function cleanHeading(text) {
  return text.replace(/[*_`]/g, '').trim();
}

function extractTitle(blocks) {
  const firstH1 = blocks.find(block => block.type === 'heading' && block.level === 1);
  return firstH1 ? cleanHeading(firstH1.text) : 'CV';
}

function extractImage(markdown) {
  const match = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  if (!match) return null;
  return { alt: match[1], src: match[2] };
}

function groupSections(blocks) {
  const sections = [];
  let current = { title: 'Introduction', blocks: [] };
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2) {
      if (current.blocks.length) sections.push(current);
      current = { title: cleanHeading(block.text), blocks: [block] };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.blocks.length) sections.push(current);
  return sections;
}

function isExperienceTitle(title) {
  return slugify(title).includes('experiences-professionnelles') || slugify(title).includes('experience-professionnelle') || slugify(title) === 'experiences';
}

function renderEnhanced(blocks, markdown) {
  const title = extractTitle(blocks);
  const image = extractImage(markdown);
  const sections = groupSections(blocks);
  const nav = [];
  const usedSlugs = new Map();

  const heroParts = [];
  const intro = sections[0];
  const heroQuote = intro.blocks.find(block => block.type === 'quote');
  const heroTitle = blocks.find(block => block.type === 'heading' && block.level === 1);

  heroParts.push('<section class="cv-hero" aria-labelledby="cv-title">');
  heroParts.push('<div class="cv-hero__text">');
  if (heroTitle) heroParts.push(`<h1 id="cv-title">${inlineMarkdown(heroTitle.text)}</h1>`);
  if (heroQuote) heroParts.push(`<p class="cv-hero__lead">${inlineMarkdown(heroQuote.text)}</p>`);
  heroParts.push('</div>');
  if (image) heroParts.push(`<img class="cv-hero__image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || 'Photo de profil')}">`);
  heroParts.push('</section>');

  const body = sections
    .filter(section => section.title !== 'Introduction')
    .map(section => {
      const base = slugify(section.title);
      const count = usedSlugs.get(base) || 0;
      usedSlugs.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      nav.push({ id, label: section.title });

      const sectionBlocks = section.blocks.slice(1);
      if (isExperienceTitle(section.title)) {
        return `<section class="cv-section" id="${id}"><h2>${inlineMarkdown(section.title)}</h2>${renderTimeline(sectionBlocks)}</section>`;
      }
      return `<section class="cv-section" id="${id}"><h2>${inlineMarkdown(section.title)}</h2>${renderBlocks(sectionBlocks).html}</section>`;
    })
    .join('\n');

  return { html: heroParts.join('\n') + body, nav, title };
}

function renderTimeline(blocks) {
  const entries = [];
  let current = null;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 3) {
      if (current) entries.push(current);
      current = { company: block.text, blocks: [] };
    } else if (current) {
      current.blocks.push(block);
    } else {
      if (!current) current = { company: '', blocks: [] };
      current.blocks.push(block);
    }
  }
  if (current) entries.push(current);

  return `<div class="cv-timeline">${entries.map(entry => {
    const meta = extractMeta(entry.company);
    const content = renderBlocks(entry.blocks).html;
    return `<article class="cv-timeline__item">
      <div class="cv-timeline__marker" aria-hidden="true"></div>
      <div class="cv-timeline__content">
        ${meta.period ? `<p class="cv-timeline__date">${inlineMarkdown(meta.period)}</p>` : ''}
        ${meta.title ? `<h3>${inlineMarkdown(meta.title)}</h3>` : ''}
        ${content}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function extractMeta(text) {
  const match = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { title: match[1].trim(), period: match[2].trim() };
  return { title: text.trim(), period: '' };
}

function pageTemplate({ title, nav, content, current }) {
  const navItems = nav.map(item => `<a href="#${item.id}">${escapeHtml(item.label)}</a>`).join('');
  const switchLinks = current === 'strict'
    ? '<a class="cv-version" href="enrichi.html">Version enrichie</a>'
    : '<a class="cv-version" href="index.html">Version stricte</a>';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="CV en ligne genere depuis un fichier Markdown.">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="assets/styles.css">
  <script src="assets/script.js" defer></script>
</head>
<body>
  <header class="cv-topbar">
    <a class="cv-brand" href="index.html">${escapeHtml(title)}</a>
    <nav class="cv-nav" aria-label="Navigation principale">${navItems}${switchLinks}</nav>
    <button class="cv-theme-toggle" type="button" aria-label="Changer le theme" data-theme-toggle>☾</button>
  </header>
  <main class="cv-page cv-page--${current}">
    ${content}
  </main>
</body>
</html>`;
}

function copyAssets() {
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(SRC, 'styles.css'), path.join(DIST, 'assets', 'styles.css'));
  fs.copyFileSync(path.join(SRC, 'script.js'), path.join(DIST, 'assets', 'script.js'));
  if (fs.existsSync(path.join(ROOT, '_headers'))) fs.copyFileSync(path.join(ROOT, '_headers'), path.join(DIST, '_headers'));
}

function build() {
  if (!fs.existsSync(markdownPath)) throw new Error('index.md est introuvable.');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  copyAssets();

  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const blocks = parseBlocks(markdown);
  const title = extractTitle(blocks);

  const strict = renderBlocks(blocks);
  fs.writeFileSync(path.join(DIST, 'index.html'), pageTemplate({ title, nav: strict.nav, content: `<article class="cv-card cv-markdown">${strict.html}</article>`, current: 'strict' }));

  const enriched = renderEnhanced(blocks, markdown);
  fs.writeFileSync(path.join(DIST, 'enrichi.html'), pageTemplate({ title: enriched.title, nav: enriched.nav, content: enriched.html, current: 'enriched' }));

  console.log('Build termine : dist/index.html et dist/enrichi.html');
}

build();
