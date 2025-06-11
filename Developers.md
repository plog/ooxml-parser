# Detailed Logic for Developers

This document provides an in-depth explanation of the core logic implemented in the `OoxmlProcessor` and `XmlUtils` classes, designed for manipulating MERGEFIELD and IF fields within Word OOXML documents. The entire project, including the React application, is now built with **TypeScript** for enhanced type safety and developer experience.

## 1. Overall Architecture

The solution is primarily composed of two main parts:

-   **OOXML Processing Library**: This is the core logic, implemented in TypeScript, responsible for parsing, processing, and serializing OOXML documents. It consists of:
    -   **`OoxmlProcessor`**: The central class for orchestrating the parsing of the OOXML string, identifying and processing MERGEFIELDs and IF fields, and then serializing the modified XML back into a string. It encapsulates the main business logic for field manipulation.
    -   **`XmlUtils`**: A static utility class that provides a set of helper functions for common XML DOM operations. These utilities are crucial for safely querying, traversing, and manipulating XML elements, especially considering the presence of XML namespaces in OOXML.

-   **React Tester Application**: A React application, also built with TypeScript, that provides a user interface for interacting with the OOXML Processing Library. This application integrates **CodeMirror** for advanced XML and JSON editing capabilities.

## 2. XML Parsing and Serialization

The `OoxmlProcessor` class handles the conversion between OOXML string and a manipulable DOM structure:

-   **`parseXmlString(xmlString: string): Document`**: This private method uses the browser's native `DOMParser` to convert the input OOXML string into an XML `Document` object. This allows for standard DOM API methods (like `querySelectorAll`, `createElement`, etc.) to be used for traversing and modifying the document structure.
-   **`serializeXmlDocument(xmlDoc: Document): string`**: After modifications are made to the `Document` object, this private method uses `XMLSerializer` to convert the XML `Document` back into a string representation, which can then be used to update the Word document.

## 3. MERGEFIELD Processing Logic

The processing of MERGEFIELDs is handled by the `processMergeFields()` method, which iterates through all identified merge field instructions and applies transformations.

### Identification of MERGEFIELDs

-   **`findMergeFieldInstructions(): Element[]`**: This method scans the entire XML document for `<w:instrText>` elements. It then filters these elements to find those whose text content starts with `MERGEFIELD`. This identifies the instruction part of each merge field.

### Processing a Single MERGEFIELD (`processSingleMergeField`) 

Once an `<w:instrText>` element for a MERGEFIELD is found, `processSingleMergeField` performs the following steps:

1.  **Locating Field Boundaries**: A MERGEFIELD in OOXML is defined by a sequence of runs (`<w:r>`) containing specific field characters (`<w:fldChar>`) and the instruction text:
    *   `<w:fldChar w:fldCharType="begin"/>`: Marks the beginning of the field.
    *   `<w:instrText>`: Contains the actual field instruction (e.g., `MERGEFIELD variable_name`).
    *   `<w:fldChar w:fldCharType="separate"/>`: Separates the field instruction from its result (the placeholder text).
    *   `<w:fldChar w:fldCharType="end"/>`: Marks the end of the field.

    The `findPreviousFldChar` and `findNextFldChar` helper methods (within `OoxmlProcessor`) are used to locate these boundary elements relative to the `<w:instrText>` element. These helpers traverse the DOM tree (specifically, sibling elements within the same parent paragraph `<w:p>`) to find the `begin`, `separate`, and `end` field characters.

2.  **Extracting Field Name**: The `extractMergeFieldName` method parses the text content of the `<w:instrText>` element to extract the actual merge field variable name (e.g., `werkgever.naamwg.naamwg` from `MERGEFIELD werkgever.naamwg.naamwg`).

3.  **Identifying Placeholder Text**: The `findPlaceholderTextElement` method locates the `<w:t>` element that holds the current displayed value of the merge field. This element is typically found between the `separate` and `end` field characters.

4.  **Transforming the Placeholder**: If a placeholder `<w:t>` element is found, the `replacePlaceholderWithDots` method is called:
    *   It replaces the `textContent` of the `<w:t>` element with `..........`.
    *   It adds a `data-merge-field` attribute to the `<w:t>` element, storing the original field name. This acts as an 


invisible tag for LLM processing.
    *   It inserts an XML comment node (`<!--MERGEFIELD:field_name-->`) *before* the `<w:t>` element. This provides another machine-readable, yet visually invisible, marker for the LLM to identify the original field.

## 4. IF Field Processing Logic

The processing of IF fields is more complex due to their conditional nature and the way their content is structured in OOXML. This is handled by the `processIfFields()` method.

### Identification of IF Fields

-   **`findIfFieldInstructions(): Element[]`**: Similar to merge fields, this method identifies `<w:instrText>` elements whose content starts with `IF `.

### Processing a Single IF Field (`processSingleIfField`)

For each identified IF field instruction, `processSingleIfField` performs the following:

1.  **Locating Field Boundaries**: Like MERGEFIELDs, IF fields are delimited by `begin`, `separate`, and `end` `<w:fldChar>` elements. The `findPreviousFldChar` and `findNextFldChar` helpers are used here as well.

2.  **Parsing the IF Statement**: The `parseIfStatement` method extracts the components of the IF condition from the `<w:instrText>` content. The expected format is `IF "variable" operator "value" "%iftrue%" "%iffalse%"`. This method uses regular expressions to parse out the variable path, the comparison operator, the target value, and the placeholder strings for the true and false branches (though these placeholders are not directly used for content, but rather for identifying the branches).

3.  **Evaluating the Condition**: The `evaluateIfCondition` method takes the parsed IF statement and the provided `data` (JSON object) to determine whether the condition is true or false:
    *   **`getNestedValue(data: Record<string, any>, path: string): any`**: This helper function is crucial for accessing nested values within the `data` JSON object using a dot-separated path (e.g., `steplessornumber.questionlessornumber`).
    *   It supports various comparison operators (`=`, `==`, `!=`, `<>`, `>`, `<`, `>=`, `<=`) to evaluate the `actualValue` from the `data` against the `expectedValue` from the IF statement.

4.  **Identifying Content Branches**: The `findContentAfterIfEnd` method is responsible for finding all the XML elements that constitute the content associated with the IF field. This content starts immediately after the `end` field character and continues until an `%end%` marker is encountered. This method collects all sibling elements until `%end%` is found within any `<w:t>` element.

5.  **Processing Content Based on Condition (`processIfContent`)**:
    *   This method iterates through the collected content elements.
    *   It looks for the `%else%` marker within `<w:t>` elements. This marker signifies the boundary between the true and false branches of the IF statement.
    *   Based on the `showTrueBranch` boolean (result of `evaluateIfCondition`), it decides which content to keep and which to remove.
    *   If `showTrueBranch` is true, elements before `%else%` are kept, and elements after `%else%` are removed. If `showTrueBranch` is false, elements before `%else%` are removed, and elements after `%else%` are kept.
    *   The `%else%` and `%end%` markers themselves are removed from the XML content.
    *   Elements that are not part of the chosen branch are removed from the DOM using `element.remove()`.

## 5. XML Utility Functions (`XmlUtils`)

The `XmlUtils` class provides a set of static helper methods to simplify XML DOM manipulation, especially concerning OOXML's use of namespaces.

-   **`querySelectorAllNS(element: Element | Document, selector: string): NodeListOf<Element>`** and **`querySelectorNS(element: Element | Document, selector: string): Element | null`**: These methods wrap the standard `querySelectorAll` and `querySelector` methods. They automatically escape the `w:` namespace prefix (e.g., `w:t` becomes `w\\:t`) in the selector string. This is crucial because standard DOM `querySelector` methods do not directly support querying elements with colons in their tag names without proper escaping, which is common in namespaced XML like OOXML.

-   **`createElement(doc: Document, tagName: string, namespace?: string): Element`**: A utility to create new XML elements, optionally specifying a namespace. This ensures new elements conform to the OOXML schema if needed.

-   **`getTextContent(container: Element): string`**: This function aggregates the text content from all `<w:t>` (text) elements found within a given container element. This is useful for extracting all visible text from a paragraph or run, as text can be split across multiple `<w:t>` tags.

-   **`findNextSibling(element: Element, selector: string): Element | null`** and **`findPreviousSibling(element: Element, selector: string): Element | null`**: These methods provide a robust way to find the next or previous sibling element that matches a given CSS selector (with namespace escaping). This is heavily used in `OoxmlProcessor` to navigate between the `w:fldChar` elements that define the boundaries of MERGEFIELD and IF fields.

-   **`removeElementsBetween(start: Element, end: Element): void`**: This utility removes all sibling elements between a specified `start` and `end` element (inclusive). This is used in IF field processing to remove the unwanted branch content.

-   **`cloneElementsBetween(start: Element, end: Element): Element[]`**: This utility clones all sibling elements between a specified `start` and `end` element (inclusive). While not directly used in the current MERGEFIELD/IF processing logic, it's a useful general-purpose utility for manipulating XML fragments.

## 6. CodeMirror Integration in React App

The React tester application utilizes CodeMirror 6 to provide an enhanced editing experience for XML and JSON content. The integration is encapsulated within the `CodeMirrorEditor` component.

### `CodeMirrorEditor` Component

-   **Props**: The component accepts `value` (the content to display), `onChange` (callback for content changes), `language` (`'xml'` or `'json'` for syntax highlighting), `readOnly`, `placeholder`, and `className` for styling.
-   **`useEffect` for Initialization**: A `useEffect` hook is used to initialize the CodeMirror editor when the component mounts or when `language`, `readOnly`, or `placeholder` props change. It sets up:
    -   `basicSetup`: Provides essential editor features like line numbers, undo/redo, etc.
    -   Language extensions (`xml()` or `json()`): Enables syntax highlighting specific to the content type.
    -   Custom `EditorView.theme`: Applies custom CSS for styling the editor, including font size, padding, border, and focus styles.
    -   `EditorView.updateListener.of()`: Listens for document changes and triggers the `onChange` callback when the editor content is modified.
    -   `EditorState.readOnly.of()`: Configures the editor to be read-only if the `readOnly` prop is true.
-   **`useEffect` for Value Synchronization**: Another `useEffect` hook is used to synchronize the CodeMirror editor's content with the `value` prop. This ensures that external changes to the `value` prop are reflected in the editor.

### Usage in `App.tsx`

In `App.tsx`, `CodeMirrorEditor` is used for:

-   **XML Input**: An editable CodeMirror instance with XML language support for pasting or loading OOXML content.
-   **JSON Data Input**: An editable CodeMirror instance with JSON language support for providing data for IF field evaluation.
-   **Processed Output**: A read-only CodeMirror instance with XML language support to display the transformed OOXML document.

This integration significantly improves the usability of the tester application by providing a professional and interactive code editing environment.

## 7. Considerations and Limitations

-   **DOMParser/XMLSerializer**: The solution relies on the browser's native `DOMParser` and `XMLSerializer`. This means it's primarily designed for client-side (browser) environments or Node.js environments that provide these DOM APIs (e.g., via `jsdom`).
-   **OOXML Complexity**: Word OOXML is a highly complex specification. This solution addresses the specific patterns for MERGEFIELD and IF fields as described. More advanced or unusual field structures might require further refinement of the parsing and manipulation logic.
-   **Error Handling**: Basic error handling (e.g., `console.warn` for incomplete field structures) is included, but a production-ready solution might require more robust error reporting and recovery mechanisms.
-   **Performance**: For very large OOXML documents, DOM manipulation can be performance-intensive. While the current approach is generally efficient for typical document sizes, optimization might be needed for extremely large files.

This detailed explanation should provide developers with a thorough understanding of the internal workings of the OOXML Field Processor library and the React tester application, enabling them to extend, debug, or integrate it more effectively.


