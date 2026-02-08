export interface LookupTermRequest {
    term: string;
    position: number;
  }
  
  export interface PitchAccentEntry {
    reading: string;
    position: number;
    moraCount: number;
  }
  
  export interface PitchAccentEntryList {
    entries: PitchAccentEntry[];
  }
  
  export interface PitchAccentResult {
    title: string;
    entries: Record<string, PitchAccentEntryList>;
  }
  
  export interface FrequencyData {
    term: string;
    reading: string | null;
    value: number | null;
    displayValue: string | null;
  }
  
  export interface FrequencyDataList {
    items: FrequencyData[];
  }
  
  export type Definition = 
    | {
        type: "simple";
        content: string;
      }
    | {
        type: "structured";
        type_: string;
        content: string;
        attributes: Record<string, string>;
      }
    | {
        type: "deinflection";
        baseForm: string;
        inflections: string[];
      };
  
  export interface TermEntry {
    text: string;
    reading: string;
    tags: string[];
    ruleIdentifiers: string;
    score: number;
    definitions: Definition[];
    sequenceNumber: number;
    termTags: string[];
  }
  
  export interface DictionaryResult {
    title: string;
    revision: string;
    origin: string;
    entries: TermEntry[];
  }
  
  export interface LookupTermResponse {
    dictionaryResults: DictionaryResult[];
    pitchAccentResults: Record<string, PitchAccentResult>;
    frequencyDataLists: Record<string, FrequencyDataList>;
  }