'use client';

import { useState, useEffect } from 'react';

interface TranscriptTurn {
  role: 'agent' | 'user';
  message: string;
  time_in_call_secs: number;
  conversation_turn_metrics?: any;
}

interface ConversationAnalysis {
  call_successful: string;
  transcript_summary: string | null;
  evaluation_criteria_results?: any;
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
  tool_calls?: any[];
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
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [expandedQA, setExpandedQA] = useState<string | null>(null);
  const [questions, setQuestions] = useState<{[key: string]: string}>({});
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<{[key: string]: boolean}>({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [successFilter, setSuccessFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [conversations, searchTerm, statusFilter, agentFilter, successFilter, dateFilter, viewMode]);

  const applyFilters = () => {
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
  };

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

  const formatDate = (unixSecs: number) => {
    return new Date(unixSecs * 1000).toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDaysAgo = (unixSecs: number) => {
    const now = Date.now() / 1000;
    const diffInSeconds = now - unixSecs;
    const days = Math.floor(diffInSeconds / (24 * 60 * 60));
    return days === 0 ? 'today' : `${days} days ago`;
  };

  const copyTranscript = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation details');
      }
      const data: ConversationDetails = await response.json();
      
      const transcriptText = data.transcript?.map(turn => 
        `${turn.role.toUpperCase()}: ${turn.message}`
      ).join('\\n\\n') || 'No transcript available';
      
      await navigator.clipboard.writeText(transcriptText);
      setCopyStatus(conversationId);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error('Error copying transcript:', err);
    }
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

  const sendSpaceFactEmail = async (conversationId: string) => {
    try {
      const response = await fetch('/api/space-fact-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId }),
      });
      
      if (response.ok) {
        setCopyStatus(conversationId);
        setTimeout(() => setCopyStatus(null), 2000);
      }
    } catch (error) {
      console.error('Error sending space fact email:', error);
    }
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
                <p className="text-gray-700 text-sm italic">
                  "{conversation.transcript_summary || 'No preview available'}"
                </p>
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
                    Respond with care
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
        onClick={() => sendSpaceFactEmail(conversation.conversation_id)}
        className="flex items-center justify-center w-10 h-10 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0"
        title="Send space fact email"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
    </div>
  );
}