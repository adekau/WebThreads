import { Thread } from './Thread';
import { Task } from './Task';

export type ThreadPoolConfig = {
    id?: number;
    maxThreads?: number;
    maxTasksPerThread?: number;
    globals?: { [global: string]: any };
};

/**
 * Manages multiple threads and executes a task on the next available thread.
 * @param config ThreadPoolConfig object to configure the thread pool.
 */
export class ThreadPool {
    public static poolCount: number = 0;
    public static taskCount: number = 0;
    public readonly id: number;
    public maxThreads: number;
    public maxTasksPerThread: number;
    public globals: { [global: string]: any };
    private _threads: Thread[];
    private _taskQueue: Task<any>[];
    private _taskArgs: WeakMap<Task<any>, any[]>;
    private _terminated: boolean;
    private _lastWorkerId: number;

    constructor(config?: ThreadPoolConfig) {
        this.id = config?.id ?? ++ThreadPool.poolCount;
        this._terminated = false;
        this._threads = [];
        this._taskQueue = [];
        this._lastWorkerId = 0;
        this._taskArgs = new WeakMap();
        this.maxThreads = config?.maxThreads || navigator.hardwareConcurrency;
        this.maxTasksPerThread = config?.maxTasksPerThread || 1;
        this.globals = config?.globals ?? {};
    }

    public get threadCount(): number {
        return this._threads.length;
    }

    public terminate(): void {
        this._terminated = true;
        // TODO: terminate each thread.
    }

    public run<T extends (...args: any[]) => any>(func: T | string, ...args: Parameters<T>): Task<T> {
        if (this._terminated)
            throw new Error(`ThreadPool ${this.id} is terminated.`);

        const task = new Task({
            id: ++ThreadPool.taskCount,
            func
        });

        this._taskQueue.push(task);
        this._taskArgs.set(task, args);
        this._runNext();
        return task;
    }

    private _runNext(): void {
        if (this._terminated)
            throw new Error(`ThreadPool ${this.id} is terminated.`);

        const thread = this._tryGetIdleThread();
        if (!thread) {
            setTimeout(this._runNext.bind(this), 15);
            return;
        }

        const nextTask = this._taskQueue.shift();
        if (!nextTask)
            return;
        const taskArgs = this._taskArgs.get(nextTask) || [];
        thread.run(nextTask, ...taskArgs);
    }

    private _tryGetIdleThread(): Thread | undefined {
        if (this._terminated)
            throw new Error(`ThreadPool ${this.id} is terminated.`);

        const idleThreads = this._threads
            .filter(thread => thread.tasks.length <= this.maxTasksPerThread)
            .sort((a, b) => a.tasks.length - b.tasks.length);

        if (idleThreads.length)
            return idleThreads[0];
        else if (this.threadCount < this.maxThreads)
            return this._createThread();
        else
            return undefined;
    }

    private _createThread(): Thread {
        const thread = new Thread({
            id: ++this._lastWorkerId
        });
        this._threads.push(thread);
        return thread;
    }
};
