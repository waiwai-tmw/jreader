'use client'

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import React from 'react';

import { useEinkMode } from '../contexts/EinkModeContext';
import { useSettings } from '../contexts/SettingsContext';

import { Switch } from "@/components/ui/switch"

function DictionaryEntry({ 
  entry, 
  isSpoiler, 
  onToggleSpoiler 
}: { 
  entry: string;
  isSpoiler: boolean;
  onToggleSpoiler: () => void;
}) {
  const [title, revision] = entry.split('#');
  return (
    <div className="flex-grow flex items-center">
      <div className="flex-grow">
        <span className="font-medium">{title}</span>
        {revision && (
          <span className="text-sm text-muted-foreground ml-2">rev. {revision}</span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={isSpoiler}
          onCheckedChange={onToggleSpoiler}
          id={`spoiler-${entry}`}
        />
        <label
          htmlFor={`spoiler-${entry}`}
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Spoiler
        </label>
      </div>
    </div>
  );
}

function formatDictionaryName(dictString: string) {
  const [title, revision] = dictString.split('#');
  return {
    title,
    revision,
    display: `${title}${revision ? ` (rev. ${revision})` : ''}`
  };
}

const TermDictionaries = () => {
  const { preferences, onDragEnd, toggleSpoiler } = useSettings();
  
  if (!preferences?.dictionaryOrder || !preferences?.disabledDictionaries) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Term Dictionaries Section */}
        <div className="space-y-4">          
          {/* Active Term Dictionaries */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Active Dictionaries
              <span className="text-muted-foreground text-xs ml-2">(drag to reorder)</span>
            </label>
            <Droppable droppableId="term-order">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 min-h-[50px] p-2 border-2 border-dashed rounded transition-colors
                    ${snapshot.isDraggingOver ? 'border-accent bg-accent/50' : 'border-border'}`}
                >
                  {preferences.dictionaryOrder.map((dict, index) => (
                    <Draggable key={dict} draggableId={dict} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-2 rounded transition-shadow ${
                            snapshot.isDragging 
                              ? 'bg-card shadow-lg' 
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          <DictionaryEntry 
                            entry={dict}
                            isSpoiler={preferences.spoilerDictionaries.includes(dict)}
                            onToggleSpoiler={() => toggleSpoiler(dict)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Disabled Term Dictionaries */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Disabled Dictionaries
              <span className="text-muted-foreground text-xs ml-2">(drag to enable)</span>
            </label>
            <Droppable droppableId="term-disabled">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 min-h-[50px] p-2 border-2 border-dashed rounded transition-colors
                    ${snapshot.isDraggingOver ? 'border-accent bg-accent/50' : 'border-border'}`}
                >
                  {preferences.disabledDictionaries.map((dict, index) => (
                    <Draggable key={dict} draggableId={dict} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-2 rounded transition-shadow ${
                            snapshot.isDragging 
                              ? 'bg-card shadow-lg' 
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          <DictionaryEntry 
                            entry={dict}
                            isSpoiler={preferences.spoilerDictionaries.includes(dict)}
                            onToggleSpoiler={() => toggleSpoiler(dict)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

const FrequencyDictionaries = () => {
  const { preferences, onDragEnd } = useSettings();
  
  if (!preferences) return null;

  return (
    <div className="space-y-6">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-4">          
          {/* Active Frequency Dictionaries */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Active Dictionaries
              <span className="text-muted-foreground text-xs ml-2">(drag to reorder)</span>
            </label>
            <Droppable droppableId="freq-order">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 min-h-[50px] p-2 border-2 border-dashed rounded transition-colors
                    ${snapshot.isDraggingOver ? 'border-accent bg-accent/50' : 'border-border'}`}
                >
                  {preferences.freqDictionaryOrder.map((dict, index) => (
                    <Draggable key={dict} draggableId={dict} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-2 rounded transition-shadow ${
                            snapshot.isDragging 
                              ? 'bg-card shadow-lg' 
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          <div className="flex-grow">
                            {formatDictionaryName(dict).title}
                            <span className="text-sm text-muted-foreground ml-2">
                              rev. {formatDictionaryName(dict).revision}
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Disabled Frequency Dictionaries */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Disabled Dictionaries
              <span className="text-muted-foreground text-xs ml-2">(drag to enable)</span>
            </label>
            <Droppable droppableId="freq-disabled">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 min-h-[50px] p-2 border-2 border-dashed rounded transition-colors
                    ${snapshot.isDraggingOver ? 'border-accent bg-accent/50' : 'border-border'}`}
                >
                  {preferences.freqDisabledDictionaries.map((dict, index) => (
                    <Draggable key={dict} draggableId={dict} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-2 rounded transition-shadow ${
                            snapshot.isDragging 
                              ? 'bg-card shadow-lg' 
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          <div className="flex-grow">
                            {formatDictionaryName(dict).title}
                            <span className="text-sm text-muted-foreground ml-2">
                              rev. {formatDictionaryName(dict).revision}
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

const KanjiHighlightingSettings = () => {
  const { preferences, toggleKanjiHighlightingInSearch, toggleKanjiHighlightingInText } = useSettings();
  
  if (!preferences) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium mb-1">
            Highlight Kanji in Search Results
          </label>
          <p className="text-sm text-muted-foreground">
            Highlight unknown/encountered kanji in dictionary search results.
          </p>
        </div>
        <Switch
          checked={preferences.shouldHighlightKanjiInSearch ?? true}
          onCheckedChange={toggleKanjiHighlightingInSearch}
          id="kanji-highlighting-search"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium mb-1">
            Highlight Kanji in Text
          </label>
          <p className="text-sm text-muted-foreground">
            Highlight unknown/encountered kanji in the reading text. Disable to remove all highlighting while keeping click-to-lookup functionality.
          </p>
        </div>
        <Switch
          checked={preferences.shouldHighlightKanjiInText ?? true}
          onCheckedChange={toggleKanjiHighlightingInText}
          id="kanji-highlighting-text"
        />
      </div>
    </div>
  );
};

const EinkModeSettings = () => {
  const { isEinkMode, toggleEinkMode } = useEinkMode();
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium mb-1">
            E-ink Mode
          </label>
          <p className="text-sm text-muted-foreground">
            Disable all animations and transitions for better battery life and reduced ghosting on e-ink displays.
          </p>
        </div>
        <Switch
          checked={isEinkMode}
          onCheckedChange={toggleEinkMode}
          id="eink-mode"
        />
      </div>
    </div>
  );
};

const SettingsPane = {
  TermDictionaries,
  FrequencyDictionaries,
  KanjiHighlightingSettings,
  EinkModeSettings,
} as const;

export default SettingsPane; 