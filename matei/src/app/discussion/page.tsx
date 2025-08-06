'use client';

import { useState } from 'react';

interface DiscussionData {
  title: string;
  content: string;
  status: 'open' | 'in_progress' | 'completed';
  date: string;
}

export default function DiscussionPage() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');

  // Sample discussion data - in real app this would come from props/API
  const discussionData: DiscussionData = {
    title: "One-on-One Prep Discussion",
    content: `The user outlined key tasks for the agent: onboarding workflow customization, backend configuration with optionality for future growth (agent training/distribution or coaching platform), input/output templates, email notification configuration (user-defined frequency), and document uploads for the knowledge base. The agent clarified user preferences for feedback notifications and backend growth pathways. The agent confirmed understanding and will review next steps.`,
    status: 'open',
    date: 'today'
  };

  const generateTemplate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gemini-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discussionContent: `${discussionData.title}\n${discussionData.date}\n"${discussionData.content}"\n\nStatus: ${discussionData.status}`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate template');
      }

      const { analysis: geminiAnalysis } = await response.json();
      setAnalysis(geminiAnalysis);
    } catch (error) {
      console.error('Error generating template:', error);
      setAnalysis('Error generating analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {discussionData.title}
              </h1>
              <p className="text-gray-500 text-lg">
                {discussionData.date}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(discussionData.status)}`}>
                Status: {discussionData.status}
              </span>
            </div>
          </div>
        </div>

        {/* Original Discussion */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Original Discussion</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700 italic">
              &ldquo;{discussionData.content}&rdquo;
            </p>
          </div>
        </div>

        {/* Generate Template Button */}
        <div className="mb-6">
          <button
            onClick={generateTemplate}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Generating Custom Template...' : 'Generate Custom Template with Gemini'}
          </button>
        </div>

        {/* Gemini Analysis */}
        {analysis && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Gemini Analysis & Custom Template
              </h2>
              <span className="text-sm text-gray-500 bg-green-50 px-2 py-1 rounded">
                AI Generated
              </span>
            </div>
            
            <div className="prose max-w-none">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <pre className="whitespace-pre-wrap text-gray-800 text-sm font-normal">
                  {analysis}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Action Items (if analysis is generated) */}
        {analysis && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Update Status</div>
                <div className="text-sm text-gray-500">Mark as in progress</div>
              </button>
              <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Schedule Follow-up</div>
                <div className="text-sm text-gray-500">Set next meeting</div>
              </button>
              <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Export Analysis</div>
                <div className="text-sm text-gray-500">Save to documents</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}