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
        className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/20 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/30 hover:text-white transition-all"
      >
        アンケート作成
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(false)}
        className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/20 bg-transparent text-white/70 hover:bg-white/5 hover:border-white/30 hover:text-white transition-all"
      >
        アンケート作成
      </button>
      <div className="absolute bottom-full mb-3 right-0 bg-gray-800/95 backdrop-blur-sm rounded-xl p-6 border border-white/10 w-[500px]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="質問を入力..."
          rows={3}
          className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-base focus:outline-none resize-none"
        />
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`選択肢 ${i + 1}`}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-base focus:outline-none"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-red-400 text-base px-2"
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
              className="text-blue-400 text-base"
            >
              + 選択肢を追加
            </button>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-base text-white/50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-purple-600 text-white rounded-lg text-base"
          >
            開始
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
