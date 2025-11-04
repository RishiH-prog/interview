// LocalStorage utilities for guides and interviews

export interface Guide {
  id: string;
  name: string;
  questions: string[];
  active: boolean;
}

export interface Interview {
  id: string;
  guideId: string;
  guideName: string;
  interviewer: string;
  date: string;
  village: string;
  farmerName: string;
  audioFile: string;
  status: 'Draft' | 'AI-generated' | 'Approved';
  answers: Array<{ question: string; answer: string; quote?: string; reasoning?: string }>;
  hindiTranscript?: string;
  englishTranscript?: string;
}

const GUIDES_KEY = 'ankur_guides';
const INTERVIEWS_KEY = 'ankur_interviews';

// Guide functions
export const getGuides = (): Guide[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(GUIDES_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveGuide = (guide: Guide): void => {
  const guides = getGuides();
  const existingIndex = guides.findIndex(g => g.id === guide.id);
  if (existingIndex >= 0) {
    guides[existingIndex] = guide;
  } else {
    guides.push(guide);
  }
  localStorage.setItem(GUIDES_KEY, JSON.stringify(guides));
};

export const deleteGuide = (id: string): void => {
  const guides = getGuides().filter(g => g.id !== id);
  localStorage.setItem(GUIDES_KEY, JSON.stringify(guides));
};

export const getActiveGuides = (): Guide[] => {
  return getGuides().filter(g => g.active);
};

// Interview functions
export const getInterviews = (): Interview[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(INTERVIEWS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveInterview = (interview: Interview): void => {
  const interviews = getInterviews();
  const existingIndex = interviews.findIndex(i => i.id === interview.id);
  if (existingIndex >= 0) {
    interviews[existingIndex] = interview;
  } else {
    interviews.push(interview);
  }
  localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(interviews));
};

export const deleteInterview = (id: string): void => {
  const interviews = getInterviews().filter(i => i.id !== id);
  localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(interviews));
};

// Generate Lorem Ipsum answers
const loremIpsumSentences = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
  "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
];

export const generateLoremAnswer = (): string => {
  const numSentences = Math.floor(Math.random() * 3) + 2; // 2-4 sentences
  const shuffled = [...loremIpsumSentences].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, numSentences).join(' ');
};

