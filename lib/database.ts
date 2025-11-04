// Database utilities using Supabase for cross-device persistence
// Falls back to localStorage if Supabase is not configured

import { supabase, isSupabaseConfigured } from './supabase';
import type { Guide, Interview } from './storage';

const GUIDES_KEY = 'ankur_guides';
const INTERVIEWS_KEY = 'ankur_interviews';

// Helper to use localStorage (fallback)
const useLocalStorage = () => {
  return typeof window !== 'undefined' && !isSupabaseConfigured();
};

// Guide functions
export const getGuides = async (): Promise<Guide[]> => {
  if (useLocalStorage()) {
    const stored = localStorage.getItem(GUIDES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  try {
    const { data, error } = await supabase
      .from('guides')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching guides:', error);
      // Fallback to localStorage on error
      const stored = localStorage.getItem(GUIDES_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching guides:', error);
    // Fallback to localStorage on error
    const stored = localStorage.getItem(GUIDES_KEY);
    return stored ? JSON.parse(stored) : [];
  }
};

export const saveGuide = async (guide: Guide): Promise<void> => {
  if (useLocalStorage()) {
    const guides = await getGuides();
    const existingIndex = guides.findIndex(g => g.id === guide.id);
    if (existingIndex >= 0) {
      guides[existingIndex] = guide;
    } else {
      guides.push(guide);
    }
    localStorage.setItem(GUIDES_KEY, JSON.stringify(guides));
    return;
  }

  try {
    const { error } = await supabase
      .from('guides')
      .upsert(guide, { onConflict: 'id' });

    if (error) {
      console.error('Error saving guide:', error);
      throw error;
    }

    // Also save to localStorage as backup
    const guides = await getGuides();
    const updatedGuides = [...guides];
    const existingIndex = updatedGuides.findIndex(g => g.id === guide.id);
    if (existingIndex >= 0) {
      updatedGuides[existingIndex] = guide;
    } else {
      updatedGuides.push(guide);
    }
    localStorage.setItem(GUIDES_KEY, JSON.stringify(updatedGuides));
  } catch (error) {
    console.error('Error saving guide:', error);
    // Fallback to localStorage on error
    const guides = await getGuides();
    const existingIndex = guides.findIndex(g => g.id === guide.id);
    if (existingIndex >= 0) {
      guides[existingIndex] = guide;
    } else {
      guides.push(guide);
    }
    localStorage.setItem(GUIDES_KEY, JSON.stringify(guides));
  }
};

export const deleteGuide = async (id: string): Promise<void> => {
  if (useLocalStorage()) {
    const guides = await getGuides();
    const filtered = guides.filter(g => g.id !== id);
    localStorage.setItem(GUIDES_KEY, JSON.stringify(filtered));
    return;
  }

  try {
    const { error } = await supabase
      .from('guides')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting guide:', error);
      throw error;
    }

    // Also update localStorage
    const guides = await getGuides();
    const filtered = guides.filter(g => g.id !== id);
    localStorage.setItem(GUIDES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting guide:', error);
    // Fallback to localStorage
    const guides = await getGuides();
    const filtered = guides.filter(g => g.id !== id);
    localStorage.setItem(GUIDES_KEY, JSON.stringify(filtered));
  }
};

export const getActiveGuides = async (): Promise<Guide[]> => {
  const guides = await getGuides();
  return guides.filter(g => g.active);
};

// Interview functions
export const getInterviews = async (): Promise<Interview[]> => {
  if (useLocalStorage()) {
    const stored = localStorage.getItem(INTERVIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching interviews:', error);
      // Fallback to localStorage on error
      const stored = localStorage.getItem(INTERVIEWS_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    // Map database fields to Interview interface
    return (data || []).map((item: any) => ({
      id: item.id,
      guideId: item.guide_id,
      guideName: item.guide_name,
      interviewer: item.interviewer,
      date: item.date,
      village: item.village,
      farmerName: item.farmer_name,
      audioFile: item.audio_file,
      status: item.status,
      answers: item.answers,
      hindiTranscript: item.hindi_transcript,
      englishTranscript: item.english_transcript,
    }));
  } catch (error) {
    console.error('Error fetching interviews:', error);
    // Fallback to localStorage on error
    const stored = localStorage.getItem(INTERVIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  }
};

export const saveInterview = async (interview: Interview): Promise<void> => {
  if (useLocalStorage()) {
    const interviews = await getInterviews();
    const existingIndex = interviews.findIndex(i => i.id === interview.id);
    if (existingIndex >= 0) {
      interviews[existingIndex] = interview;
    } else {
      interviews.push(interview);
    }
    localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(interviews));
    return;
  }

  try {
    // Map Interview interface to database fields
    const dbInterview = {
      id: interview.id,
      guide_id: interview.guideId,
      guide_name: interview.guideName,
      interviewer: interview.interviewer,
      date: interview.date,
      village: interview.village,
      farmer_name: interview.farmerName,
      audio_file: interview.audioFile,
      status: interview.status,
      answers: interview.answers,
      hindi_transcript: interview.hindiTranscript || null,
      english_transcript: interview.englishTranscript || null,
    };

    const { error } = await supabase
      .from('interviews')
      .upsert(dbInterview, { onConflict: 'id' });

    if (error) {
      console.error('Error saving interview:', error);
      throw error;
    }

    // Also save to localStorage as backup
    const interviews = await getInterviews();
    const updatedInterviews = [...interviews];
    const existingIndex = updatedInterviews.findIndex(i => i.id === interview.id);
    if (existingIndex >= 0) {
      updatedInterviews[existingIndex] = interview;
    } else {
      updatedInterviews.push(interview);
    }
    localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(updatedInterviews));
  } catch (error) {
    console.error('Error saving interview:', error);
    // Fallback to localStorage on error
    const interviews = await getInterviews();
    const existingIndex = interviews.findIndex(i => i.id === interview.id);
    if (existingIndex >= 0) {
      interviews[existingIndex] = interview;
    } else {
      interviews.push(interview);
    }
    localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(interviews));
  }
};

export const deleteInterview = async (id: string): Promise<void> => {
  if (useLocalStorage()) {
    const interviews = await getInterviews();
    const filtered = interviews.filter(i => i.id !== id);
    localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(filtered));
    return;
  }

  try {
    const { error } = await supabase
      .from('interviews')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting interview:', error);
      throw error;
    }

    // Also update localStorage
    const interviews = await getInterviews();
    const filtered = interviews.filter(i => i.id !== id);
    localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting interview:', error);
    // Fallback to localStorage
    const interviews = await getInterviews();
    const filtered = interviews.filter(i => i.id !== id);
    localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(filtered));
  }
};

// Export types from storage
export type { Guide, Interview } from './storage';
export { generateLoremAnswer } from './storage';
