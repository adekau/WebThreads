import { ThreadPool } from '../src/ThreadPool';

describe('ThreadPool', () => {
    describe('constructor', () => {
        it('should create a thread pool', () => {
            const tp = new ThreadPool();
            expect(tp.globals).toEqual({});
            expect(tp.id).toBeGreaterThan(0);
            expect(tp.threadCount).toBe(0);
            expect(tp.maxThreads).toBeGreaterThan(0);
            expect(tp.maxThreads).toBe(navigator.hardwareConcurrency);
            expect(tp.maxTasksPerThread).toBe(1);
        });

        it('should set values to config if they exist', () => {
            const tp = new ThreadPool({
                maxThreads: 4,
                maxTasksPerThread: 2,
                id: 2,
                globals: { test: 'tester' }
            });
            expect(tp.globals).toEqual({ test: 'tester' });
            expect(tp.id).toBe(2);
            expect(tp.maxTasksPerThread).toBe(2);
            expect(tp.maxThreads).toBe(4);
        });
    });

    it('should create a thread on running first task', async () => {
        const tp = new ThreadPool();
        const fn = (x: number) => x * 2;
        const task = tp.run(fn, 5);
        expect(tp.threadCount).toBe(1);
        const result = await task.done();
        expect(result).toBe(10);
    });

    it('should error on terminated thread pool', async (done) => {
        const tp = new ThreadPool();
        tp.terminate();

        try {
            tp.run(() => {});
        } catch {
            done();
            return;
        }

        fail('Should have thrown an error.');
    });

    it('should run lots of tasks', async () => {
        const tp = new ThreadPool();
        const tasks = [];
        const fn = (x: number) => x * 2;
        for (let i = 0; i < 25; i++) {
            tasks.push(tp.run(fn, i));
        }
        expect(tp.threadCount).toBeGreaterThan(1)
        const b = Promise.all(tasks.map(task => task.done()))

        const c = await b;
        for (let i = 0; i < 25; i++) {
            expect(c[i]).toBe(fn(i));
        }
    });
});
