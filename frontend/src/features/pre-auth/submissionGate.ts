export type SubmissionGate = {
  isBusy(): boolean;
  run<T>(task: () => Promise<T>): Promise<T> | undefined;
};

export function createSubmissionGate(onBusyChange: (busy: boolean) => void): SubmissionGate {
  let busy = false;

  function release() {
    busy = false;
    onBusyChange(false);
  }

  return {
    isBusy() {
      return busy;
    },
    run<T>(task: () => Promise<T>) {
      if (busy) {
        return undefined;
      }

      busy = true;
      onBusyChange(true);
      try {
        return task().finally(release);
      } catch (error) {
        release();
        return Promise.reject(error);
      }
    },
  };
}
