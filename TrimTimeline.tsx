import React, { useState, useRef } from 'react';

interface TrimTimelineProps {
  duration: number;
  startTime: number;
  endTime: number;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
  isDarkMode: boolean;
}

const TrimTimeline: React.FC<TrimTimelineProps> = ({
  duration,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  isDarkMode
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseDown = (handle: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingHandle(handle);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingHandle || !barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newTime = Math.max(0, Math.min((x / rect.width) * duration, duration));
    const roundedTime = Math.round(newTime * 10) / 10;

    if (draggingHandle === 'start') {
      if (roundedTime < endTime) {
        onStartChange(roundedTime);
      }
    } else {
      if (roundedTime > startTime) {
        onEndChange(roundedTime);
      }
    }
  };

  const handleMouseUp = () => {
    setDraggingHandle(null);
  };

  React.useEffect(() => {
    if (draggingHandle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingHandle, startTime, endTime, duration]);

  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;
  const rangePercent = endPercent - startPercent;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isDarkMode ? 'text-gray-700' : 'text-gray-600'}`}>
          Trim Timeline
        </span>
        <span className={`text-[9px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          {formatTime(startTime)} - {formatTime(endTime)}
        </span>
      </div>

      <div
        ref={barRef}
        className={`relative h-12 rounded-xl border cursor-pointer transition-colors group ${
          isDarkMode ? 'bg-[#0c0c0c] border-white/5 hover:bg-[#151515]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
      >
        {/* Background bar */}
        <div className={`absolute inset-0 rounded-xl ${isDarkMode ? 'bg-gradient-to-r from-gray-900 to-gray-800' : 'bg-gradient-to-r from-gray-100 to-gray-50'}`} />

        {/* Trimmed range highlight */}
        <div
          className={`absolute top-0 bottom-0 rounded-lg transition-all ${
            isDarkMode ? 'bg-blue-600/20 border-l-2 border-r-2 border-blue-500' : 'bg-blue-500/10 border-l-2 border-r-2 border-blue-400'
          }`}
          style={{
            left: `${startPercent}%`,
            right: `${100 - endPercent}%`
          }}
        />

        {/* Start handle */}
        <div
          onMouseDown={handleMouseDown('start')}
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-8 rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing ${
            draggingHandle === 'start'
              ? isDarkMode ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-blue-500 border-blue-300 shadow-lg'
              : isDarkMode ? 'bg-[#1a1a1a] border-white/10 hover:border-blue-500' : 'bg-white border-gray-300 hover:border-blue-400'
          }`}
          style={{ left: `calc(${startPercent}% - 10px)` }}
        >
          <div className={`h-full flex items-center justify-center text-[6px] font-black ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>▶</div>
        </div>

        {/* End handle */}
        <div
          onMouseDown={handleMouseDown('end')}
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-8 rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing ${
            draggingHandle === 'end'
              ? isDarkMode ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-blue-500 border-blue-300 shadow-lg'
              : isDarkMode ? 'bg-[#1a1a1a] border-white/10 hover:border-blue-500' : 'bg-white border-gray-300 hover:border-blue-400'
          }`}
          style={{ left: `calc(${endPercent}% - 10px)` }}
        >
          <div className={`h-full flex items-center justify-center text-[6px] font-black ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>◀</div>
        </div>

        {/* Time labels on hover */}
        {draggingHandle && (
          <>
            <div
              className={`absolute top-0 -translate-y-full mb-1 px-2 py-1 rounded text-[8px] font-bold whitespace-nowrap transition-all ${
                isDarkMode ? 'bg-[#1a1a1a] text-blue-400' : 'bg-gray-800 text-blue-400'
              }`}
              style={{ left: `${startPercent}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(startTime)}
            </div>
            <div
              className={`absolute top-0 -translate-y-full mb-1 px-2 py-1 rounded text-[8px] font-bold whitespace-nowrap transition-all ${
                isDarkMode ? 'bg-[#1a1a1a] text-blue-400' : 'bg-gray-800 text-blue-400'
              }`}
              style={{ left: `${endPercent}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(endTime)}
            </div>
          </>
        )}
      </div>

      {/* Duration info */}
      <div className={`text-[8px] font-bold flex justify-between ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
        <span>Trim: {formatTime(endTime - startTime)}</span>
      </div>
    </div>
  );
};

export default TrimTimeline;
