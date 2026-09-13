'use client';

import { useState } from 'react';
import { createExpertNote } from '@/lib/trajectory-api';

interface Props {
  householdId: string;
  memberId?: string;
  onCreated: () => void;
}

export function ExpertNoteForm({ householdId, memberId, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await createExpertNote(householdId, { title, content, memberId });
    setTitle('');
    setContent('');
    onCreated();
  }

  return (
    <form className="card expert-note-form" onSubmit={submit}>
      <h4>یادداشت کارشناسی</h4>
      <div className="form-grid">
        <label className="form-group form-full">
          <span>عنوان</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: ارزیابی اولیه" />
        </label>
        <label className="form-group form-full">
          <span>متن یادداشت *</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className="btn btn-primary">ثبت یادداشت</button>
    </form>
  );
}
