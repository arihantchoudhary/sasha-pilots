'use client';

import { useState, useEffect, useCallback } from 'react';

interface TranscriptTurn {
  role: 'agent' | 'user';
  message: string;
  time_in_call_secs: number;
  conversation_turn_metrics?: Record<string, unknown>;
}

interface ConversationAnalysis {
  call_successful: string;
  transcript_summary: string | null;
  gemini_summary?: string | null;
  evaluation_criteria_results?: Record<string, unknown>;
}

interface ConversationMetadata {
  start_time_unix_secs: number;
  call_duration_secs: number;
  cost?: number;
}

interface ConversationDetails {
  agent_id: string;
  conversation_id: string;
  status: string;
  transcript: TranscriptTurn[];
  metadata: ConversationMetadata;
  analysis: ConversationAnalysis;
  tool_calls?: Record<string, unknown>[];
}

interface Conversation {
  agent_id: string;
  agent_name: string;
  conversation_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: string;
  call_successful: string;
  transcript_summary: string | null;
  call_summary_title: string | null;
  gemini_summary?: string | null;
}

interface ConversationsResponse {
  conversations: Conversation[];
  next_cursor: string;
  has_more: boolean;
}

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [viewMode, setViewMode] = useState<'last' | 'all'>('last');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setCopyStatus] = useState<string | null>(null);
  const [expandedQA, setExpandedQA] = useState<string | null>(null);
  const [questions, setQuestions] = useState<{[key: string]: string}>({});
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<{[key: string]: boolean}>({});
  const [loadingSummary, setLoadingSummary] = useState<{[key: string]: boolean}>({});
  const [geminiSummaries, setGeminiSummaries] = useState<{[key: string]: string}>({});
  const [emailModal, setEmailModal] = useState<{conversationId: string; isOpen: boolean} | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailPreview, setEmailPreview] = useState('');
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [successFilter, setSuccessFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const applyFilters = useCallback(() => {
    let filtered = conversations;

    if (viewMode === 'last') {
      filtered = conversations.length > 0 ? [conversations[0]] : [];
    } else {
      if (searchTerm) {
        filtered = filtered.filter(conv => 
          (conv.call_summary_title?.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (conv.agent_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      if (statusFilter !== 'all') {
        filtered = filtered.filter(conv => conv.status === statusFilter);
      }

      if (agentFilter !== 'all') {
        filtered = filtered.filter(conv => conv.agent_name === agentFilter);
      }

      if (successFilter !== 'all') {
        filtered = filtered.filter(conv => conv.call_successful === successFilter);
      }

      if (dateFilter !== 'all') {
        const now = Date.now() / 1000;
        const cutoff = {
          'today': now - 24 * 60 * 60,
          'week': now - 7 * 24 * 60 * 60,
          'month': now - 30 * 24 * 60 * 60
        }[dateFilter];
        
        if (cutoff) {
          filtered = filtered.filter(conv => conv.start_time_unix_secs >= cutoff);
        }
      }
    }

    setFilteredConversations(filtered);
  }, [conversations, searchTerm, statusFilter, agentFilter, successFilter, dateFilter, viewMode]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const getUniqueAgents = () => {
    const agents = [...new Set(conversations.map(conv => conv.agent_name))];
    return agents.sort();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAgentFilter('all');
    setSuccessFilter('all');
    setDateFilter('all');
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const data: ConversationsResponse = await response.json();
      const sortedConversations = data.conversations.sort(
        (a, b) => b.start_time_unix_secs - a.start_time_unix_secs
      );
      setConversations(sortedConversations);
      setFilteredConversations(sortedConversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };



  const getDaysAgo = (unixSecs: number) => {
    const now = Date.now() / 1000;
    const diffInSeconds = now - unixSecs;
    const days = Math.floor(diffInSeconds / (24 * 60 * 60));
    return days === 0 ? 'today' : `${days} days ago`;
  };


  const askQuestion = async (conversationId: string) => {
    const question = questions[conversationId];
    if (!question?.trim()) return;

    setLoadingAnalysis(prev => ({ ...prev, [conversationId]: true }));

    try {
      const conversationResponse = await fetch(`/api/conversations/${conversationId}`);
      if (!conversationResponse.ok) {
        throw new Error('Failed to fetch conversation details');
      }
      const conversationData: ConversationDetails = await conversationResponse.json();

      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: conversationData.transcript,
          question: question,
        }),
      });

      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze transcript');
      }

      const { answer } = await analysisResponse.json();
      setAnswers(prev => ({ ...prev, [conversationId]: answer }));
    } catch (err) {
      console.error('Error asking question:', err);
      setAnswers(prev => ({ ...prev, [conversationId]: 'Error analyzing transcript. Please try again.' }));
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [conversationId]: false }));
    }
  };

  const toggleQA = (conversationId: string) => {
    setExpandedQA(expandedQA === conversationId ? null : conversationId);
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setConversations(prev => prev.filter(conv => conv.conversation_id !== conversationId));
        setFilteredConversations(prev => prev.filter(conv => conv.conversation_id !== conversationId));
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };


  const generateGeminiSummary = async (conversationId: string) => {
    if (geminiSummaries[conversationId] || loadingSummary[conversationId]) {
      return;
    }

    try {
      setLoadingSummary(prev => ({ ...prev, [conversationId]: true }));
      
      // Fetch conversation details to get transcript
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation details');
      }
      
      const conversationDetails: ConversationDetails = await response.json();
      
      // Generate summary using Gemini
      const summaryResponse = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: conversationDetails.transcript }),
      });
      
      if (!summaryResponse.ok) {
        throw new Error('Failed to generate summary');
      }
      
      const { summary } = await summaryResponse.json();
      setGeminiSummaries(prev => ({ ...prev, [conversationId]: summary }));
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setLoadingSummary(prev => ({ ...prev, [conversationId]: false }));
    }
  };

  const generateEmailPreview = async (conversationId: string) => {
    try {
      setLoadingEmailPreview(true);
      
      // Check if we already have a Gemini summary for this conversation
      let summary = geminiSummaries[conversationId];
      
      // If no summary exists, generate one first
      if (!summary) {
        // Fetch conversation details to get transcript
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch conversation details');
        }
        
        const conversationDetails: ConversationDetails = await response.json();
        
        // Generate summary using Gemini
        const summaryResponse = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transcript: conversationDetails.transcript }),
        });
        
        if (!summaryResponse.ok) {
          throw new Error('Failed to generate summary');
        }
        
        const { summary: newSummary } = await summaryResponse.json();
        summary = newSummary;
        setGeminiSummaries(prev => ({ ...prev, [conversationId]: summary }));
      }
      
      // Create email with actual summary content
      const previewText = `Subject: Agenda for Our Upcoming Meeting

Dear ${emailRecipient},

I hope this email finds you well! Here are some ideas that I wanted to share about talking to you in our meeting:

${summary}

Looking forward to our discussion!

Best regards,
Sasha

---
Meeting prep from conversation on ${new Date().toLocaleDateString()}`;
      
      setEmailPreview(previewText);
    } catch (error) {
      console.error('Error generating email preview:', error);
      // Fallback to basic template if generation fails
      const fallbackText = `Subject: Agenda for Our Upcoming Meeting

Dear ${emailRecipient},

I hope this email finds you well! Unfortunately, I encountered an issue preparing the meeting agenda ideas.

Please try again or contact support if the issue persists.

Best regards,
Sasha

---
Meeting prep from conversation on ${new Date().toLocaleDateString()}`;
      
      setEmailPreview(fallbackText);
    } finally {
      setLoadingEmailPreview(false);
    }
  };

  const confirmSendEmail = async (conversationId: string) => {
    try {
      const response = await fetch('/api/space-fact-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          conversationId,
          recipient: emailRecipient 
        }),
      });
      
      if (response.ok) {
        // Close modal and reset state
        setEmailModal(null);
        setEmailRecipient('');
        setEmailPreview('');
        
        // Show success feedback
        setCopyStatus(conversationId);
        setTimeout(() => setCopyStatus(null), 2000);
      } else {
        console.error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const openEmailModal = (conversationId: string) => {
    setEmailModal({ conversationId, isOpen: true });
  };

  const renderConversationItem = (conversation: Conversation) => (
    <div key={conversation.conversation_id} className="flex items-center space-x-4">
      {/* Left Arrow - Delete */}
      <button
        onClick={() => deleteConversation(conversation.conversation_id)}
        className="flex items-center justify-center w-10 h-10 text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors flex-shrink-0"
        title="Delete conversation"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Main Card */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start space-x-4">
            {/* Emoji Indicator */}
            <div className="flex-shrink-0">
              <span className="text-2xl">💭</span>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-900">
                    {conversation.call_summary_title || 'Untitled Conversation'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {getDaysAgo(conversation.start_time_unix_secs)}
                  </span>
                </div>
              </div>
              
              {/* Conversation Preview */}
              <div className="mb-3">
                {loadingSummary[conversation.conversation_id] ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-gray-700 text-sm">Generating takeaways...</span>
                  </div>
                ) : geminiSummaries[conversation.conversation_id] ? (
                  <div className="text-gray-700 text-sm">
                    <div className="whitespace-pre-line">{geminiSummaries[conversation.conversation_id]}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-gray-700 text-sm italic">
                      &ldquo;{conversation.transcript_summary || 'No preview available'}&rdquo;
                    </p>
                    <button
                      onClick={() => generateGeminiSummary(conversation.conversation_id)}
                      className="text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      Generate 3 main takeaways
                    </button>
                  </div>
                )}
              </div>
              
              {/* Status and Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Status: open
                  </span>
                  <span className="text-xs text-gray-500">
                    {getDaysAgo(conversation.start_time_unix_secs)}
                  </span>
                </div>
                
                {/* Action Button */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleQA(conversation.conversation_id)}
                    className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                  >
                    chat with transcript
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Expanded Q&A Interface */}
          {expandedQA === conversation.conversation_id && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    placeholder="Ask a question about this conversation..."
                    value={questions[conversation.conversation_id] || ''}
                    onChange={(e) => setQuestions(prev => ({ 
                      ...prev, 
                      [conversation.conversation_id]: e.target.value 
                    }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !loadingAnalysis[conversation.conversation_id]) {
                        askQuestion(conversation.conversation_id);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={loadingAnalysis[conversation.conversation_id]}
                  />
                  <button
                    onClick={() => askQuestion(conversation.conversation_id)}
                    disabled={loadingAnalysis[conversation.conversation_id] || !questions[conversation.conversation_id]?.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {loadingAnalysis[conversation.conversation_id] ? 'Analyzing...' : 'Send'}
                  </button>
                </div>
                
                {/* Answer Display */}
                {answers[conversation.conversation_id] && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="text-sm text-blue-900">
                      <strong>AI Response:</strong> {answers[conversation.conversation_id]}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Arrow - Send Email */}
      <button
        onClick={() => openEmailModal(conversation.conversation_id)}
        className="flex items-center justify-center w-10 h-10 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0"
        title="Send space fact email"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 3.26a2 2 0 001.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Upcoming Conversations</h1>
              <p className="text-gray-500 text-lg">Requests waiting for your thoughtful response</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium">
                Generate Summaries
              </button>
              
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1.5">
                <button
                  onClick={() => setViewMode('last')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'last'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            {viewMode === 'last' ? 'Showing latest conversation' : `${filteredConversations.length} of ${conversations.length} conversations`}
          </div>
        </div>

        {/* Filters Section - Only show in 'all' mode */}
        {viewMode === 'all' && (
          <div className="bg-white shadow-sm rounded-xl mb-8 p-8 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 transition-all duration-200"
                >
                  <option value="all">All Status</option>
                  <option value="done">Done</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agent
                </label>
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 transition-all duration-200"
                >
                  <option value="all">All Agents</option>
                  {getUniqueAgents().map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success
                </label>
                <select
                  value={successFilter}
                  onChange={(e) => setSuccessFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 transition-all duration-200"
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 transition-all duration-200"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 shadow-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="space-y-3">
          {filteredConversations.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <p className="text-gray-500">No conversations found.</p>
            </div>
          ) : (
            filteredConversations.map(renderConversationItem)
          )}
        </div>
      </div>

      {/* Email Confirmation Modal */}
      {emailModal?.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Send Space Fact Email</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="Enter recipient email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-600"
                />
              </div>

              {emailRecipient && (
                <div>
                  <button
                    onClick={() => generateEmailPreview(emailModal.conversationId)}
                    disabled={loadingEmailPreview}
                    className="text-blue-600 hover:text-blue-800 text-sm underline disabled:opacity-50"
                  >
                    {loadingEmailPreview ? 'Generating preview...' : 'Preview email content'}
                  </button>
                </div>
              )}

              {emailPreview && (
                <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Email Preview:</h4>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">{emailPreview}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setEmailModal(null);
                  setEmailRecipient('');
                  setEmailPreview('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmSendEmail(emailModal.conversationId)}
                disabled={!emailRecipient || !emailPreview}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}