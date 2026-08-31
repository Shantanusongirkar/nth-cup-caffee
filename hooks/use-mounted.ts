'use client';

import * as React from 'react';

const emptySubscribe = () => () => {};

export function useMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
