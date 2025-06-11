import { OoxmlProcessor } from './ooxmlProcessor.js';

// Test data for IF field evaluation
const testData = {
  steplessornumber: {
    questionlessornumber: "Non, une seule personne est bailleur du bien"
  },
  step_info: {
    q_companyname: {
      q_companyname: "Test Company"
    },
    q_contractreference: {
      q_contractreference: "REF123"
    }
  }
};

// Test MERGEFIELD processing
export function testMergeFieldProcessing() {
  console.log('Testing MERGEFIELD processing...');
  
  const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
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

  const processor = new OoxmlProcessor(sampleXml);
  const result = processor.processMergeFields();
  
  console.log('MERGEFIELD processing result:');
  console.log(result);
  
  // Check if the placeholder was replaced with dots
  const hasDotsReplacement = result.includes('..........');
  console.log('✓ Placeholder replaced with dots:', hasDotsReplacement);
  
  // Check if invisible field name was added
  const hasFieldAttribute = result.includes('data-merge-field');
  console.log('✓ Field name attribute added:', hasFieldAttribute);
}

// Test IF field processing
export function testIfFieldProcessing() {
  console.log('Testing IF field processing...');
  
  const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:fldChar w:fldCharType="begin"/>
      </w:r>
      <w:r>
        <w:instrText> IF "steplessornumber.questionlessornumber" = "Non, une seule personne est bailleur du bien" "%iftrue%" "%iffalse%" </w:instrText>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="separate"/>
      </w:r>
      <w:r>
        <w:t>{IF}</w:t>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="end"/>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This is the true branch content.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>%else%</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This is the false branch content.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>%end%</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  const processor = new OoxmlProcessor(sampleXml);
  const result = processor.processIfFields(testData);
  
  console.log('IF field processing result:');
  console.log(result);
  
  // Check if the condition was evaluated correctly
  const hasTrueBranch = result.includes('This is the true branch content.');
  const hasFalseBranch = result.includes('This is the false branch content.');
  
  console.log('✓ True branch shown:', hasTrueBranch);
  console.log('✓ False branch hidden:', !hasFalseBranch);
  
  // Check if markers were removed
  const hasElseMarker = result.includes('%else%');
  const hasEndMarker = result.includes('%end%');
  
  console.log('✓ %else% marker removed:', !hasElseMarker);
  console.log('✓ %end% marker removed:', !hasEndMarker);
}

// Test with real OOXML samples
export function testWithRealSamples() {
  console.log('Testing with real OOXML samples...');
  
  // This would be called with the actual file contents
  // For now, we'll simulate with a simplified test
  
  console.log('Real sample tests would go here...');
}

// Run all tests
export function runAllTests() {
  console.log('=== Running OOXML Processor Tests ===');
  
  try {
    testMergeFieldProcessing();
    console.log('');
    testIfFieldProcessing();
    console.log('');
    testWithRealSamples();
    
    console.log('=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for use in other modules
export { testData };

