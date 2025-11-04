'use client';

import { useState, useEffect } from 'react';
import type { Interview } from '@/lib/storage';

interface InterviewModalProps {
  interview: Interview | null;
  onClose: () => void;
  onSave: (interview: Interview) => void;
  onApprove: (interview: Interview) => void;
  readOnly?: boolean;
}

export default function InterviewModal({
  interview,
  onClose,
  onSave,
  onApprove,
  readOnly = false,
}: InterviewModalProps) {
  const [editedInterview, setEditedInterview] = useState<Interview | null>(interview);

  // Update editedInterview when interview prop changes
  useEffect(() => {
    setEditedInterview(interview);
  }, [interview]);

  if (!interview || !editedInterview) return null;

  const handleAnswerChange = (index: number, newAnswer: string) => {
    // Always allow editing answers (except transcripts which are read-only)
    setEditedInterview({
      ...editedInterview,
      answers: editedInterview.answers.map((qa, i) =>
        i === index ? { ...qa, answer: newAnswer } : qa
      ),
    });
  };

  const handleSaveDraft = () => {
    if (editedInterview) {
      onSave({ ...editedInterview, status: 'Draft' });
    }
  };

  const handleApprove = () => {
    if (editedInterview) {
      onApprove({ ...editedInterview, status: 'Approved' });
    }
  };

  // Transcripts are always read-only, but answers can always be edited
  const isLocked = false; // Removed restriction - answers are always editable

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Interview Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-semibold text-gray-600">Interviewer</label>
              <p className="text-gray-800">{interview.interviewer}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600">Date</label>
              <p className="text-gray-800">{interview.date}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600">Village/District</label>
              <p className="text-gray-800">{interview.village}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600">Farmer Name/ID</label>
              <p className="text-gray-800">{interview.farmerName}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600">Guide</label>
              <p className="text-gray-800">{interview.guideName}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600">Status</label>
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
            </div>
          </div>

          {/* Transcripts Section */}
          {(interview.hindiTranscript || interview.englishTranscript) && (
            <div className="mb-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Transcripts</h3>
              
              {interview.hindiTranscript && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hindi Transcript (हिंदी प्रतिलिपि)
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{interview.hindiTranscript}</p>
                  </div>
                </div>
              )}
              
              {interview.englishTranscript && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    English Transcript
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{interview.englishTranscript}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Questions & Answers</h3>
            {editedInterview.answers.map((qa, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Question {index + 1}: {qa.question}
                </label>
                <textarea
                  value={qa.answer}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  rows={4}
                />
                {(qa.quote || qa.reasoning) && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    {qa.quote && (
                      <div className="mb-2">
                        <span className="text-xs font-semibold text-blue-700">Quote from transcript:</span>
                        <p className="text-sm text-blue-900 italic mt-1">"{qa.quote}"</p>
                      </div>
                    )}
                    {qa.reasoning && (
                      <div>
                        <span className="text-xs font-semibold text-blue-700">Reasoning:</span>
                        <p className="text-sm text-blue-900 mt-1">{qa.reasoning}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSaveDraft}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Save Draft
            </button>
            <button
              onClick={handleApprove}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Approve & Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

