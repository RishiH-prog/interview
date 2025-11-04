// Utility functions

export const parseGuideFile = (text: string): string[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const questions: string[] = [];
  
  for (const line of lines) {
    // Match patterns like "Question 1:", "Q1:", "1.", etc.
    const questionMatch = line.match(/^(?:Question\s*\d+|Q\d+|^\d+[\.\)])?\s*:?\s*(.+)$/i);
    if (questionMatch) {
      const question = questionMatch[1] || line;
      if (question.length > 5) { // Filter out very short lines
        questions.push(question);
      }
    }
  }
  
  // If no questions found with patterns, treat each non-empty line as a question
  if (questions.length === 0) {
    return lines.filter(line => line.length > 5);
  }
  
  return questions;
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

