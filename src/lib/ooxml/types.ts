export interface MergeField {
  name: string;
  // Add any other properties that might be needed for invisible tags
}

export interface IfField {
  condition: string;
  trueContent: string;
  falseContent: string;
  // Add any other properties that might be needed for nested IFs or complex structures
}


