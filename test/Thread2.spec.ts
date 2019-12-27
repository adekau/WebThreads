import { Thread } from "../src/Thread2";
import { Task } from "../src/Task";

function threadTerminate(th: Thread) {
    console.error(th.id + ' terminated');
}

describe('Thread', () => {
    it('creates a thread', () => {
        const thread = new Thread({
            id: 1,
            onTaskDone: jasmine.createSpy('taskDone'),
            onTerminate: threadTerminate
        });

        expect(thread).toBeDefined();
        expect(thread.id).toBe(1);
        expect(thread.state).toBe('idle');
        expect(thread.tasks).toEqual([]);
    });

    it('runs a task on a thread', async () => {
        const thread = new Thread({
            id: 1,
            onTaskDone: jasmine.createSpy('taskDone'),
            onTerminate: threadTerminate
        });

        const task = new Task({
            id: 1,
            func: (x: number) => x * 2
        });

        thread.run(task, 15);
        const result = await task.done();
        expect(thread.onTaskDone).toHaveBeenCalled();
        expect(task.state).toBe('done');
        expect(result).toBe(30);
    });

    it('runs an async task on a tread', async () => {
        const thread = new Thread({
            id: 1,
            onTaskDone: jasmine.createSpy('taskDone'),
            onTerminate: threadTerminate
        });

        const task = new Task({
            id: 1,
            // async functions like so will need to be strings or else tsc transorms it
            // to `__awaiter` which doesn't exist on the worker thread.
            func: `async x => x * 2`
        });

        thread.run(task, 17);
        const result = await task.done();
        expect(thread.onTaskDone).toHaveBeenCalled();
        expect(task.state).toBe('done');
        expect(result).toBe(34);
    });

    it('adds and removes to the task queue', async () => {
        const thread = new Thread({
            id: 1,
            onTaskDone: jasmine.createSpy('taskDone'),
            onTerminate: threadTerminate
        });

        const task = new Task({
            id: 1,
            func: () => new Promise((resolve, _) => setTimeout(() => resolve(5), 500))
        });

        thread.run(task);
        expect(thread.state).toBe('running');
        expect(thread.tasks.length).toBe(1);
        await task.done();
        expect(thread.state).toBe('idle');
        expect(thread.tasks.length).toBe(0);
    });
});
