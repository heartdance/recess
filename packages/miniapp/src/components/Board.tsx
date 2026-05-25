import { View, Text } from '@tarojs/components';
import './Board.css';

const cellColors: Record<string, string> = {
  empty: '#e8e8e8',
  body: '#1677ff',
  head: '#ff4d4f',
  unknown: '#d9d9d9',
  miss: '#95de64',
  hit: '#ffec3d',
  headshot: '#ff4d4f',
};

interface BoardProps {
  board: string[][];
  onClick: (row: number, col: number) => void;
}

export default function Board({ board, onClick }: BoardProps) {
  if (!board || board.length === 0) return null;

  return (
    <View className="board">
      {board.map((row, rowIdx) => (
        <View key={rowIdx} className="board-row">
          {row.map((cell, colIdx) => (
            <View
              key={colIdx}
              className="board-cell"
              style={{ backgroundColor: cellColors[cell] || '#d9d9d9' }}
              onClick={() => onClick(rowIdx, colIdx)}
            >
              <Text className="cell-text">
                {cell === 'miss' && '○'}
                {cell === 'hit' && '×'}
                {cell === 'headshot' && '✈'}
                {cell === 'body' && '■'}
                {cell === 'head' && '★'}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
