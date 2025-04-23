'use client'

import React from 'react';
import { Button } from '@/components/ui/button';

const keys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '<']
];

interface VirtualKeyboardProps {
  value: string;
  onChangeText: (value: string) => void;
}

export default function VirtualKeyboard({ value, onChangeText }: VirtualKeyboardProps) {
  const handleKeyPress = (key: string) => {
    let newValue = value;

    if (key === '<') {
      // Backspace - remove last character, but prevent empty string
      newValue = value.slice(0, -1) || '0';
    } else if (key === '0' && value === '0') {
      // Ignore additional zero presses when value is already "0"
      return;
    } else if (key === '.' && value.includes('.')) {
      // Prevent multiple decimal points
      return;
    } else if (value.length >= 6) {
      // Prevent exceeding max length
      return;
    } else {
      // For other keys, replace "0" with the key unless it's a decimal
      newValue = (value === '0' && key !== '.') ? key : value + key;
    }

    // Ensure we don't start with a decimal point
    if (newValue.startsWith('.')) {
      newValue = '0' + newValue;
    }

    // Ensure we don't end with a decimal point when backspacing
    if (newValue.endsWith('.') && key === '<') {
      newValue = newValue.slice(0, -1) || '0';
    }

    onChangeText(newValue);
  };

  return (
    <div className="w-full flex flex-col flex-1">
      {keys.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-1 items-center justify-around my-1">
          {row.map((key, keyIndex) => (
            <Button
              key={keyIndex}
              variant="ghost"
              size="lg"
              className="aspect-[1.5] flex-1 max-w-[20%] mx-1"
              onClick={() => handleKeyPress(key)}
            >
              <span className="text-2xl font-semibold">{key}</span>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}