export class XmlUtils {
  /**
   * Safely query elements with namespace prefixes
   */
  static querySelectorAllNS(element, selector) {
    // Handle Word namespace prefixes by escaping them
    const escapedSelector = selector.replace(/w:/g, 'w\\:');
    return element.querySelectorAll(escapedSelector);
  }

  /**
   * Safely query single element with namespace prefixes
   */
  static querySelectorNS(element, selector) {
    const escapedSelector = selector.replace(/w:/g, 'w\\:');
    return element.querySelector(escapedSelector);
  }

  /**
   * Create a new XML element with proper namespace
   */
  static createElement(doc, tagName, namespace) {
    if (namespace) {
      return doc.createElementNS(namespace, tagName);
    }
    return doc.createElement(tagName);
  }

  /**
   * Get text content from all w:t elements within a container
   */
  static getTextContent(container) {
    const textElements = this.querySelectorAllNS(container, 'w:t');
    return Array.from(textElements).map(el => el.textContent || '').join('');
  }

  /**
   * Find the next sibling element that matches a selector
   */
  static findNextSibling(element, selector) {
    let sibling = element.nextElementSibling;
    while (sibling) {
      if (sibling.matches(selector.replace(/w:/g, 'w\\:'))) {
        return sibling;
      }
      sibling = sibling.nextElementSibling;
    }
    return null;
  }

  /**
   * Find the previous sibling element that matches a selector
   */
  static findPreviousSibling(element, selector) {
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (sibling.matches(selector.replace(/w:/g, 'w\\:'))) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    return null;
  }

  /**
   * Remove elements between two boundary elements (inclusive)
   */
  static removeElementsBetween(start, end) {
    let current = start;
    const elementsToRemove = [];
    
    while (current && current !== end) {
      elementsToRemove.push(current);
      current = current.nextElementSibling;
    }
    
    if (current === end) {
      elementsToRemove.push(end);
    }
    
    elementsToRemove.forEach(el => el.remove());
  }

  /**
   * Clone elements between two boundary elements
   */
  static cloneElementsBetween(start, end) {
    const clonedElements = [];
    let current = start;
    
    while (current && current !== end) {
      clonedElements.push(current.cloneNode(true));
      current = current.nextElementSibling;
    }
    
    if (current === end) {
      clonedElements.push(end.cloneNode(true));
    }
    
    return clonedElements;
  }
}

