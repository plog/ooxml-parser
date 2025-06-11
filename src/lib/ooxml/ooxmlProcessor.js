export class OoxmlProcessor {
  constructor(xmlString) {
    this.xmlDoc = this.parseXmlString(xmlString);
  }

  parseXmlString(xmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'application/xml');
  }

  serializeXmlDocument(xmlDoc) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  }

  processMergeFields() {
    // Find all MERGEFIELD instructions
    const mergeFieldInstructions = this.findMergeFieldInstructions();
    
    mergeFieldInstructions.forEach(instruction => {
      this.processSingleMergeField(instruction);
    });

    return this.serializeXmlDocument(this.xmlDoc);
  }

  processIfFields(data) {
    // Find all IF field instructions
    const ifFieldInstructions = this.findIfFieldInstructions();
    
    ifFieldInstructions.forEach(instruction => {
      this.processSingleIfField(instruction, data);
    });

    return this.serializeXmlDocument(this.xmlDoc);
  }

  findMergeFieldInstructions() {
    const instructions = [];
    const instrTextElements = this.xmlDoc.querySelectorAll('w\\:instrText');
    
    instrTextElements.forEach(instrText => {
      const text = instrText.textContent?.trim() || '';
      if (text.startsWith('MERGEFIELD')) {
        instructions.push(instrText);
      }
    });
    
    return instructions;
  }

  findIfFieldInstructions() {
    const instructions = [];
    const instrTextElements = this.xmlDoc.querySelectorAll('w\\:instrText');
    
    instrTextElements.forEach(instrText => {
      const text = instrText.textContent?.trim() || '';
      if (text.startsWith('IF ')) {
        instructions.push(instrText);
      }
    });
    
    return instructions;
  }

  processSingleMergeField(instrTextElement) {
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

  processSingleIfField(instrTextElement, data) {
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

  parseIfStatement(instrText) {
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

  evaluateIfCondition(ifField, data) {
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

  getNestedValue(data, path) {
    // Handle nested object access like "step.question.value"
    return path.split('.').reduce((obj, key) => obj?.[key], data);
  }

  findContentAfterIfEnd(endElement) {
    const content = [];
    let currentElement = endElement.parentElement?.nextElementSibling;
    
    while (currentElement) {
      // Look for %end% marker to stop
      const textElements = currentElement.querySelectorAll('w\\:t');
      let foundEnd = false;
      
      for (const textEl of textElements) {
        if (textEl.textContent?.includes('%end%')) {
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

  processIfContent(contentElements, showTrueBranch) {
    let inTrueBranch = true;
    let foundElse = false;
    
    contentElements.forEach(element => {
      const textElements = element.querySelectorAll('w\\:t');
      
      textElements.forEach(textEl => {
        const text = textEl.textContent || '';
        
        if (text.includes('%else%')) {
          foundElse = true;
          inTrueBranch = false;
          // Remove the %else% marker
          textEl.textContent = text.replace('%else%', '');
        }
        
        if (text.includes('%end%')) {
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

  findPreviousFldChar(startElement, fldCharType) {
    let currentElement = startElement.parentElement;
    
    while (currentElement) {
      const fldChar = currentElement.querySelector(`w\\:fldChar[w\\:fldCharType="${fldCharType}"]`);
      if (fldChar) {
        return fldChar;
      }
      currentElement = currentElement.previousElementSibling;
    }
    
    return null;
  }

  findNextFldChar(startElement, fldCharType) {
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

  extractMergeFieldName(instrText) {
    // Extract field name from "MERGEFIELD fieldname" or "MERGEFIELD fieldname.subfield"
    const match = instrText.match(/MERGEFIELD\s+([^\s]+)/);
    return match ? match[1] : '';
  }

  findPlaceholderTextElement(separateElement, endElement) {
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

  replacePlaceholderWithDots(textElement, fieldName) {
    // Replace text content with dots
    textElement.textContent = '..........';
    
    // Add invisible field name as a data attribute or comment for LLM processing
    textElement.setAttribute('data-merge-field', fieldName);
    
    // Optionally add an invisible comment node for LLM
    const comment = this.xmlDoc.createComment(`MERGEFIELD:${fieldName}`);
    textElement.parentNode?.insertBefore(comment, textElement);
  }
}

