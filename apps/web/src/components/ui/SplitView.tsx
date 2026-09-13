'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Drawer } from './Drawer';

const SPLIT_MQ = '(min-width: 960px)';

export interface SplitViewProps {
  list: ReactNode;
  detail?: ReactNode;
  detailOpen: boolean;
  onDetailClose?: () => void;
  detailTitle?: string;
  emptyDetail?: ReactNode;
}

export function SplitView({
  list,
  detail,
  detailOpen,
  onDetailClose,
  detailTitle = 'جزئیات',
  emptyDetail,
}: SplitViewProps) {
  const [isWide, setIsWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(SPLIT_MQ);
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (isWide) {
    return (
      <div className={`split-view ${detailOpen ? 'split-view--open' : ''}`}>
        <div className="split-view-list">{list}</div>
        <div className="split-view-detail" aria-hidden={!detailOpen}>
          {detailOpen && detail ? detail : (
            emptyDetail ?? (
              <div className="split-view-placeholder">
                <p className="muted">یک مورد از فهرست را انتخاب کنید</p>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="split-view-list-only">{list}</div>
      <Drawer
        open={detailOpen}
        onClose={onDetailClose ?? (() => {})}
        title={detailTitle}
        width="min(100vw, 480px)"
      >
        {detail}
      </Drawer>
    </>
  );
}
