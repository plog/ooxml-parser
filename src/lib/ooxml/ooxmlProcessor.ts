import { MergeField, IfField } from './types';

export class OoxmlProcessor {
  private xmlDoc: Document;
  private static WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  constructor(xmlString: string) {
    this.xmlDoc = this.parseXmlString(xmlString);
  }

  private parseXmlString(xmlString: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'application/xml');
  }

  private serializeXmlDocument(xmlDoc: Document): string {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  }

  public processMergeFields(): string {
    // Find all MERGEFIELD instructions
    const mergeFieldInstructions = this.findMergeFieldInstructions();
    
    mergeFieldInstructions.forEach(instruction => {
      this.processSingleMergeField(instruction);
    });

    return this.serializeXmlDocument(this.xmlDoc);
  }

  public processIfFields(data: Record<string, any>): string {
    // Find all IF field instructions
    const ifFieldInstructions = this.findIfFieldInstructions();
    
    ifFieldInstructions.forEach(instruction => {
      this.processSingleIfField(instruction, data);
    });

    return this.serializeXmlDocument(this.xmlDoc);
  }

  private findMergeFieldInstructions(): Element[] {
    const instructions: Element[] = [];
    const instrTextElements = this.xmlDoc.getElementsByTagNameNS(
      OoxmlProcessor.WORD_NAMESPACE,
      "instrText"
    );
    
    for (let i = 0; i < instrTextElements.length; i++) {
      const instrText = instrTextElements[i];
      const text = instrText.textContent?.trim() || '';
      if (text.indexOf('MERGEFIELD') === 0) {
        instructions.push(instrText);
      }
    }
    
    return instructions;
  }

  private findIfFieldInstructions(): Element[] {
    const instructions: Element[] = [];
    const instrTextElements = this.xmlDoc.getElementsByTagNameNS(
      OoxmlProcessor.WORD_NAMESPACE,
      "instrText"
    );
    
    for (let i = 0; i < instrTextElements.length; i++) {
      const instrText = instrTextElements[i];
      const text = instrText.textContent?.trim() || '';
      if (text.indexOf('IF ') === 0) {
        instructions.push(instrText);
      }
    }
    
    return instructions;
  }

  private processSingleMergeField(instrTextElement: Element): void {
    // Find the field structure: begin -> instrText -> separate -> placeholder -> end
    const beginElement = this.findPreviousFldChar(instrTextElement, 'begin');
    const separateElement = this.findNextFldChar(instrTextElement, 'separate');
    const endElement = this.findNextFldChar(separateElement, 'end');
    
    if (!beginElement || !separateElement || !endElement) {
      console.warn('Incomplete MERGEFIELD structure found');
      return;
    }

    // Extract field name from instrText
    const instrText = instrTextElement.textContent?.trim() || '';
    const fieldName = this.extractMergeFieldName(instrText);
    
    // Find the placeholder text element (between separate and end)
    const placeholderElement = this.findPlaceholderTextElement(separateElement, endElement);
    
    if (placeholderElement) {
      // Replace placeholder with dots and add invisible field name
      this.replacePlaceholderWithDots(placeholderElement, fieldName);
    }
  }

  private processSingleIfField(instrTextElement: Element, data: Record<string, any>): void {
    // Find the field structure: begin -> instrText -> separate -> placeholder -> end
    const beginElement = this.findPreviousFldChar(instrTextElement, 'begin');
    const separateElement = this.findNextFldChar(instrTextElement, 'separate');
    const endElement = this.findNextFldChar(separateElement, 'end');
    
    if (!beginElement || !separateElement || !endElement) {
      console.warn('Incomplete IF field structure found');
      return;
    }

    // Parse the IF statement
    const instrText = instrTextElement.textContent?.trim() || '';
    const ifCondition = this.parseIfStatement(instrText);
    
    if (!ifCondition) {
      console.warn('Could not parse IF statement:', instrText);
      return;
    }

    // Evaluate the condition
    const conditionResult = this.evaluateIfCondition(ifCondition, data);
    
    // Find the content after the end tag
    const contentAfterEnd = this.findContentAfterIfEnd(endElement);
    
    // Process the content based on condition result
    this.processIfContent(contentAfterEnd, conditionResult);
  }

  private parseIfStatement(instrText: string): IfField | null {
    // Parse IF statement: IF "variable" operator "value" "%iftrue%" "%iffalse%"
    const ifMatch = instrText.match(/IF\s+"([^"]+)"\s*([=<>!]+)\s*"([^"]+)"\s*"([^"]*)"\s*"([^"]*)"/);
    
    if (!ifMatch) {
      return null;
    }

    const [, variable, operator, value, trueContent, falseContent] = ifMatch;
    
    return {
      condition: `${variable} ${operator} ${value}`,
      trueContent,
      falseContent
    };
  }

  private evaluateIfCondition(ifField: IfField, data: Record<string, any>): boolean {
    // Extract variable, operator, and value from condition
    const conditionMatch = ifField.condition.match(/([^\s]+)\s*([=<>!]+)\s*(.+)/);
    
    if (!conditionMatch) {
      return false;
    }

    const [, variable, operator, expectedValue] = conditionMatch;
    const actualValue = this.getNestedValue(data, variable);
    
    switch (operator) {
      case '=':
      case '==':
        return String(actualValue) === expectedValue;
      case '!=':
      case '<>':
        return String(actualValue) !== expectedValue;
      case '>':
        return Number(actualValue) > Number(expectedValue);
      case '<':
        return Number(actualValue) < Number(expectedValue);
      case '>=':
        return Number(actualValue) >= Number(expectedValue);
      case '<=':
        return Number(actualValue) <= Number(expectedValue);
      default:
        return false;
    }
  }

  private getNestedValue(data: Record<string, any>, path: string): any {
    // Handle nested object access like "step.question.value"
    return path.split('.').reduce((obj, key) => obj?.[key], data);
  }

  private findContentAfterIfEnd(endElement: Element): Element[] {
    const content: Element[] = [];
    let currentElement = endElement.parentElement?.nextElementSibling;
    
    while (currentElement) {
      // Look for %end% marker to stop
      const textElements = currentElement.querySelectorAll('w\\:t');
      let foundEnd = false;
      
      for (let i = 0; i < textElements.length; i++) {
        const textEl = textElements[i];
        if (textEl.textContent && textEl.textContent.indexOf('%end%') !== -1) {
          foundEnd = true;
          break;
        }
      }
      
      if (foundEnd) {
        content.push(currentElement);
        break;
      }
      
      content.push(currentElement);
      currentElement = currentElement.nextElementSibling;
    }
    
    return content;
  }

  private processIfContent(contentElements: Element[], showTrueBranch: boolean): void {
    let inTrueBranch = true;
    let foundElse = false;
    
    contentElements.forEach(element => {
      const textElements = element.querySelectorAll('w\\:t');
      
      textElements.forEach(textEl => {
        const text = textEl.textContent || '';
        
        if (text.indexOf('%else%') !== -1) {
          foundElse = true;
          inTrueBranch = false;
          // Remove the %else% marker
          textEl.textContent = text.replace('%else%', '');
        }
        
        if (text.indexOf('%end%') !== -1) {
          // Remove the %end% marker
          textEl.textContent = text.replace('%end%', '');
        }
      });
      
      // Hide/show element based on condition and current branch
      const shouldShow = showTrueBranch ? inTrueBranch : !inTrueBranch;
      
      if (!shouldShow) {
        // Hide the element by removing it or setting display:none
        element.remove();
      }
    });
  }

  private findPreviousFldChar(startElement: Element, fldCharType: string): Element | null {
    let currentElement = startElement.parentElement;
    
    while (currentElement) {
      const fldChar = currentElement.querySelector(`w\\:fldChar[w\\:fldCharType="${fldCharType}"]`);
      if (fldChar) {
        return fldChar;
      }
      currentElement = currentElement.previousElementSibling as HTMLElement | null;
    }
    
    return null;
  }

  private findNextFldChar(startElement: Element | null, fldCharType: string): Element | null {
    if (!startElement) return null;
    
    let currentElement = startElement.parentElement?.nextElementSibling;
    
    while (currentElement) {
      const fldChar = currentElement.querySelector(`w\\:fldChar[w\\:fldCharType="${fldCharType}"]`);
      if (fldChar) {
        return fldChar;
      }
      currentElement = currentElement.nextElementSibling;
    }
    
    return null;
  }

  private extractMergeFieldName(instrText: string): string {
    // Extract field name from "MERGEFIELD fieldname" or "MERGEFIELD fieldname.subfield"
    const match = instrText.match(/MERGEFIELD\s+([^\s]+)/);
    return match ? match[1] : '';
  }

  private findPlaceholderTextElement(separateElement: Element, endElement: Element): Element | null {
    let currentElement = separateElement.parentElement?.nextElementSibling;
    
    while (currentElement && currentElement !== endElement.parentElement) {
      const textElement = currentElement.querySelector('w\\:t');
      if (textElement) {
        return textElement;
      }
      currentElement = currentElement.nextElementSibling;
    }
    
    return null;
  }

  private replacePlaceholderWithDots(textElement: Element, fieldName: string): void {
    // Replace text content with dots
    textElement.textContent = '..........';
    
    // Add invisible field name as a data attribute or comment for LLM processing
    textElement.setAttribute('data-merge-field', fieldName);
    
    // Optionally add an invisible comment node for LLM
    const comment = this.xmlDoc.createComment(`MERGEFIELD:${fieldName}`);
    textElement.parentNode?.insertBefore(comment, textElement);
  }

  static fromString(xml: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xml, 'application/xml');
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
        const elements = Array.from(this.xmlDoc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, tag));
        elements.forEach(el => {
          el.parentNode?.removeChild(el);
        });
      });

      // Remove empty <w:r> and <w:p> elements until none remain
      const removeAllEmpty = (tag: string) => {
        let removed: boolean;
        do {
          removed = false;
          const elements = Array.from(this.xmlDoc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, tag));
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
      const paragraphs = Array.from(this.xmlDoc.getElementsByTagNameNS(OoxmlProcessor.WORD_NAMESPACE, 'p'));
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


      // Serialize and remove empty lines from the XML string
      let xmlString = this.serializeXmlDocument(this.xmlDoc);
      xmlString = xmlString
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');

      return xmlString;
    }  
}

