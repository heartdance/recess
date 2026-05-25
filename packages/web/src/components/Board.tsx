import React, { useState } from 'react';

type CellState = 'empty' | 'body' | 'head';
type CellView = 'unknown' | 'miss' | 'hit' | 'headshot';
type Cell = CellState | CellView;

interface BoardProps {
  board: Cell[][];
  onClick: (row: number, col: number) => void;
  onHover?: (row: number | null, col: number | null) => void;
  hoverCells?: Array<{ row: number; col: number; type: 'head' | 'body'; valid: boolean }>;
  isOwnBoard: boolean;
  disabled?: boolean;
}

const cellColors: Record<string, string> = {
  empty: '#e8e8e8',
  body: '#1677ff',
  head: '#ff4d4f',
  unknown: '#d9d9d9',
  miss: '#95de64',
  hit: '#ffec3d',
  headshot: '#ff4d4f',
};

export default function Board({ board, onClick, onHover, hoverCells, isOwnBoard, disabled }: BoardProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  if (!board || board.length === 0) return null;

  const hoverMap = new Map<string, { type: 'head' | 'body'; valid: boolean }>();
  if (hoverCells) {
    for (const hc of hoverCells) {
      hoverMap.set(`${hc.row},${hc.col}`, { type: hc.type, valid: hc.valid });
    }
  }

  const handleMouseEnter = (row: number, col: number) => {
    setHoveredCell({ row, col });
    onHover?.(row, col);
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    onHover?.(null, null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, userSelect: 'none' }}>
      <div style={{ display: 'flex', gap: 1, paddingLeft: 24 }}>
        {board[0].map((_, col) => (
          <div key={col} style={{
            width: 32,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: hoveredCell && hoveredCell.col === col ? '#1677ff' : '#999',
            fontWeight: hoveredCell && hoveredCell.col === col ? 'bold' : 'normal',
            transition: 'color 0.1s',
          }}>
            {col}
          </div>
        ))}
      </div>
      {board.map((row, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <div style={{
            width: 20,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: hoveredCell && hoveredCell.row === rowIdx ? '#1677ff' : '#999',
            fontWeight: hoveredCell && hoveredCell.row === rowIdx ? 'bold' : 'normal',
            transition: 'color 0.1s',
          }}>
            {rowIdx}
          </div>
          {row.map((cell, colIdx) => {
            const hover = hoverMap.get(`${rowIdx},${colIdx}`);
            let bgColor = cellColors[cell] || '#d9d9d9';
            let cellChar = '';
            let textColor: string | undefined;

            if (cell === 'miss') { cellChar = '○'; textColor = '#389e0d'; }
            else if (cell === 'hit') { cellChar = '×'; }
            else if (cell === 'headshot') { cellChar = '✈'; textColor = '#fff'; }
            else if (cell === 'body') { cellChar = '■'; }
            else if (cell === 'head') { cellChar = '★'; }

            if (hover) {
              bgColor = hover.valid
                ? (hover.type === 'head' ? 'rgba(255, 77, 79, 0.4)' : 'rgba(22, 119, 255, 0.4)')
                : 'rgba(255, 0, 0, 0.25)';
              cellChar = hover.type === 'head' ? '★' : '■';
              textColor = undefined;
            }

            const isHighlighted = hoveredCell && (hoveredCell.row === rowIdx || hoveredCell.col === colIdx) && !hover;

            return (
              <div
                key={colIdx}
                onClick={() => !disabled && onClick(rowIdx, colIdx)}
                onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                onMouseLeave={handleMouseLeave}
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: isHighlighted ? `${bgColor}e0` : bgColor,
                  border: '1px solid #bbb',
                  borderRadius: 2,
                  cursor: disabled || isOwnBoard ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: textColor,
                  transition: 'background-color 0.1s',
                  boxSizing: 'border-box',
                }}
              >
                {cellChar}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
