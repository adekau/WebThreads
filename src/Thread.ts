import { fnToURL, noOp } from './helpers';
import { Message } from './Message';
import { Task } from './Task';

export type ThreadConfig = {
    /**
     * Used to keep track of threads if in a task pool.
     */
    id: number;

    /**
     * Runs when a task completes on a thread.
     * @param thread the thread the task was completed on.
     * @returns void
     */
    onTaskDone?: (thread: Thread) => void;

    /**
     * Runs when a thread dies.
     * @param thread the thread that died.
     * @returns void
     */
    onTerminate?: (thread: Thread) => void;
};

/**
 * A thread for allowing tasks to run in parallel.
 * @param config ThreadConfig object to configure the thread.
 */
export class Thread implements ThreadConfig {
    private _worker: Worker;
    public id: number;
    public onTaskDone: (thread: this) => void = noOp;
    public onTerminate: (thread: this) => void = noOp;
    public state: 'idle' | 'running';
    public tasks: Task<any>[];
    public globals: { [k: string]: any };

    constructor(config: ThreadConfig) {
        Object.assign(this, config);
        this.state = 'idle';
        this.tasks = [];
        this.globals = [];
        this._worker = new Worker(fnToURL(workerMain));
        this._worker.addEventListener(
            'message',
            ({ data }: MessageEvent): void => (this._handleWorkerMessage(data))
        );
    }

    private _handleWorkerMessage(message: Message): void {
        const taskIdx: number = this.tasks.findIndex(
            task => message.id === task.id
        );
        if (taskIdx === undefined)
            return;

        const task = this.tasks[taskIdx];
        if (message.type === 'error')
            task.reject(new Error(String(message.error)));
        if (message.type === 'result')
            task.resolve(message.result);

        this.onTaskDone(this);

        if (this.tasks.length === 1)
            this.state = 'idle';

        this.tasks.splice(taskIdx, 1);
    }

    /**
     * Run a task on this thread.
     * @param task The task instance to execute on the thread.
     * @param args The argument array or comma separated argument list to pass to the task's function.
     * @returns void
     */
    public run<T extends (...args: any[]) => any>(task: Task<T>, ...args: Parameters<T>): void {
        this.tasks.push(task);

        const message: Message = {
            type: 'run',
            id: task.id,
            func: task.func.toString()
        };

        // add arguments for spawned thread to parse.
        Object.keys(args).forEach((_, i) => message['argument' + i] = args[i]);

        this.state = 'running';
        task.state = 'running';
        this.postMessage(message, []);
    };

    /**
     * Post a message to be handled on the thread.
     * @param msg The message to send the thread. Must be of type `run`.
     * @param transferables Objects that will have ownership transferred to the thread and will
     * cease to exist on the main thread. E.g. `Uint8Array`, `ArrayBuffer`.
     */
    public postMessage(msg: { type: 'run' } & Message, transferables: Transferable[]): void {
        this._worker.postMessage(msg, transferables);
    }

    /**
     * Set properties global to any task that runs on this thread.
     * @param globals Sets properties that can be accessed from any task run in the thread.
     * Accessible through `self.key` or `global.key`. `global` is a proxy.
     * @param taskId optional id to give the task that will set the globals on the thread.
     * @returns Promise<void>
     */
    public setOrMergeGlobals(globals: { [k: string]: any }, taskId?: number): Promise<void> {
        Object.assign(this.globals, globals);
        const setGlobalTask = new Task({ id: taskId || 1, func: setGlobals });
        this.run(setGlobalTask, this.globals);

        return new Promise((resolve, reject) => {
            setGlobalTask.done()
                .then(() => resolve())
                .catch(e => reject(e));
        });
    }
}

/**
 * Main function that executes on the spawned thread.
 */
const workerMain: string = `function() {
    const global = new Proxy({}, {
        get: (obj, prop) => (self[prop]),
        set: (obj, prop, newval) => (self[prop] = newval)
    });

    onmessage = function (ev) {
        const msg = ev.data;

        if (msg.type !== 'run')
            return;

        const args = Object.keys(msg)
            .filter(key => key.match(/^argument/))
            .sort((a, b) => parseInt(a.slice(8), 10) - parseInt(b.slice(8), 10)) // remove word 'argument'
            .map(key => msg[key]);

        try {
            const result = eval('(' + msg.func + ')').apply(undefined, args);
            if (result && result.then && result.catch)
                result
                    .then(res => self.postMessage({ type: 'result', id: msg.id, result: res }))
                    .catch(err => self.postMessage({ type: 'error', id: msg.id, error: err.stack }));
            else
                self.postMessage({ type: 'result', id: msg.id, result });
        } catch (e) {
            self.postMessage({ type: 'error', id: msg.id, error: e.stack });
        }
    }
};`;

const setGlobals = `function (g) {
    if (g !== undefined)
        Object.keys(g).forEach(k => global[k] = g[k]);
}`;
