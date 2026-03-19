'use client';

import { useState } from 'react';

export default function PollPanel({
  onCreatePoll,
}: {
  onCreatePoll: (question: string, options: string[]) => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isOpen, setIsOpen] = useState(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) return;
    onCreatePoll(question.trim(), validOptions);
    setQuestion('');
    setOptions(['', '']);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-purple-600/80 text-white rounded-lg text-sm hover:bg-purple-500 transition-colors"
      >
        📊 アンケート作成
      </button>
    );
  }

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="質問を入力..."
          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none"
        />
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`選択肢 ${i + 1}`}
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-red-400 text-sm px-2"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="text-blue-400 text-sm"
            >
              + 選択肢を追加
            </button>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 text-sm text-white/50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-1 bg-purple-600 text-white rounded-lg text-sm"
          >
            開始
          </button>
        </div>
      </form>
    </div>
  );
}
