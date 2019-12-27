import { Thread } from '../src/Thread';

const mult2 = (x: number) => x * 2;

describe('Threads', () => {
  it('creates a thread and posts a message on run', () => {
    const thread = Thread();
    thread.worker.postMessage = jasmine.createSpy('onmessage');

    thread.run(mult2, 15);

    expect(thread.worker).toBeDefined();
    expect(thread.worker.postMessage).toHaveBeenCalledWith({
      func: mult2.toString(),
      argument0: 15
    });
  });

  it('runs a function in a worker', () => {
    const thread = Thread();
    thread.run(mult2, 6);
    expect(thread.state).toBe('running');
  });
});
