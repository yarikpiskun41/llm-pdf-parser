import xml2js from 'xml2js';
import { DocumentBlock } from '../types/job.types';
import { v4 as uuidv4 } from 'uuid';

const parser = new xml2js.Parser({
  explicitArray: false,
  mergeAttrs: true,
  charkey: 'textContent'
});

const getText = (element: any): string => {
  if (!element) return '';
  if (typeof element === 'string') return element.trim();
  if (element.textContent && typeof element.textContent === 'string') {
    return element.textContent.trim();
  }
  let combinedText = '';
  if (element.p) {
    const paragraphs = Array.isArray(element.p) ? element.p : [element.p];
    combinedText = paragraphs.map((p: any) => getText(p)).join('\n');
  }
  else if (element.row) {
    const rows = Array.isArray(element.row) ? element.row : [element.row];
    combinedText = rows.map((row: any) => {
      if (row.cell) {
        const cells = Array.isArray(row.cell) ? row.cell : [row.cell];
        return cells.map((cell: any) => getText(cell)).join(' | ').trim();
      } return '';
    }).filter(Boolean).join('\n');
  }
  else if (element.head) { combinedText = getText(element.head); }
  else if (element.item) {
    const items = Array.isArray(element.item) ? element.item : [element.item];
    combinedText = items.map((item: any) => `- ${getText(item)}`).join('\n');
  }
  else if (typeof element === 'object') {
    combinedText = Object.values(element)
      .filter(val => typeof val === 'string' || typeof val === 'object')
      .map(val => getText(val))
      .filter(Boolean)
      .join(' ');
  }
  return combinedText.replace(/\s+/g, ' ').trim();
};

const getPreview = (text: string, length: number = 150): string => {
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  if (cleanedText.length <= length) { return cleanedText; }
  return cleanedText.substring(0, length) + '...';
};


export const parseGrobidXml = async (xmlString: string): Promise<DocumentBlock[]> => {
  const blocks: DocumentBlock[] = [];
  try {
    const result = await parser.parseStringPromise(xmlString);
    const tei = result?.TEI;
    if (!tei) throw new Error('Invalid TEI structure: Missing TEI root element');

    const header = tei.teiHeader;
    const text = tei.text;
    const body = text?.body;

    const titleStmt = header?.fileDesc?.titleStmt;
    const mainTitle = titleStmt?.title?.find?.((t: any) => t.type === 'main') || titleStmt?.title;
    if (mainTitle) {
      const content = getText(mainTitle);
      if (content) blocks.push({ id: 'title_' + uuidv4(), type: 'title', label: 'Title', content, preview: getPreview(content) });
    }
    const authorsXml = header?.fileDesc?.titleStmt?.author;
    if (authorsXml) {
      const authorList = Array.isArray(authorsXml) ? authorsXml : [authorsXml];
      const authorNames = authorList.map((auth: any) => {
        const name = auth?.persName;
        if (!name) return null;
        const forename = name.forename ? (Array.isArray(name.forename) ? name.forename[0]?.textContent || name.forename[0] : name.forename?.textContent || name.forename) : '';
        const surname = name.surname ? name.surname?.textContent || name.surname : '';
        return `${forename || ''} ${surname || ''}`.trim();
      }).filter(name => name && name.length > 0);

      if (authorNames.length > 0) {
        const content = authorNames.join(', ');
        blocks.push({ id: 'authors_' + uuidv4(), type: 'authors', label: 'Authors', content: content, preview: getPreview(content) });
      }
    }
    const abstract = header?.profileDesc?.abstract;
    if (abstract) {
      const content = getText(abstract);
      if (content) blocks.push({ id: 'abstract_' + uuidv4(), type: 'abstract', label: 'Abstract', content, preview: getPreview(content) });
    }

    if (body) {
      const bodyChildren: any[] = [];
      for (const key in body) {
        if (key === 'xml:lang' || key === '$' || key === 'textContent') continue;
        const element = body[key];
        if (Array.isArray(element)) {
          bodyChildren.push(...element.map((el: any) => ({ ...el, tagName: key })));
        } else if (element !== null && typeof element === 'object') {
          bodyChildren.push({ ...element, tagName: key });
        }
      }

      let sectionCounter = 1;
      let figureCounter = 1;
      let paragraphCounter = 1;

      bodyChildren.forEach((child: any) => {
        const tagName = child.tagName;
        let id = '';

        if (tagName === 'div') {
          const head = child.head;
          const content = getText(child);
          let label = `Section ${sectionCounter++}`;
          if (head) label = getText(head) || label;
          id = `section_${uuidv4()}`;
          if(content) blocks.push({ id, type: 'section', label, content, preview: getPreview(content), level: 1 });
        }
        else if (tagName === 'figure') {
          const figureXmlId = child['xml:id'] || `figure_${figureCounter++}`;

          if (child.figDesc) {
            const content = getText(child.figDesc);
            const label = `${figureXmlId} Description`;
            id = `fig_desc_${uuidv4()}`;
            if (content) blocks.push({ id, type: 'figure_description', label, content, preview: getPreview(content) });
          }
          if (child.table) {
            const content = getText(child.table);
            const label = `${figureXmlId} Table`;
            id = `fig_table_${uuidv4()}`;
            if (content) blocks.push({ id, type: 'figure_table', label, content, preview: getPreview(content) });
          }
          if (child.head) {
            const content = getText(child.head);
            const label = `${figureXmlId} Caption`;
            id = `fig_caption_${uuidv4()}`;
            if (content) blocks.push({ id, type: 'figure_caption', label, content, preview: getPreview(content) });
          }
        }
        else if (tagName === 'p') {
          const content = getText(child);
          const label = `Paragraph ${paragraphCounter++}`;
          id = `paragraph_${uuidv4()}`;
          if (content) blocks.push({ id, type: 'paragraph', label, content, preview: getPreview(content) });
        }
      });
    }

    const back = text?.back;
    const biblStructs = back?.div?.listBibl?.biblStruct;
    if (biblStructs) {
      const refs = Array.isArray(biblStructs) ? biblStructs : [biblStructs];
      const referencesContent = refs.map((ref: any, index: number) => {
        const analytic = ref.analytic;
        const monogr = ref.monogr;
        const authors = analytic?.author || monogr?.author;
        let authorStr = '';
        if (authors) {
          const authorList = Array.isArray(authors) ? authors : [authors];
          authorStr = authorList.map((a: any) => getText(a.persName?.surname) || '').filter(Boolean).join(', ');
        }
        const titleStr = getText(analytic?.title) || getText(monogr?.title) || 'No Title';
        const date = getText(monogr?.imprint?.date);
        const journalTitle = getText(monogr?.title);
        const volume = monogr?.imprint?.biblScope?.find?.((s:any) => s.unit === 'volume')?.textContent;
        const page = monogr?.imprint?.biblScope?.find?.((s:any) => s.unit === 'page')?.from;
        let refString = `${index + 1}. ${authorStr}`;
        if(date) refString += ` (${date})`;
        refString += `. ${titleStr}.`;
        if(journalTitle && journalTitle !== titleStr) refString += ` *${journalTitle}*`;
        if(volume) refString += `, ${volume}`;
        if(page) refString += `, ${page}`;
        return refString.replace(/\s+/g, ' ').trim();
      }).filter(Boolean).join('\n');

      if (referencesContent) {
        blocks.push({
          id: 'references_' + uuidv4(),
          type: 'references',
          label: 'References',
          content: referencesContent,
          preview: getPreview(referencesContent)
        });
      }
    }

  } catch (error: any) {
    console.error('[XML Parser] Error parsing GROBID XML:', error.message);
    console.error(error.stack);
    return [];
  }

  const finalBlocks = blocks.filter(block => block.content && block.content.length > 0);
  console.log(`[XML Parser] Extracted ${finalBlocks.length} blocks.`);
  return finalBlocks;
};