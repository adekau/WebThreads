import { fnToURL, noOp } from './helpers';
import { Message } from './Message';
import { Task } from './Task';

export type ThreadConfig = {
    id: number;
    onTaskDone?: (thread: Thread) => void;
    onTerminate?: (thread: Thread) => void;
};

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
        this._worker.addEventListener('message', this._onMessage.bind(this));
    }

    private _onMessage(event: MessageEvent): void {
        const { data } = event;
        this._handleWorkerMessage(data);
    }

    private _handleWorkerMessage(message: Message): void {
        let taskIdx;

        this.tasks.some((task, idx) => {
            if (message.id === task.id) {
                taskIdx = idx;
                return true;
            } else
                return false;
        });

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
        this.postMessage(message, []);
    };

    public postMessage(msg: { type: 'run' } & Message, transferables: Transferable[]): void {
        this._worker.postMessage(msg, transferables);
    }

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

const workerMain = `function() {
    const global = new Proxy({}, {
        get: (obj, prop) => (self[prop]),
        set: (obj, prop, newval) => (self[prop] = newval)
    });

    onmessage = function (ev) {
        const msg = ev.data;

        const args = Object.keys(msg)
            .filter(key => key.match(/^argument/))
            .sort((a, b) => parseInt(a.slice(8), 10) - parseInt(b.slice(8), 10)) // remove word 'argument'
            .map(key => msg[key]);

        try {
            const result = eval('(' + msg.func + ')').apply(undefined, args);
            if (result && result.then && result.catch) {
                result
                    .then(res => self.postMessage({ type: 'result', id: msg.id, result: res }))
                    .catch(err => self.postMessage({ type: 'error', id: msg.id, error: err.stack }));
            } else
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
