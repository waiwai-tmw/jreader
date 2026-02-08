import { debug } from '@/utils/debug';

interface TableOfContentsEntry {
    label: string;
    contentSrc: string;
    playOrder: number;
    pageNumber: number;
  }
  
  interface TocPaneProps {
    entries: TableOfContentsEntry[];
    onNavigate: (pageNumber: number) => void;
  }
  
  export default function TocPane({ entries, onNavigate }: TocPaneProps) {
    return (
      <div className="flex flex-col p-4 landscape:w-[500px] landscape:h-full portrait:w-full portrait:h-full">
        <h2 className="text-lg font-bold mb-6">目次</h2>
        <div className="space-y-2 overflow-auto">
          {entries.map((entry) => (
            <div
              key={entry.playOrder}
              onClick={() => {
                debug('📚 TOC Entry clicked:', {
                  pageNumber: entry.pageNumber,
                  playOrder: entry.playOrder,
                  label: entry.label,
                  contentSrc: entry.contentSrc
                });
                onNavigate(entry.pageNumber);
              }}
              className="cursor-pointer hover:bg-muted p-2 rounded"
            >
              {entry.label}
            </div>
          ))}
        </div>
      </div>
    );
  }