
import React, { useState, useCallback } from 'react';
import geminiService from '../../services/geminiService';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { Button } from '../shared/Button';
import { ICON_MAP } from '../../constants';

interface AITaskGeneratorProps {
  description: string;
  onDescriptionChange: (description: string) => void;
  onSuggestionSelect: (title: string) => void;
}

export const AITaskGenerator: React.FC<AITaskGeneratorProps> = ({ 
  description, 
  onDescriptionChange, 
  onSuggestionSelect 
}) => {
  const { 
    isLoading: isAISuggesting, 
    setIsLoading: setIsAISuggesting, 
    error: aiError, 
    setError: setAIError,
    suggestedTaskTitles, 
    setSuggestedTaskTitles,
    darkMode
  } = useAppStore();

  const SparklesIcon = ICON_MAP.SparklesIcon;

  const handleGenerateTitles = useCallback(async () => {
    if (!description.trim()) {
      setAIError("Please enter some details for the AI to suggest titles.");
      return;
    }
    setIsAISuggesting(true);
    setAIError(null);
    setSuggestedTaskTitles([]);
    try {
      const titles = await geminiService.generateTaskTitles(description);
      setSuggestedTaskTitles(titles);
    } catch (e: any) {
      setAIError(e.message || "Failed to generate titles.");
      setSuggestedTaskTitles([]);
    } finally {
      setIsAISuggesting(false);
    }
  }, [description, setIsAISuggesting, setAIError, setSuggestedTaskTitles]);

  const labelClass = `block text-sm font-medium mb-1.5`;
  // Textarea will inherit global styles from index.html

  return (
    <div 
      className={`my-4 p-4 border rounded-squircle-md shadow-inner-glass`}
      style={{backgroundColor: darkMode ? 'hsla(var(--page-background-base-dark),0.1)' : 'hsla(var(--page-background-base-light),0.2)', borderColor: 'var(--panel-border)'}}
    >
      <label htmlFor="task-description-ai" className={labelClass}>
        AI Task Helper <span className="text-xs opacity-70">(Optional)</span>
      </label>
      <textarea
        id="task-description-ai"
        rows={2}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Describe the task, and AI can suggest titles..."
        disabled={isAISuggesting}
      />
      <Button 
        onClick={handleGenerateTitles} 
        disabled={isAISuggesting || !description.trim()} 
        variant="secondary" 
        size="sm" 
        className="mt-2.5"
      >
        <SparklesIcon className="w-4 h-4 mr-1.5 text-accent" />
        {isAISuggesting ? 'Generating...' : 'Suggest Titles'}
      </Button>
      
      {aiError && <p className={`mt-2.5 text-xs text-status-error`}>{aiError}</p>}
      
      {suggestedTaskTitles.length > 0 && (
        <div className="mt-3">
          <h4 className={`text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-1.5`}>Suggestions:</h4>
          <ul className="space-y-1">
            {suggestedTaskTitles.map((title, index) => (
              <li key={index}>
                <button
                  type="button" 
                  onClick={() => onSuggestionSelect(title)}
                  className={`w-full text-left p-1.5 text-sm rounded-squircle-sm transition-colors
                              ${darkMode ? 'text-accent-light hover:bg-accent/20' : 'text-accent hover:bg-accent/10'}`}
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};