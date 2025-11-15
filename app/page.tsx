'use client';

import { useState, useEffect } from 'react';
import {
  getGuides,
  saveGuide,
  deleteGuide,
  getActiveGuides,
  getInterviews,
  saveInterview,
  deleteInterview,
  generateLoremAnswer,
  type Guide,
  type Interview,
} from '@/lib/database';
import { parseGuideFile, generateId, downloadTextFile } from '@/lib/utils';
import { transcribeHindiAudio, extractAnswersWithGPT } from '@/lib/transcription';
import { checkFileSize } from '@/lib/audio-compression';
import Toast from '@/components/Toast';
import InterviewModal from '@/components/InterviewModal';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Home() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sortBy, setSortBy] = useState<'guide' | 'employee' | 'status' | 'date' | 'village' | 'farmer'>('guide');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [mounted, setMounted] = useState(false);
  
  // Filter states
  const [filterGuide, setFilterGuide] = useState<string>('');
  const [filterInterviewer, setFilterInterviewer] = useState<string>('');
  const [filterVillage, setFilterVillage] = useState<string>('');
  const [filterFarmer, setFilterFarmer] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Form states
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [village, setVillage] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [guidesData, interviewsData] = await Promise.all([
        getGuides(),
        getInterviews(),
      ]);
      setGuides(guidesData);
      setInterviews(interviewsData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error loading data. Using cached data.', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Guide upload handler
  const handleGuideUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const questions = parseGuideFile(text);
      
      if (questions.length === 0) {
        showToast('No questions found in the file', 'error');
        return;
      }

      const guideId = generateId();
      const guideName = file.name.replace(/\.[^/.]+$/, '');
      
      const newGuide: Guide = {
        id: guideId,
        name: guideName,
        questions,
        active: true,
      };

      try {
        await saveGuide(newGuide);
        await loadData();
        showToast(`Guide "${guideName}" uploaded successfully!`);
      } catch (error) {
        console.error('Error saving guide:', error);
        showToast('Error saving guide', 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleToggleGuideActive = async (guide: Guide) => {
    try {
      await saveGuide({ ...guide, active: !guide.active });
      await loadData();
      showToast(`Guide "${guide.name}" ${!guide.active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling guide:', error);
      showToast('Error updating guide', 'error');
    }
  };

  const handleDeleteGuide = async (guideId: string) => {
    if (confirm('Are you sure you want to delete this guide?')) {
      try {
        await deleteGuide(guideId);
        await loadData();
        showToast('Guide deleted successfully');
      } catch (error) {
        console.error('Error deleting guide:', error);
        showToast('Error deleting guide', 'error');
      }
    }
  };

  // Interview creation handler
  const handleAddInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGuideId || !interviewerName || !interviewDate || !village || !farmerName) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    const guide = guides.find(g => g.id === selectedGuideId);
    if (!guide) {
      showToast('Selected guide not found', 'error');
      return;
    }

    let answers: Array<{ question: string; answer: string }> = [];
    let hindiTranscript: string | undefined;
    let englishTranscript: string | undefined;

    // Get file from input element directly (in case state is out of sync)
    const fileInput = (e.target as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement;
    const fileFromInput = fileInput?.files?.[0];
    
    // Use file from input if state is null/empty but input has a file
    const fileToProcess = audioFile && audioFile.size > 0 ? audioFile : (fileFromInput && fileFromInput.size > 0 ? fileFromInput : null);

    // Debug: Check if audio file exists
    console.log('=== DEBUG: Audio File Check ===');
    console.log('Audio file state:', audioFile);
    console.log('Audio file from input:', fileFromInput);
    console.log('File to process:', fileToProcess);
    console.log('Audio file name:', fileToProcess?.name);
    console.log('Audio file size:', fileToProcess?.size);

    // If audio file is provided, transcribe and extract answers
    if (fileToProcess && fileToProcess.size > 0) {
      setIsTranscribing(true);
      showToast('Transcribing Hindi audio...', 'info');
      
      try {
        console.log('Starting transcription for file:', fileToProcess.name, 'Size:', (fileToProcess.size / 1024 / 1024).toFixed(2), 'MB');
        
        // Step 1: Transcribe Hindi audio and translate to English
        const transcription = await transcribeHindiAudio(fileToProcess);
        console.log('Transcription result:', transcription);
        
        hindiTranscript = transcription.hindiText;
        englishTranscript = transcription.englishText;
        
        if (!englishTranscript) {
          throw new Error('No English transcript received from transcription service');
        }
        
        showToast('Transcription complete! Extracting answers with AI...', 'info');
        
        // Step 2: Use GPT to extract answers from English transcript
        console.log('Extracting answers from transcript:', englishTranscript.substring(0, 100) + '...');
        answers = await extractAnswersWithGPT(englishTranscript, guide.questions);
        console.log('Extracted answers:', answers);
        
        showToast('Answers extracted successfully!', 'success');
      } catch (error) {
        console.error('Transcription/Extraction error:', error);
        showToast(
          error instanceof Error 
            ? `Processing failed: ${error.message}` 
            : 'Processing failed. Please try again.',
          'error'
        );
        // Don't create interview if transcription fails - user should retry
        setIsTranscribing(false);
        return;
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // No audio file - use Lorem Ipsum
      console.warn('No audio file provided, using Lorem Ipsum');
      showToast('No audio file provided. Using placeholder text.', 'info');
      answers = guide.questions.map(question => ({
        question,
        answer: generateLoremAnswer(),
      }));
    }

    const interviewId = generateId();
    const newInterview: Interview = {
      id: interviewId,
      guideId: guide.id,
      guideName: guide.name,
      interviewer: interviewerName,
      date: interviewDate,
      village,
      farmerName,
      audioFile: fileToProcess?.name || 'No file uploaded',
      status: fileToProcess && answers.length > 0 ? 'AI-generated' : 'Draft',
      answers,
      hindiTranscript,
      englishTranscript,
    };

    try {
      await saveInterview(newInterview);
      await loadData();
      showToast('Interview created successfully!');
    } catch (error) {
      console.error('Error saving interview:', error);
      showToast('Error saving interview', 'error');
    }
    
    // Reset form
    setSelectedGuideId('');
    setInterviewerName('');
    setInterviewDate('');
    setVillage('');
    setFarmerName('');
    setAudioFile(null);
  };

  const handleEditInterview = (interview: Interview) => {
    setSelectedInterview(interview);
    setIsModalOpen(true);
  };

  const handleSaveInterview = async (interview: Interview) => {
    try {
      await saveInterview(interview);
      await loadData();
      setIsModalOpen(false);
      setSelectedInterview(null);
      showToast('Interview saved as draft');
    } catch (error) {
      console.error('Error saving interview:', error);
      showToast('Error saving interview', 'error');
    }
  };

  const handleApproveInterview = async (interview: Interview) => {
    try {
      await saveInterview(interview);
      await loadData();
      setIsModalOpen(false);
      setSelectedInterview(null);
      showToast('Interview approved and submitted!');
    } catch (error) {
      console.error('Error approving interview:', error);
      showToast('Error approving interview', 'error');
    }
  };

  const handleDownloadInterview = (interview: Interview) => {
    const content = `Interview Summary
Interviewer: ${interview.interviewer}
Date: ${interview.date}
Village: ${interview.village}
Farmer ID: ${interview.farmerName}
Guide: ${interview.guideName}

${interview.answers.map((qa, idx) => `Question ${idx + 1}: ${qa.question}
Answer: ${qa.answer}
${qa.quote ? `Quote: "${qa.quote}"` : ''}
${qa.reasoning ? `Reasoning: ${qa.reasoning}` : ''}

`).join('')}`;

    const filename = `interview_${interview.farmerName}_${interview.date}.txt`;
    downloadTextFile(content, filename);
    showToast('Interview downloaded successfully!');
  };

  const handleDownloadFilteredInterviews = (interviewsToDownload: Interview[]) => {
    if (interviewsToDownload.length === 0) {
      showToast('No interviews to download', 'error');
      return;
    }

    const filterInfo = [
      filterGuide && `Guide: ${filterGuide}`,
      filterInterviewer && `Interviewer: ${filterInterviewer}`,
      filterVillage && `Village: ${filterVillage}`,
      filterFarmer && `Farmer: ${filterFarmer}`,
      filterStatus && `Status: ${filterStatus}`,
      `Sort: ${sortBy} (${sortOrder})`,
    ].filter(Boolean).join(', ');

    const content = `Interview Summary Report
Generated: ${new Date().toLocaleString()}
Filters Applied: ${filterInfo || 'None'}
Total Interviews: ${interviewsToDownload.length}

${interviewsToDownload.map((interview, idx) => `
===============================================================================
INTERVIEW ${idx + 1} of ${interviewsToDownload.length}
===============================================================================
Interviewer: ${interview.interviewer}
Date: ${interview.date}
Village: ${interview.village}
Farmer ID: ${interview.farmerName}
Guide: ${interview.guideName}
Status: ${interview.status}

QUESTIONS & ANSWERS:
${interview.answers.map((qa, qIdx) => `
Question ${qIdx + 1}: ${qa.question}
Answer: ${qa.answer}
${qa.quote ? `Quote: "${qa.quote}"` : ''}
${qa.reasoning ? `Reasoning: ${qa.reasoning}` : ''}
`).join('\n')}
`).join('\n')}`;

    const filename = `interviews_${new Date().toISOString().split('T')[0]}.txt`;
    downloadTextFile(content, filename);
    showToast(`Downloaded ${interviewsToDownload.length} interview(s) successfully!`);
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (informational only - no blocking)
    const sizeCheck = checkFileSize(file, 9999); // Very high limit for informational purposes only
    
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Inform user about large files (ElevenLabs handles large files well)
    if (fileSizeMB > 50) {
      showToast(
        `📁 Large file (${fileSizeMB.toFixed(2)}MB) detected. Processing may take a few minutes. ElevenLabs will automatically segment files >8 minutes for faster processing.`,
        'info'
      );
    } else if (fileSizeMB > 20) {
      showToast(
        `📁 File size: ${fileSizeMB.toFixed(2)}MB. Processing will begin shortly.`,
        'info'
      );
    }
    
    console.log('File selected:', file.name, fileSizeMB.toFixed(2), 'MB');
    setAudioFile(file);
  };

  // Filter interviews
  const filteredInterviews = interviews.filter((interview) => {
    if (filterGuide && interview.guideName !== filterGuide) return false;
    if (filterInterviewer && interview.interviewer !== filterInterviewer) return false;
    if (filterVillage && interview.village !== filterVillage) return false;
    if (filterFarmer && interview.farmerName !== filterFarmer) return false;
    if (filterStatus && interview.status !== filterStatus) return false;
    return true;
  });

  // Sort interviews
  const sortedInterviews = [...filteredInterviews].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'guide') {
      comparison = a.guideName.localeCompare(b.guideName);
    } else if (sortBy === 'employee') {
      comparison = a.interviewer.localeCompare(b.interviewer);
    } else if (sortBy === 'status') {
      comparison = a.status.localeCompare(b.status);
    } else if (sortBy === 'date') {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === 'village') {
      comparison = a.village.localeCompare(b.village);
    } else if (sortBy === 'farmer') {
      comparison = a.farmerName.localeCompare(b.farmerName);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Get unique values for filter dropdowns
  const uniqueGuides = Array.from(new Set(interviews.map(i => i.guideName))).sort();
  const uniqueInterviewers = Array.from(new Set(interviews.map(i => i.interviewer))).sort();
  const uniqueVillages = Array.from(new Set(interviews.map(i => i.village))).sort();
  const uniqueFarmers = Array.from(new Set(interviews.map(i => i.farmerName))).sort();

  // Compute active guides from state to avoid hydration mismatch
  // Note: getActiveGuides is async, so we filter from guides state instead
  const activeGuides = guides.filter(g => g.active);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-700 mb-2">
            Project Ankur — AI Farmer Interview Platform (v0)
          </h1>
          <p className="text-gray-600">Single-page application for managing farmer interviews</p>
        </header>

        {/* Upload Interview Guide (Admin) */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Upload Interview Guide (Admin)</h2>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Upload Guide File (.txt)
            </label>
            <input
              type="file"
              accept=".txt"
              onChange={handleGuideUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-500 file:text-white hover:file:bg-primary-600"
            />
            <p className="text-xs text-gray-500 mt-2">
              Upload a .txt file with questions (one per line, or numbered)
            </p>
          </div>

          {/* Guides List */}
          {guides.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">All Guides</h3>
              <div className="space-y-2">
                {guides.map((guide) => (
                  <div
                    key={guide.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{guide.name}</div>
                      <div className="text-sm text-gray-600">
                        {guide.questions.length} question{guide.questions.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleGuideActive(guide)}
                        className={`px-4 py-1 rounded-lg text-sm font-semibold transition ${
                          guide.active
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        {guide.active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => handleDeleteGuide(guide.id)}
                        className="px-4 py-1 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Add Interview (Employee) */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Add Interview (Employee)</h2>
          <form onSubmit={handleAddInterview} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Guide *
              </label>
              <select
                value={selectedGuideId}
                onChange={(e) => setSelectedGuideId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                required
              >
                <option value="">-- Select an active guide --</option>
                {mounted && activeGuides.map((guide) => (
                  <option key={guide.id} value={guide.id}>
                    {guide.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Interviewer Name *
                </label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Village / District *
                </label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Farmer ID / Name *
                </label>
                <input
                  type="text"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Audio File *
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileChange}
                disabled={isTranscribing}
                required
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-500 file:text-white hover:file:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {audioFile && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <strong>Selected:</strong> {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                  {audioFile.size === 0 && (
                    <span className="text-red-600 ml-2">⚠ File appears to be empty! Please select a valid audio file.</span>
                  )}
                  {audioFile.size > 50 * 1024 * 1024 && (
                    <div className="mt-2 text-xs text-blue-700">
                      💡 Tip: Large files may take longer to process. ElevenLabs automatically segments files >8 minutes for parallel processing.
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Upload a Hindi audio file to automatically transcribe (Hindi + English), translate, and extract answers using AI. Supported formats: MP3, WAV, M4A, etc.
              </p>
            </div>

            <button
              type="submit"
              disabled={isTranscribing}
              className="w-full md:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isTranscribing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Transcribing...
                </>
              ) : (
                'Create Interview'
              )}
            </button>
          </form>
        </section>

        {/* Edit Interviews (Employee) */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Edit Interviews</h2>
          {interviews.length === 0 ? (
            <p className="text-gray-500">No interviews yet. Create one above!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                      Farmer Name
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                      Guide Name
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((interview) => (
                    <tr
                      key={interview.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleEditInterview(interview)}
                    >
                      <td className="border border-gray-300 px-4 py-3 text-gray-800">
                        {interview.farmerName}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-800">
                        {interview.guideName}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-800">
                        {interview.date}
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                            interview.status === 'Approved'
                              ? 'bg-green-100 text-green-800'
                              : interview.status === 'AI-generated'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {interview.status}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditInterview(interview);
                          }}
                          className="px-3 py-1 bg-primary-500 text-white rounded text-sm hover:bg-primary-600 transition"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* All Interviews (Admin View) */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">All Interviews (Admin View)</h2>
          
          {interviews.length === 0 ? (
            <p className="text-gray-500">No interviews available.</p>
          ) : (
            <>
              {/* Filters */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Guide</label>
                    <select
                      value={filterGuide}
                      onChange={(e) => setFilterGuide(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All Guides</option>
                      {uniqueGuides.map((guide) => (
                        <option key={guide} value={guide}>{guide}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Interviewer</label>
                    <select
                      value={filterInterviewer}
                      onChange={(e) => setFilterInterviewer(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All Interviewers</option>
                      {uniqueInterviewers.map((interviewer) => (
                        <option key={interviewer} value={interviewer}>{interviewer}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Village</label>
                    <select
                      value={filterVillage}
                      onChange={(e) => setFilterVillage(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All Villages</option>
                      {uniqueVillages.map((village) => (
                        <option key={village} value={village}>{village}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Farmer</label>
                    <select
                      value={filterFarmer}
                      onChange={(e) => setFilterFarmer(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All Farmers</option>
                      {uniqueFarmers.map((farmer) => (
                        <option key={farmer} value={farmer}>{farmer}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="AI-generated">AI-generated</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sort Controls */}
              <div className="mb-4 flex gap-4 items-center flex-wrap">
                <label className="text-sm font-semibold text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'guide' | 'employee' | 'status' | 'date' | 'village' | 'farmer')}
                  className="p-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option value="guide">Guide Name</option>
                  <option value="employee">Employee Name</option>
                  <option value="farmer">Farmer Name</option>
                  <option value="date">Date</option>
                  <option value="village">Village</option>
                  <option value="status">Status</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-semibold hover:bg-gray-600 transition"
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
                <div className="ml-auto text-sm text-gray-600">
                  Showing {sortedInterviews.length} of {interviews.length} interviews
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                        Farmer Name
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                        Guide Name
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                        Interviewer
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInterviews.map((interview) => (
                      <tr key={interview.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 text-gray-800">
                          {interview.farmerName}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-gray-800">
                          {interview.guideName}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-gray-800">
                          {interview.interviewer}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-gray-800">
                          {interview.date}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                              interview.status === 'Approved'
                                ? 'bg-green-100 text-green-800'
                                : interview.status === 'AI-generated'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {interview.status}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditInterview(interview)}
                              className="px-3 py-1 bg-primary-500 text-white rounded text-sm hover:bg-primary-600 transition"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDownloadInterview(interview)}
                              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition"
                            >
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Download Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleDownloadFilteredInterviews(sortedInterviews)}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Filtered Interviews ({sortedInterviews.length})
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Interview Modal */}
      {isModalOpen && selectedInterview && (
        <InterviewModal
          interview={selectedInterview}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedInterview(null);
          }}
          onSave={handleSaveInterview}
          onApprove={handleApproveInterview}
          readOnly={selectedInterview.status === 'Approved'}
        />
      )}
    </div>
  );
}

