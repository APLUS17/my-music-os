'use client';

import React, { useState, useEffect } from 'react';
import { useFlow } from '../FlowContext';
import { Genre } from '@/types';
import { ChevronDown } from 'lucide-react';

const GENRES: { value: Genre; label: string }[] = [
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'pop', label: 'Pop' },
  { value: 'r&b', label: 'R&B' },
  { value: 'country', label: 'Country' },
  { value: 'k-pop', label: 'K-Pop' },
  { value: 'worship', label: 'Worship' },
  { value: 'rock', label: 'Rock' },
  { value: 'indie', label: 'Indie' },
];

export const GenreSelector: React.FC = () => {
  const { genre, setGenre } = useFlow();
  const [isOpen, setIsOpen] = useState(false);

  // Load genre from localStorage on mount
  useEffect(() => {
    const savedGenre = localStorage.getItem('flow_genre');
    if (savedGenre && GENRES.find((g) => g.value === savedGenre)) {
      setGenre(savedGenre as Genre);
    }
  }, []);

  const handleGenreChange = (newGenre: Genre) => {
    setGenre(newGenre);
    localStorage.setItem('flow_genre', newGenre);
    setIsOpen(false);
  };

  const currentLabel = GENRES.find((g) => g.value === genre)?.label || 'Genre';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] text-sm transition-colors border border-[var(--border-main)]"
      >
        <span>{currentLabel}</span>
        <ChevronDown
          size={16}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-main)] shadow-xl z-50 min-w-[120px]">
          {GENRES.map((g) => (
            <button
              key={g.value}
              onClick={() => handleGenreChange(g.value)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                genre === g.value
                  ? 'bg-[var(--accent)] text-black font-semibold'
                  : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
