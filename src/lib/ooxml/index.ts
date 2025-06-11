// Main entry point for the OOXML processor library
export { OoxmlProcessor } from './ooxmlProcessor';
export { XmlUtils } from './xmlUtils';
export { MergeField, IfField } from './types';
export { runAllTests, testData } from './tests';

// Convenience function to process both MERGEFIELD and IF fields
export function processOoxmlDocument(
  xmlString: string, 
  data?: Record<string, any>
): string {
  const processor = new OoxmlProcessor(xmlString);
  
  // First process MERGEFIELD elements
  let result = processor.processMergeFields();
  
  // Then process IF fields if data is provided
  if (data) {
    const processorWithMergeFields = new OoxmlProcessor(result);
    result = processorWithMergeFields.processIfFields(data);
  }
  
  return result;
}

// Example usage function
export function exampleUsage(): void {
  console.log('=== OOXML Processor Example Usage ===');
  
  const sampleData = {
    steplessornumber: {
      questionlessornumber: "Non, une seule personne est bailleur du bien"
    },
    step_info: {
      q_companyname: {
        q_companyname: "Example Company Ltd"
      }
    }
  };
  
  const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Company: </w:t>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="begin"/>
      </w:r>
      <w:r>
        <w:instrText> MERGEFIELD step_info.q_companyname.q_companyname </w:instrText>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="separate"/>
      </w:r>
      <w:r>
        <w:t>«step_info.q_companyname.q_companyname»</w:t>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="end"/>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  console.log('Processing OOXML document...');
  const result = processOoxmlDocument(sampleXml, sampleData);
  console.log('Result:', result);
}

