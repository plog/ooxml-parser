// src/OoxmlProcessor.ts

export interface IfField {
  left: string;
  operator: string;
  right: string;
  ifTrue: string | string[] | IfField[];
  ifFalse: string | string[] | IfField[];
}

export interface FieldJsonStructure {
  mergeFields: string[];
  ifFields: IfField[];
}

export class OoxmlProcessor {
  private xml: string;
  private doc: Document | null = null;
  private static WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  constructor(xml: string) {
    this.xml = xml;
    this.parse();
  }

  parse(): void {
    const parser = new DOMParser();
    this.doc = parser.parseFromString(this.xml, 'application/xml');
  }

  getTextContent(): string[] {
    if (!this.doc) return [];
    const textElements = this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 't');
    return Array.from(textElements).map(el => el.textContent ?? '').filter(Boolean);
  }

  getMergeFields(): string[] {
    if (!this.doc) return [];
    const fields: string[] = [];
    const instrTextNodes = this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'instrText');

    Array.from(instrTextNodes).forEach(el => {
      const match = el.textContent?.match(/MERGEFIELD\s+([^\s"]+)/);
      if (match) fields.push(match[1]);
    });

    return fields;
  }

  getIfFields(): IfField[] {
    if (!this.doc) return [];
    const runs = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'r'));

    const extractFields = (startIndex: number): [IfField, number] => {
      const instrText = runs[startIndex + 1]?.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'instrText')[0];
      if (!instrText || !instrText.textContent?.trim().startsWith('IF')) throw new Error('Invalid IF structure');

      const conditionFullMatch = instrText.textContent.trim().match(/^IF\s+(.+?)\s+"%iftrue%"\s+"%iffalse%"/);
      if (!conditionFullMatch) throw new Error('Invalid condition format');

      const condition = conditionFullMatch[1];
      const condMatch = condition.match(/^("?[^\"]+"?)\s*(=|<>|<=|>=|<|>)\s*("?[^\"]+"?)$/);
      let left = '', operator = '', right = '';
      if (condMatch) {
        left = condMatch[1].trim().replace(/^"(.*)"$/, '$1');
        operator = condMatch[2].trim();
        right = condMatch[3].trim().replace(/^"(.*)"$/, '$1');
      } else {
        left = condition;
      }

      let trueText: (string | IfField)[] = [], falseText: (string | IfField)[] = [];
      let current: 'true' | 'false' = 'true';
      let depth = 1;
      let j = startIndex + 2;

      while (j < runs.length && depth > 0) {
        const fldChar = runs[j].getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'fldChar')[0];
        const instr = runs[j].getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'instrText')[0];
        const t = runs[j].getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 't')[0];

        if (fldChar && fldChar.getAttribute('w:fldCharType') === 'begin') {
          const [nestedIf, offset] = extractFields(j);
          (current === 'true' ? trueText : falseText).push(nestedIf);
          j = offset;
          continue;
        }

        if (t?.textContent?.includes('%else%')) {
          current = 'false';
        } else if (t?.textContent?.includes('%end%')) {
          depth--;
        } else if (t?.textContent && t.textContent.trim() !== '{IF}') {
          (current === 'true' ? trueText : falseText).push(t.textContent);
        }

        j++;
      }

      function normalizeResult(arr: (string | IfField)[]): string | string[] | IfField[] {
        if (arr.length === 1) {
          if (typeof arr[0] === 'string') return arr[0];
          else return [arr[0] as IfField];
        }
        // If all elements are strings, return string[]
        if (arr.every(item => typeof item === 'string')) {
          return arr as string[];
        }
        // If all elements are IfField, return IfField[]
        if (arr.every(item => typeof item !== 'string')) {
          return arr as IfField[];
        }
        // Otherwise, filter to only strings or only IfField[]
        // (You may want to handle mixed arrays differently depending on your use case)
        return arr.filter(item => typeof item === 'string') as string[];
      }

      return [{
        left,
        operator,
        right,
        ifTrue: normalizeResult(trueText),
        ifFalse: normalizeResult(falseText),
      }, j];
    };

    const ifFields: IfField[] = [];
    for (let i = 0; i < runs.length; i++) {
      const fldChar = runs[i].getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'fldChar')[0];
      if (!fldChar || fldChar.getAttribute('w:fldCharType') !== 'begin') continue;

      const instrText = runs[i + 1]?.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'instrText')[0];
      if (!instrText || !instrText.textContent?.trim().startsWith('IF')) continue;

      try {
        const [parsedIf, nextIndex] = extractFields(i);
        ifFields.push(parsedIf);
        i = nextIndex;
      } catch {
        continue;
      }
    }

    return ifFields;
  }

  extractFieldsAsJson(): FieldJsonStructure {
    return {
      mergeFields: this.getMergeFields(),
      ifFields: this.getIfFields(),
    };
  }

  private serializeXmlDocument(doc: Document): string {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  public simplifyXml(): string {
    const tagsToRemove = ['tabs', 'rFonts', 'drawing', 'pStyle', 'rPr', 'pPr', 'tcPr','tblPr', 'tblGrid'];

    tagsToRemove.forEach(tag => {
      if (!this.doc) return;
      const elements = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, tag));
      elements.forEach(el => {
        el.parentNode?.removeChild(el);
      });
    });

    const removeAllEmpty = (tag: string) => {
      let removed: boolean;
      do {
        removed = false;
        if (!this.doc) return;
        const elements = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, tag));
        elements.forEach(el => {
          if (
            (!el.textContent || !el.textContent.trim()) &&
            Array.from(el.childNodes).every(
              n => n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()
            )
          ) {
            el.parentNode?.removeChild(el);
            removed = true;
          }
        });
      } while (removed);
    };
    removeAllEmpty('r');
    removeAllEmpty('p');

    if (this.doc) {
      const paragraphs = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'p'));
      paragraphs.forEach(p => {
        const pChildren = Array.from(p.childNodes).filter(
          n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
        );
        if (
          pChildren.length === 1 &&
          pChildren[0].nodeType === Node.ELEMENT_NODE &&
          (pChildren[0] as Element).localName === 'r'
        ) {
          const r = pChildren[0] as Element;
          const rChildren = Array.from(r.childNodes).filter(
            n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
          );
          if (
            rChildren.length === 1 &&
            rChildren[0].nodeType === Node.ELEMENT_NODE &&
            (rChildren[0] as Element).localName === 'br' &&
            (rChildren[0] as Element).namespaceURI === OoxmlProcessor.WORD_NAMESPACE &&
            (rChildren[0] as Element).getAttribute('w:type') === 'textWrapping'
          ) {
            p.parentNode?.removeChild(p);
          }
        }
      });
    }

    if (!this.doc) return '';
    let xmlString = this.serializeXmlDocument(this.doc);
    xmlString = xmlString
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');

    return xmlString;
  }
}
