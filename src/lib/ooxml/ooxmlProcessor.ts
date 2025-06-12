// src/OoxmlProcessor.ts

export interface IfField {
  left: string;
  operator: string;
  right: string;
  ifTrue: string | string[];
  ifFalse: string | string[];
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
    // Use getElementsByTagNameNS for namespaced elements
    const textElements = this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 't');
    return Array.from(textElements).map(el => el.textContent ?? '').filter(Boolean);
  }

  getMergeFields(): string[] {
    if (!this.doc) return [];
    const fields: string[] = [];
    // Use getElementsByTagNameNS for w:instrText
    const instrTextNodes = this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'instrText');

    Array.from(instrTextNodes).forEach(el => {
      const match = el.textContent?.match(/MERGEFIELD\s+([^\s"]+)/);
      if (match) fields.push(match[1]);
    });

    return fields;
  }

  getIfFields(): IfField[] {
    if (!this.doc) return [];
    const ifFields: IfField[] = [];
    const runs = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'r'));

    for (let i = 0; i < runs.length; i++) {
      const fldChar = runs[i].getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'fldChar')[0];
      if (!fldChar || fldChar.getAttribute('w:fldCharType') !== 'begin') continue;

      const instrText = runs[i + 1]?.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'instrText')[0];
      if (!instrText || !instrText.textContent?.trim().startsWith('IF')) continue;

      // Extract the condition string
      const conditionFullMatch = instrText.textContent.trim().match(/^IF\s+(.+?)\s+"%iftrue%"\s+"%iffalse%"/);
      if (!conditionFullMatch) continue;

      const condition = conditionFullMatch[1];

      // Try to split the condition into left, operator, right
      // Handles quoted left/right, and operators (=, <>, <, >, <=, >=)
      const condMatch = condition.match(/^("?[^"]+"?)\s*(=|<>|<=|>=|<|>)\s*("?[^"]+"?)$/);
      let left = '', operator = '', right = '';
      if (condMatch) {
        left = condMatch[1].trim().replace(/^"(.*)"$/, '$1');
        operator = condMatch[2].trim();
        right = condMatch[3].trim().replace(/^"(.*)"$/, '$1');
      } else {
        left = condition;
      }

      let trueText: string[] = [], falseText: string[] = [];
      let current: 'true' | 'false' = 'true';
      let j = i + 2;

      while (j < runs.length) {
        const t = runs[j].getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 't')[0];
        if (t?.textContent?.includes('%end%')) break;

        if (t?.textContent?.includes('%else%')) {
          current = 'false';
        } else if (t?.textContent) {
          // Remove "{IF}" nodes from ifTrue/ifFalse
          if (t.textContent.trim() !== '{IF}') {
            (current === 'true' ? trueText : falseText).push(t.textContent);
          }
        }

        j++;
      }

      ifFields.push({
        left,
        operator,
        right,
        ifTrue: trueText.length === 1 ? trueText[0] : trueText,
        ifFalse: falseText.length === 1 ? falseText[0] : falseText,
      });
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

  /**
   * Simplifies the XML document by removing unnecessary tags and empty elements.
   * 
   * @returns {string} The simplified XML as a string.
   */
  public simplifyXml(): string {
      // Tags to remove completely
      const tagsToRemove = ['tabs', 'rFonts', 'drawing', 'pStyle', 'rPr', 'pPr', 'tcPr','tblPr', 'tblGrid'];

      tagsToRemove.forEach(tag => {
        if (!this.doc) return;
        const elements = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, tag));
        elements.forEach(el => {
          el.parentNode?.removeChild(el);
        });
      });

      // Remove empty <w:r> and <w:p> elements until none remain
      const removeAllEmpty = (tag: string) => {
        let removed: boolean;
        do {
          removed = false;
          if (!this.doc) return;
          const elements = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, tag));
          elements.forEach(el => {
            // Remove if no element/text children or only whitespace
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

      // Remove <w:p> containing only one <w:r> with one <w:br w:type="textWrapping"/>
      if (this.doc) {
        const paragraphs = Array.from(this.doc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'p'));
        paragraphs.forEach(p => {
          // Get non-whitespace child elements of <w:p>
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


      // Serialize and remove empty lines from the XML string
      if (!this.doc) return '';
      let xmlString = this.serializeXmlDocument(this.doc);
      xmlString = xmlString
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');

      return xmlString;
    }  


}
