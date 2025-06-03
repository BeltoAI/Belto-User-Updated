"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Info, 
  Brain, 
  Search, 
  Database,
  FileText,
  MessageSquare,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const AIPreferencesConfig = ({ lectureId, onUpdate }) => {
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Load AI preferences on component mount
  useEffect(() => {
    fetchPreferences();
  }, [lectureId]);

  const fetchPreferences = async () => {
    if (!lectureId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/lectures/${lectureId}/preferences`);
      if (!response.ok) throw new Error('Failed to fetch preferences');
      
      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error('Error fetching AI preferences:', error);
      toast.error('Failed to load AI preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/lectures/${lectureId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });
      
      if (!response.ok) throw new Error('Failed to save preferences');
      
      const updatedPreferences = await response.json();
      setPreferences(updatedPreferences);
      toast.success('AI preferences saved successfully!');
      
      if (onUpdate) onUpdate(updatedPreferences);
    } catch (error) {
      console.error('Error saving AI preferences:', error);
      toast.error('Failed to save AI preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setPreferences({
      ...preferences,
      ragSettings: {
        enableRAG: true,
        ragSimilarityThreshold: 0.7,
        maxContextChunks: 5,
        chunkSize: 1000,
        chunkOverlap: 200,
        contextPriorityMode: 'automatic',
        includeSourceAttribution: true,
        semanticSearchMode: 'moderate'
      }
    });
    toast.info('Reset to default RAG settings');
  };

  const updatePreference = (section, key, value) => {
    setPreferences(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-[#333333] rounded mb-4 w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-[#333333] rounded w-full"></div>
          <div className="h-4 bg-[#333333] rounded w-3/4"></div>
          <div className="h-4 bg-[#333333] rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!preferences) return null;

  return (
    <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg">
      {/* Header */}
      <div 
        className="p-4 border-b border-[#333333] cursor-pointer flex items-center justify-between hover:bg-[#222222] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-[#FFB800]" />
          <div>
            <h3 className="text-white font-semibold">AI & RAG Configuration</h3>
            <p className="text-gray-400 text-sm">Configure AI behavior and retrieval settings for this lecture</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {preferences.ragSettings?.enableRAG && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
              RAG Enabled
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6">
          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-[#262626] p-1 rounded-lg">
            {[
              { id: 'basic', label: 'Basic AI', icon: Brain },
              { id: 'rag', label: 'RAG Settings', icon: Search },
              { id: 'processing', label: 'Processing', icon: Database }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#FFB800] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-[#333333]'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Basic AI Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Brain className="inline h-4 w-4 mr-1" />
                    AI Model
                  </label>
                  <select
                    value={preferences.model}
                    onChange={(e) => updatePreference('', 'model', e.target.value)}
                    className="w-full bg-[#262626] border border-[#444444] rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                  >
                    <option value="gpt-4">GPT-4 (Best quality)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                    <option value="claude-3">Claude 3 (Alternative)</option>
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Temperature: {preferences.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={preferences.temperature}
                    onChange={(e) => updatePreference('', 'temperature', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Focused</span>
                    <span>Creative</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Zap className="inline h-4 w-4 mr-1" />
                    Max Tokens per Response
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    value={preferences.maxTokens}
                    onChange={(e) => updatePreference('', 'maxTokens', parseInt(e.target.value))}
                    className="w-full bg-[#262626] border border-[#444444] rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                  />
                </div>

                {/* Message Limit */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <MessageSquare className="inline h-4 w-4 mr-1" />
                    Message Limit per Session
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={preferences.numPrompts}
                    onChange={(e) => updatePreference('', 'numPrompts', parseInt(e.target.value))}
                    className="w-full bg-[#262626] border border-[#444444] rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* RAG Settings Tab */}
          {activeTab === 'rag' && (
            <div className="space-y-6">
              {/* RAG Enable/Disable */}
              <div className="flex items-center justify-between p-4 bg-[#262626] rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable RAG (Retrieval-Augmented Generation)</h4>
                  <p className="text-gray-400 text-sm">Allow AI to search and reference lecture materials</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.ragSettings?.enableRAG}
                    onChange={(e) => updatePreference('ragSettings', 'enableRAG', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#FFB800] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFB800]"></div>
                </label>
              </div>

              {preferences.ragSettings?.enableRAG && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Similarity Threshold */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Similarity Threshold: {preferences.ragSettings?.ragSimilarityThreshold}
                      </label>
                      <input
                        type="range"
                        min="0.3"
                        max="0.9"
                        step="0.05"
                        value={preferences.ragSettings?.ragSimilarityThreshold || 0.7}
                        onChange={(e) => updatePreference('ragSettings', 'ragSimilarityThreshold', parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>More results</span>
                        <span>More precise</span>
                      </div>
                    </div>

                    {/* Max Context Chunks */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Max Context Chunks: {preferences.ragSettings?.maxContextChunks}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={preferences.ragSettings?.maxContextChunks || 5}
                        onChange={(e) => updatePreference('ragSettings', 'maxContextChunks', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Focused</span>
                        <span>Comprehensive</span>
                      </div>
                    </div>

                    {/* Search Mode */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Search Sensitivity
                      </label>
                      <select
                        value={preferences.ragSettings?.semanticSearchMode || 'moderate'}
                        onChange={(e) => updatePreference('ragSettings', 'semanticSearchMode', e.target.value)}
                        className="w-full bg-[#262626] border border-[#444444] rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                      >
                        <option value="conservative">Conservative (Explicit questions only)</option>
                        <option value="moderate">Moderate (Balanced)</option>
                        <option value="aggressive">Aggressive (Broader context)</option>
                      </select>
                    </div>

                    {/* Context Priority */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Context Priority Mode
                      </label>
                      <select
                        value={preferences.ragSettings?.contextPriorityMode || 'automatic'}
                        onChange={(e) => updatePreference('ragSettings', 'contextPriorityMode', e.target.value)}
                        className="w-full bg-[#262626] border border-[#444444] rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-[#FFB800] focus:border-transparent"
                      >
                        <option value="automatic">Automatic (AI decides)</option>
                        <option value="semantic-only">Semantic Search Only</option>
                        <option value="uploads-only">Recent Uploads Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Source Attribution */}
                  <div className="flex items-center justify-between p-4 bg-[#262626] rounded-lg">
                    <div>
                      <h4 className="text-white font-medium">Include Source Attribution</h4>
                      <p className="text-gray-400 text-sm">Show which materials were used for each response</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.ragSettings?.includeSourceAttribution}
                        onChange={(e) => updatePreference('ragSettings', 'includeSourceAttribution', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#FFB800] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFB800]"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing Settings Tab */}
          {activeTab === 'processing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chunk Size */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <FileText className="inline h-4 w-4 mr-1" />
                    Chunk Size: {preferences.ragSettings?.chunkSize} characters
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="2000"
                    step="100"
                    value={preferences.ragSettings?.chunkSize || 1000}
                    onChange={(e) => updatePreference('ragSettings', 'chunkSize', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Detailed</span>
                    <span>Broader context</span>
                  </div>
                </div>

                {/* Chunk Overlap */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Chunk Overlap: {preferences.ragSettings?.chunkOverlap} characters
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="50"
                    value={preferences.ragSettings?.chunkOverlap || 200}
                    onChange={(e) => updatePreference('ragSettings', 'chunkOverlap', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Distinct</span>
                    <span>Connected</span>
                  </div>
                </div>
              </div>

              {/* Processing Rules */}
              <div className="space-y-4">
                <h4 className="text-white font-medium">Processing Rules</h4>
                
                {[
                  { key: 'allowUploads', label: 'Allow File Uploads', desc: 'Students can upload files during chat' },
                  { key: 'formatText', label: 'Format Text Output', desc: 'Apply formatting to AI responses' },
                  { key: 'addCitations', label: 'Add Citations', desc: 'Include citation information in responses' },
                  { key: 'removeHyperlinks', label: 'Remove Hyperlinks', desc: 'Strip hyperlinks from materials' },
                  { key: 'removeSensitiveData', label: 'Remove Sensitive Data', desc: 'Filter out potentially sensitive information' }
                ].map(rule => (
                  <div key={rule.key} className="flex items-center justify-between p-4 bg-[#262626] rounded-lg">
                    <div>
                      <h5 className="text-white font-medium">{rule.label}</h5>
                      <p className="text-gray-400 text-sm">{rule.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.processingRules?.[rule.key]}
                        onChange={(e) => updatePreference('processingRules', rule.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#FFB800] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFB800]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-[#333333]">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </button>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Info className="h-4 w-4" />
                Changes auto-save when you click Save
              </div>
              
              <button
                onClick={savePreferences}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#FFB800] text-black px-6 py-2 rounded-md font-medium hover:bg-[#FFD700] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPreferencesConfig;
